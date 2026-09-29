import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateRewrites, parseRewriteJson, validateRewriteInput, validateRewritePayload } from '../server/rewrite.js'
import { acceptButtonState, applyManualRewriteEdit, applyRewriteDecision, canEnterFinalResume, effectiveRewriteText, mergeRegeneratedRewrite, normalizeRewriteItems, rejectButtonState } from '../src/services/rewriteState.js'

let checks = 0
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1 }
const check = (value, message) => { assert.ok(value, message); checks += 1 }
const fails = (run, code) => { assert.throws(run, (error) => error.code === code); checks += 1 }
const failsAsync = async (run, code) => { await assert.rejects(run, (error) => error.code === code); checks += 1 }

function fixture({ gapType = '表达缺口', subtype = null, optimizable = true, text = '参与用户访谈并整理记录', facts } = {}) {
  const factList = facts ?? [{ factId: 'fact-001', experienceId: 'exp-001', experienceName: '产品项目', content: '参与用户访谈并整理记录', sourceText: '参与用户访谈并整理记录', sourceLocation: '项目经历', type: '行动事实', status: '已确认', requiresConfirmation: false }]
  const matchStatus = gapType === '表达缺口' ? '满足' : subtype === '能力缺失' ? '未满足' : gapType === '事实缺口' ? '待确认' : '部分满足'
  return {
    diagnoses: [{ diagnosisId: 'diag-001', resumeItemId: 'item-001', experienceId: 'exp-001', experienceName: '产品项目', originalText: text, issueType: gapType === '表达缺口' ? '表达泛化' : subtype ?? '事实待补充', description: '已有真实事实，但表达不足。', requirementIds: ['req-001'], primaryRequirementId: 'req-001', mappingId: 'map-001', gapId: 'gap-001', factIds: factList.map((fact) => fact.factId), gapType, priority: '高', suggestion: '只强化已有真实行动。', optimizable, skipped: false }],
    requirements: [{ requirementId: 'req-001', normalizedRequirement: '独立完成用户研究', requiredLevel: 'L4 设计 / 主导' }],
    mappings: [{ mappingId: 'map-001', requirementId: 'req-001', factIds: factList.map((fact) => fact.factId), evidenceLevel: subtype === '能力程度不足' ? 'L3 实践' : 'L4 设计 / 主导', evidenceStrength: '中等证据', reason: '事实证明相关实践。' }],
    gaps: [{ gapId: 'gap-001', requirementId: 'req-001', gapType, capabilityGapSubtype: subtype, rewritePermission: gapType === '表达缺口' ? '可直接改写' : subtype === '能力程度不足' ? '有限改写' : '不可改写', reason: '存在缺口。' }],
    facts: factList,
    selectedDiagnosisIds: ['diag-001'],
  }
}

function output(candidate, optimizedText = '参与目标用户访谈，整理访谈记录与问题。', usedFactIds = ['fact-001'], diagnosisIds = [candidate.diagnosisId]) {
  return { resumeItemId: candidate.resumeItemId, diagnosisIds, optimizedText, usedFactIds, reason: '核心目的：呈现用户研究实践；基于已确认事实明确参与动作，保留职责边界。' }
}

const expression = validateRewriteInput(fixture())
const expressionResult = validateRewritePayload({ rewrites: [output(expression.candidates[0])] }, expression)[0]
equal(expressionResult.diagnosisId, 'diag-001', '表达缺口可生成 Rewrite')
equal(expressionResult.validationStatus, '待事实校验', '本模块不得冒充第 7 模块校验通过')
equal(expressionResult.usedFactIds[0], 'fact-001', 'usedFactIds 可追溯')

const shortfall = validateRewriteInput(fixture({ gapType: '能力缺口', subtype: '能力程度不足' }))
const shortfallResult = validateRewritePayload({ rewrites: [output(shortfall.candidates[0], '参与用户访谈，整理访谈记录。')] }, shortfall)[0]
equal(shortfallResult.optimizedText.includes('参与'), true, '能力程度不足允许有限改写')

fails(() => validateRewriteInput(fixture({ gapType: '事实缺口', optimizable: false, text: '待补充事实' })), 'REWRITE_NOT_ALLOWED')
fails(() => validateRewriteInput(fixture({ gapType: '能力缺口', subtype: '能力缺失', optimizable: false })), 'REWRITE_NOT_ALLOWED')
fails(() => validateRewriteInput(fixture({ optimizable: false })), 'REWRITE_NOT_ALLOWED')
const constrainedExpression = validateRewritePayload({ rewrites: [output(expression.candidates[0], '负责用户访谈并整理记录。')] }, expression)[0]
check(!constrainedExpression.optimizedText.includes('负责'), '事实无明确职责时自动降为中性行动表达')

const responsible = validateRewriteInput(fixture({ text: '负责产品模块设计', facts: [{ factId: 'fact-001', experienceId: 'exp-001', experienceName: '产品项目', content: '负责产品模块设计', sourceText: '负责产品模块设计', sourceLocation: '项目经历', type: '职责事实', status: '已确认', requiresConfirmation: false }] }))
const constrainedResponsible = validateRewritePayload({ rewrites: [output(responsible.candidates[0], '主导项目产品设计。')] }, responsible)[0]
check(constrainedResponsible.optimizedText.includes('负责'), '负责上限不得被主导措辞突破')

const demo = validateRewriteInput(fixture({ text: '完成可运行 Demo', facts: [{ factId: 'fact-001', experienceId: 'exp-001', experienceName: '产品项目', content: '完成可运行 Demo', sourceText: '完成可运行 Demo', sourceLocation: '项目经历', type: '项目状态事实', projectStatus: '演示版本', status: '已确认', requiresConfirmation: false }] }))
const constrainedDemo = validateRewritePayload({ rewrites: [output(demo.candidates[0], '推动产品正式上线。')] }, demo)[0]
check(!constrainedDemo.optimizedText.includes('正式上线'), 'Demo 项目不得生成正式上线措辞')

const numeric = validateRewriteInput(fixture({ text: '完成用户访谈', facts: [{ factId: 'fact-001', experienceId: 'exp-001', experienceName: '产品项目', content: '完成用户访谈', sourceText: '完成用户访谈', sourceLocation: '项目经历', type: '行动事实', status: '已确认', requiresConfirmation: false }] }))
fails(() => validateRewritePayload({ rewrites: [output(numeric.candidates[0], '完成 30 次用户访谈。')] }, numeric), 'UNSUPPORTED_NUMBER')
fails(() => validateRewritePayload({ rewrites: [output(expression.candidates[0], undefined, ['fact-fake'])] }, expression), 'INVALID_FACT_ID')

const crossProject = fixture({ facts: [{ factId: 'fact-other', experienceId: 'exp-002', experienceName: '其他项目', content: '主导技术方案', sourceText: '主导技术方案', sourceLocation: '其他项目', type: '职责事实', status: '已确认', requiresConfirmation: false }] })
fails(() => validateRewriteInput(crossProject), 'EMPTY_ALLOWED_FACTS')

const accepted = applyRewriteDecision([expressionResult], expressionResult.rewriteId, '已接受')
equal(accepted[0].userDecision, '已接受', '接受状态可保存并驱动按钮显示已接受')
equal(accepted[0].validationStatus, '待事实校验', '已接受与待事实校验可以同时存在')
equal(normalizeRewriteItems(JSON.parse(JSON.stringify(accepted)))[0].userDecision, '已接受', '刷新恢复后保持已接受')
equal(normalizeRewriteItems([{ ...expressionResult, userDecision: '已采纳' }])[0].userDecision, '已接受', '旧缓存已采纳迁移为已接受')
const rejected = applyRewriteDecision(accepted, expressionResult.rewriteId, '已拒绝')
equal(rejected[0].userDecision, '已拒绝', '拒绝状态可保存')
equal(rejected[0].validationStatus, '待事实校验', '拒绝不会被改成事实校验失败')
const regenerated = mergeRegeneratedRewrite(rejected, { ...expressionResult, optimizedText: '参与用户访谈，完成记录整理。' })
equal(regenerated[0].optimizedText, '参与用户访谈，完成记录整理。', '重新生成替换文本')
equal(regenerated[0].userDecision, '待处理', '重新生成重置用户决策')
equal(regenerated[0].validationStatus, '待事实校验', '重新生成重置事实校验状态')
check(regenerated[0].version !== expressionResult.version, '重新生成产生新的文本版本')
const manuallyEdited = applyManualRewriteEdit([{ ...expressionResult, userDecision: '已接受', validationStatus: '校验通过' }], expressionResult.rewriteId, '参与访谈并整理记录。')
equal(manuallyEdited[0].userDecision, '待处理', '手动修改视为新的待处理内容')
equal(manuallyEdited[0].validationStatus, '待事实校验', '手动修改后重新等待事实校验')
check(manuallyEdited[0].version !== expressionResult.version, '手动修改产生新的文本版本')
equal(manuallyEdited[0].editedText, '参与访谈并整理记录。', '用户修改单独保存到 editedText')
equal(manuallyEdited[0].optimizedText, expressionResult.optimizedText, '手动修改不覆盖 AI 原始 Rewrite')
equal(manuallyEdited[0].originalText, expressionResult.originalText, '手动修改不覆盖原始简历内容')
equal(effectiveRewriteText(manuallyEdited[0]), '参与访谈并整理记录。', '卡片读取用户修改后的当前有效文本')
equal(applyManualRewriteEdit(manuallyEdited, expressionResult.rewriteId, '   '), manuallyEdited, '空内容不能保存')
equal(normalizeRewriteItems(JSON.parse(JSON.stringify(manuallyEdited)))[0].editedText, '参与访谈并整理记录。', '刷新后用户编辑版本仍保持')
equal(canEnterFinalResume(accepted), false, '已接受但未校验通过不能进入最终简历')
equal(canEnterFinalResume([{ ...accepted[0], validationStatus: '校验通过' }]), true, '已接受且校验通过才可进入最终简历')
equal(canEnterFinalResume(rejected), true, '已拒绝时保留原文且不需要将拒绝标记为校验失败')
const rejectedPassed = { ...rejected[0], validationStatus: '校验通过' }
equal(acceptButtonState(rejectedPassed).label, '改为接受', '校验通过且已拒绝时显示改为接受')
equal(acceptButtonState(rejectedPassed).disabled, false, '校验通过且已拒绝时允许改为接受')
equal(acceptButtonState({ ...rejected[0], validationStatus: '校验不通过' }).disabled, true, '校验不通过且已拒绝时禁止接受')
equal(acceptButtonState({ ...rejected[0], validationStatus: '校验不通过' }).label, '校验未通过，无法接受', '校验不通过时明确说明接受被禁止')
equal(acceptButtonState({ ...accepted[0], validationStatus: '校验通过' }).label, '已接受', '已接受且校验通过显示已接受')
equal(acceptButtonState({ ...accepted[0], validationStatus: '校验不通过' }).disabled, true, '已接受且校验不通过不能重复接受')
equal(acceptButtonState({ ...expressionResult, userDecision: '待处理', validationStatus: '待事实校验' }).label, '接受', '待处理显示接受')
equal(acceptButtonState({ ...expressionResult, userDecision: '待处理', validationStatus: '校验通过' }).label, '接受', '待处理且校验通过仍显示接受')
equal(acceptButtonState({ ...expressionResult, userDecision: '待处理', validationStatus: '校验不通过' }).disabled, false, '待处理且校验失败仍可先作出接受决定')
equal(acceptButtonState({ ...expressionResult, userDecision: '已拒绝', validationStatus: '待事实校验' }).label, '改为接受', '已拒绝且待校验可改为接受')
equal(acceptButtonState({ ...expressionResult, userDecision: '已拒绝', validationStatus: '校验不通过' }).disabled, true, '已拒绝且校验失败禁止接受')
equal(rejectButtonState({ ...expressionResult, userDecision: '已接受' }).label, '改为拒绝', '已接受显示改为拒绝')
equal(rejectButtonState({ ...expressionResult, userDecision: '已拒绝' }).label, '已拒绝', '已拒绝显示选中态')
equal(canEnterFinalResume([{ ...expressionResult, userDecision: '已拒绝', validationStatus: '校验不通过' }, { ...expressionResult, rewriteId: 'rewrite-002', userDecision: '已接受', validationStatus: '校验通过' }]), true, '拒绝与已通过接受可以混合进入结果页')
equal(canEnterFinalResume([{ ...expressionResult, userDecision: '已接受', validationStatus: '校验失败' }]), false, '非标准校验状态不得放行')

const optimizationSource = readFileSync(new URL('../src/pages/OptimizationPage.tsx', import.meta.url), 'utf8')
const modalSource = readFileSync(new URL('../src/components/optimization/ManualRewriteModal.tsx', import.meta.url), 'utf8')
check(!optimizationSource.includes('window.prompt') && !optimizationSource.includes('window.alert'), '手动修改不再使用浏览器原生 prompt/alert')
check(optimizationSource.includes('setEditingRewrite(item)'), '点击手动修改打开产品内 Modal')
check(modalSource.includes('原始简历内容') && modalSource.includes('AI 优化版本') && modalSource.includes('我的修改'), 'Modal 展示原文、AI 版本和用户版本')
check(modalSource.includes('rows={6}') && modalSource.includes('usedFactIds'), 'Modal 使用多行编辑并展示 Fact 来源')
check(modalSource.includes('保存修改后，该版本需要重新进行事实校验'), 'Modal 明确提示重新事实校验')
check(optimizationSource.includes("{item.userDecision}</span>") && !optimizationSource.includes("item.userDecision !== '待处理' &&"), '右上角始终独立显示用户决策状态')
check(optimizationSource.includes('已接受且事实校验通过，将采用当前有效优化文本'), 'accepted + passed 使用准确完成提示')
check(optimizationSource.includes('updateItems((current) => mergeRegeneratedRewrite(current, regenerated))'), '重新生成基于最新列表合并，不覆盖其他卡片的新决策')

fails(() => parseRewriteJson('{bad'), 'OUTPUT_TRUNCATED')
fails(() => validateRewritePayload({ rewrites: [{ diagnosisId: 'diag-001' }] }, expression), 'SCHEMA_INVALID')
fails(() => validateRewritePayload({ rewrites: [] }, expression), 'EMPTY_REWRITE_RESULT')
equal(parseRewriteJson('```json\n{"rewrites":[]}\n```').rewrites.length, 0, 'JSON 代码块可安全解析')

let regenerateCalls = 0
const regeneratedByModel = await generateRewrites({ maxRetries: 1, development: false }, { ...expression, regenerateDiagnosisId: 'diag-001', previousOptimizedText: '旧版本' }, async () => {
  regenerateCalls += 1
  return { content: JSON.stringify({ rewrites: [output(expression.candidates[0], '参与用户访谈并完成记录整理。')] }), finishReason: 'stop' }
})
equal(regenerateCalls, 1, '重新生成调用真实生成链路')
equal(regeneratedByModel.length, 1, '重新生成返回单条 Rewrite')

let failureCalls = 0
await failsAsync(() => generateRewrites({ maxRetries: 1, development: false }, expression, async () => { failureCalls += 1; throw new Error('network') }), 'MODEL_CALL_FAILED')
equal(failureCalls, 2, '模型调用失败只有限重试一次')

check(expressionResult.requirementIds.includes('req-001'), 'Rewrite 可追溯 Requirement')

const multi = fixture({ facts: [
  { factId: 'fact-001', experienceId: 'exp-001', experienceName: '产品项目', content: '参与用户访谈并整理记录', sourceText: '参与用户访谈并整理记录', sourceLocation: '项目经历', type: '行动事实', status: '已确认', requiresConfirmation: false },
  { factId: 'fact-002', experienceId: 'exp-001', experienceName: '产品项目', content: '整理用户痛点形成需求清单', sourceText: '整理用户痛点形成需求清单', sourceLocation: '项目经历', type: '行动事实', status: '已确认', requiresConfirmation: false },
] })
multi.diagnoses.push({ ...multi.diagnoses[0], diagnosisId: 'diag-002', primaryRequirementId: 'req-002', requirementIds: ['req-002'], mappingId: 'map-002', gapId: 'gap-002' })
multi.requirements.push({ ...multi.requirements[0], requirementId: 'req-002', normalizedRequirement: '将洞察转化为产品需求' })
multi.mappings.push({ ...multi.mappings[0], mappingId: 'map-002', requirementId: 'req-002' })
multi.gaps.push({ ...multi.gaps[0], gapId: 'gap-002', requirementId: 'req-002' })
multi.selectedDiagnosisIds.push('diag-002')
const multiInput = validateRewriteInput(multi)
equal(multiInput.experiencePlans.length, 1, '同项目 Diagnosis 先合并为一个 Rewrite Plan')
equal(multiInput.experiencePlans[0].allowedFacts.length, 2, 'Rewrite Plan 统一收集项目 Fact 并去重')
equal(multiInput.planItems.length, 1, '同一 resumeItem 的多个 Diagnosis 只有一个 Plan item')
const merged = validateRewritePayload({ rewrites: [output(multiInput.candidates[0], '参与用户访谈并整理记录，归纳用户痛点。', ['fact-001'], ['diag-001', 'diag-002'])] }, multiInput)
equal(merged.length, 1, '同一 resumeItem 的多个 Diagnosis 可由一个 Rewrite 覆盖')
equal(merged[0].diagnosisIds.length, 2, 'Rewrite 记录全部覆盖的 Diagnosis')
equal(merged[0].usedFactIds.length, 1, 'Rewrite 可只使用部分 allowed Fact')

const eleven = structuredClone(fixture())
for (let index = 2; index <= 11; index += 1) {
  const diagnosisId = `diag-${String(index).padStart(3, '0')}`
  const requirementId = `req-${String(index).padStart(3, '0')}`
  const mappingId = `map-${String(index).padStart(3, '0')}`
  const gapId = `gap-${String(index).padStart(3, '0')}`
  eleven.diagnoses.push({ ...eleven.diagnoses[0], diagnosisId, primaryRequirementId: requirementId, requirementIds: [requirementId], mappingId, gapId })
  eleven.requirements.push({ ...eleven.requirements[0], requirementId, normalizedRequirement: `产品能力要求 ${index}` })
  eleven.mappings.push({ ...eleven.mappings[0], mappingId, requirementId })
  eleven.gaps.push({ ...eleven.gaps[0], gapId, requirementId })
  eleven.selectedDiagnosisIds.push(diagnosisId)
}
const elevenInput = validateRewriteInput(eleven)
equal(elevenInput.candidates.length, 11, '批量输入包含 11 条选中 Diagnosis')
equal(elevenInput.planItems.length, 1, '11 条同一 resumeItem Diagnosis 合并为一个 Plan item')
const elevenOutput = validateRewritePayload({ rewrites: [output(elevenInput.candidates[0], '参与用户访谈并整理记录。', ['fact-001'], elevenInput.candidates.map((item) => item.diagnosisId))] }, elevenInput)
equal(elevenOutput.length, 1, '11 条 Diagnosis 最多生成一个 Rewrite')
equal(elevenOutput[0].diagnosisIds.length, 11, '批量 Rewrite 覆盖全部 11 条 Diagnosis')
fails(() => validateRewritePayload({ rewrites: [
  output(elevenInput.candidates[0], '参与用户访谈并整理记录。', ['fact-001'], ['diag-001']),
  output(elevenInput.candidates[1], '参与用户访谈并归纳问题。', ['fact-001'], ['diag-002']),
] }, elevenInput), 'REWRITE_COUNT_EXCEEDS_PLAN')
fails(() => validateRewritePayload({ rewrites: [output(elevenInput.candidates[0], '参与用户访谈并整理记录。', ['fact-001'], ['diag-001', 'diag-999'])] }, elevenInput), 'UNKNOWN_DIAGNOSIS')
fails(() => validateRewritePayload({ rewrites: [{ ...output(elevenInput.candidates[0], '参与用户访谈并整理记录。', ['fact-001'], elevenInput.candidates.map((item) => item.diagnosisId)), resumeItemId: 'item-unknown' }] }, elevenInput), 'UNKNOWN_RESUME_ITEM')
fails(() => validateRewritePayload({ rewrites: [output(elevenInput.candidates[0], '参与用户访谈并整理记录。', ['fact-001'], ['diag-001'])] }, elevenInput), 'PLAN_GROUP_MISMATCH')

let planRetryCalls = 0
const retriedPlan = await generateRewrites({ maxRetries: 1, development: false }, elevenInput, async () => {
  planRetryCalls += 1
  if (planRetryCalls === 1) return { content: JSON.stringify({ rewrites: [
    output(elevenInput.candidates[0], '参与用户访谈并整理记录。', ['fact-001'], ['diag-001']),
    output(elevenInput.candidates[1], '参与用户访谈并归纳问题。', ['fact-001'], ['diag-002']),
  ] }), finishReason: 'stop' }
  return { content: JSON.stringify({ rewrites: [output(elevenInput.candidates[0], '参与用户访谈并整理记录。', ['fact-001'], elevenInput.candidates.map((item) => item.diagnosisId))] }), finishReason: 'stop' }
})
equal(planRetryCalls, 2, 'Rewrite Plan 违规后只重试一次')
equal(retriedPlan.length, 1, '重试成功后返回一个 Plan Rewrite')
let planFailureCalls = 0
await failsAsync(() => generateRewrites({ maxRetries: 1, development: false }, elevenInput, async () => {
  planFailureCalls += 1
  return { content: JSON.stringify({ rewrites: [
    output(elevenInput.candidates[0], '参与用户访谈并整理记录。', ['fact-001'], ['diag-001']),
    output(elevenInput.candidates[1], '参与用户访谈并归纳问题。', ['fact-001'], ['diag-002']),
  ] }), finishReason: 'stop' }
}), 'REWRITE_COUNT_EXCEEDS_PLAN')
equal(planFailureCalls, 2, '两次 Plan 违规后明确失败且不截断')

const separateItems = structuredClone(multi)
separateItems.diagnoses[1].resumeItemId = 'item-002'
separateItems.diagnoses[1].originalText = '整理需求清单'
const separateInput = validateRewriteInput(separateItems)
const projectMerged = validateRewritePayload({ rewrites: [output(
  separateInput.candidates[0],
  '参与用户访谈并整理记录，归纳用户痛点。',
  ['fact-001'],
  ['diag-001', 'diag-002'],
)] }, separateInput)
equal(projectMerged.length, 1, '同一项目不同 resumeItem 的相近问题可压缩成一个 Rewrite')
equal(projectMerged[0].diagnosisIds.length, 2, '项目级合并仍完整保留 Diagnosis 覆盖关系')
check(projectMerged[0].originalText.includes('\n'), '项目级合并保留多个原始 resumeItem 文本')
fails(() => validateRewritePayload({ rewrites: [
  output(separateInput.candidates[0], '参与用户访谈并整理记录。', ['fact-001']),
  output(separateInput.candidates[1], '参与用户访谈并整理访谈记录。', ['fact-001']),
] }, separateInput), 'REWRITE_COUNT_EXCEEDS_PLAN')

const projectPlanFixture = fixture({ facts: [
  { factId: 'fact-001', experienceId: 'exp-001', experienceName: '产品项目', content: '整理用户访谈记录', sourceText: '整理用户访谈记录', sourceLocation: '项目经历', type: '行动事实', status: '已确认', requiresConfirmation: false },
  { factId: 'fact-002', experienceId: 'exp-001', experienceName: '产品项目', content: '归纳用户需求问题', sourceText: '归纳用户需求问题', sourceLocation: '项目经历', type: '行动事实', status: '已确认', requiresConfirmation: false },
  { factId: 'fact-003', experienceId: 'exp-001', experienceName: '产品项目', content: '整理模型评测记录', sourceText: '整理模型评测记录', sourceLocation: '项目经历', type: '行动事实', status: '已确认', requiresConfirmation: false },
  { factId: 'fact-004', experienceId: 'exp-001', experienceName: '产品项目', content: '形成模型结果对比', sourceText: '形成模型结果对比', sourceLocation: '项目经历', type: '行动事实', status: '已确认', requiresConfirmation: false },
] })
projectPlanFixture.diagnoses[0] = { ...projectPlanFixture.diagnoses[0], resumeItemId: 'item-insight-1', factIds: ['fact-001', 'fact-002'], description: '已有用户研究事实，但洞察表达不足。', suggestion: '突出用户研究与洞察。' }
projectPlanFixture.mappings[0] = { ...projectPlanFixture.mappings[0], factIds: ['fact-001', 'fact-002'] }
const projectSpecs = [
  ['diag-002', 'req-002', 'map-002', 'gap-002', 'item-insight-2', ['fact-001', 'fact-002'], '已有用户研究事实，但需求归纳表达不足。', '突出用户研究与洞察。'],
  ['diag-003', 'req-003', 'map-003', 'gap-003', 'item-eval-1', ['fact-003', 'fact-004'], '已有模型评测事实，但验证过程表达不足。', '突出模型评测与结果对比。'],
  ['diag-004', 'req-004', 'map-004', 'gap-004', 'item-eval-2', ['fact-003', 'fact-004'], '已有模型评测事实，但结果对比表达不足。', '突出模型评测与结果对比。'],
]
for (const [diagnosisId, requirementId, mappingId, gapId, resumeItemId, factIds, description, suggestion] of projectSpecs) {
  projectPlanFixture.diagnoses.push({ ...projectPlanFixture.diagnoses[0], diagnosisId, primaryRequirementId: requirementId, requirementIds: [requirementId], mappingId, gapId, resumeItemId, factIds, originalText: description, description, suggestion })
  projectPlanFixture.requirements.push({ ...projectPlanFixture.requirements[0], requirementId, normalizedRequirement: suggestion })
  projectPlanFixture.mappings.push({ ...projectPlanFixture.mappings[0], mappingId, requirementId, factIds })
  projectPlanFixture.gaps.push({ ...projectPlanFixture.gaps[0], gapId, requirementId })
  projectPlanFixture.selectedDiagnosisIds.push(diagnosisId)
}
const deterministicPlan = validateRewriteInput(projectPlanFixture)
equal(deterministicPlan.planItems.length, 2, '规则层把四个原子条目合并为两个项目级 Rewrite Plan')
equal(deterministicPlan.planItems.every((item) => item.diagnosisIds.length === 2), true, '每个项目级 Plan 完整记录合并后的 Diagnosis')
const assignedFactIds = deterministicPlan.planItems.flatMap((item) => item.allowedFactIds)
equal(new Set(assignedFactIds).size, assignedFactIds.length, '同一 Fact 在项目级 Plan 中只有一个归属')
const deterministicOutputs = deterministicPlan.planItems.map((item, index) => ({
  resumeItemId: item.resumeItemId,
  diagnosisIds: item.diagnosisIds,
  optimizedText: index === 0 ? '整理用户访谈记录，归纳用户需求问题。' : '整理模型评测记录，形成结果对比。',
  usedFactIds: [item.allowedFactIds[0]],
  reason: index === 0 ? '核心目的：呈现用户研究洞察；使用已确认的访谈事实。' : '核心目的：呈现模型评测实践；使用已确认的评测事实。',
}))
const deterministicResults = validateRewritePayload({ rewrites: deterministicOutputs }, deterministicPlan)
equal(deterministicResults.length, 2, '模型严格按项目级 Plan 生成两条互补 Rewrite')
equal(new Set(deterministicResults.flatMap((item) => item.diagnosisIds)).size, 4, '合并后所有 Diagnosis 恰好覆盖一次')
fails(() => validateRewritePayload({ rewrites: deterministicOutputs.map((item, index) => index === 1 ? { ...item, usedFactIds: [deterministicPlan.planItems[0].allowedFactIds[0]] } : item) }, deterministicPlan), 'INVALID_FACT_ID')
const duplicatePlanInput = structuredClone(multi)
duplicatePlanInput.diagnoses[1].resumeItemId = 'item-001'
duplicatePlanInput.diagnoses[1].originalText = '整理需求清单'
duplicatePlanInput.diagnoses.push({ ...duplicatePlanInput.diagnoses[0], diagnosisId: 'diag-003', primaryRequirementId: 'req-003', requirementIds: ['req-003'], mappingId: 'map-003', gapId: 'gap-003', resumeItemId: 'item-002', originalText: '推进产品协作' })
duplicatePlanInput.requirements.push({ ...duplicatePlanInput.requirements[0], requirementId: 'req-003', normalizedRequirement: '推进产品协作' })
duplicatePlanInput.mappings.push({ ...duplicatePlanInput.mappings[0], mappingId: 'map-003', requirementId: 'req-003' })
duplicatePlanInput.gaps.push({ ...duplicatePlanInput.gaps[0], gapId: 'gap-003', requirementId: 'req-003' })
duplicatePlanInput.selectedDiagnosisIds.push('diag-003')
const duplicatePlan = validateRewriteInput(duplicatePlanInput)
fails(() => validateRewritePayload({ rewrites: [
  output(duplicatePlan.candidates[0], '参与用户访谈并整理记录。', ['fact-001'], ['diag-001']),
  output(duplicatePlan.candidates[1], '归纳用户痛点形成需求。', ['fact-002'], ['diag-002']),
] }, duplicatePlan), 'REWRITE_COUNT_EXCEEDS_PLAN')
equal(duplicatePlan.planItems.length >= 1, true, '项目级 Plan 由规则层确定数量')
fails(() => validateRewritePayload({ rewrites: [
  output(separateInput.candidates[0], '整理用户访谈记录，归纳用户问题。', ['fact-001']),
  output(separateInput.candidates[1], '整理用户访谈记录，归纳用户痛点。', ['fact-002']),
] }, separateInput), 'REWRITE_COUNT_EXCEEDS_PLAN')

const supplementalText = '在整个项目落地过程中，我负责和UI、研发团队、测试等各部门沟通，最终项目成功落地'
const supplemental = validateRewriteInput(fixture({ text: '沟通协调', facts: [{ factId: 'fact-supplement-001', experienceId: 'exp-001', experienceName: '产品项目', content: supplementalText, sourceText: supplementalText, sourceLocation: '用户补充经历', type: '行动事实', status: '已确认', requiresConfirmation: false }] }))
fails(() => validateRewritePayload({ rewrites: [output(supplemental.candidates[0], supplementalText, ['fact-supplement-001'])] }, supplemental), 'SUPPLEMENT_COPIED')
const processSupplement = '负责整个产品的设计流程，我设计了AI简历优化助手项目，从需求调研、需求分析、产品MVP确定、产品功能设计、AI功能和优化设计到产品上线的全过程。'
const processInput = validateRewriteInput(fixture({ text: '产品设计负责人', facts: [{ factId: 'fact-supplement-002', experienceId: 'exp-001', experienceName: '产品项目', content: processSupplement, sourceText: processSupplement, sourceLocation: '岗位匹配页 · 用户补充', type: '行动事实', status: '已确认', requiresConfirmation: false }] }))
fails(() => validateRewritePayload({ rewrites: [output(processInput.candidates[0], '作为产品设计负责人，负责AI简历优化助手从需求调研、需求分析、MVP确定、产品功能设计、AI功能与优化设计到产品上线的全流程设计。', ['fact-supplement-002'])] }, processInput), 'SUPPLEMENT_COPIED')

const regenerationInput = validateRewriteInput({ ...fixture(), existingRewrites: [{ rewriteId: 'rewrite-other', experienceId: 'exp-001', optimizedText: '参与用户访谈并整理记录。', usedFactIds: ['fact-001'] }] })
fails(() => validateRewritePayload({ rewrites: [output(regenerationInput.candidates[0], '参与用户访谈并整理访谈记录。')] }, regenerationInput), 'DUPLICATE_FACT_USAGE')
process.stdout.write(`${JSON.stringify({ ok: true, checks })}\n`)

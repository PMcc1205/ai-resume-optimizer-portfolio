import assert from 'node:assert/strict'
import { generateDiagnoses, parseDiagnosisJson, validateDiagnosisInput, validateDiagnosisPayload } from '../server/diagnosis.js'

let checks = 0
const equal = (actual, expected, reason) => { assert.equal(actual, expected, reason); checks += 1 }
const check = (value, reason) => { assert.ok(value, reason); checks += 1 }
const fails = (run, code) => { assert.throws(run, (error) => error.code === code); checks += 1 }
const failsAsync = async (run, code) => { await assert.rejects(run, (error) => error.code === code); checks += 1 }

function fixture(kind = '表达缺口', skipped = false) {
  const subtype = kind === '能力程度不足' ? '能力程度不足' : kind === '能力缺失' ? '能力缺失' : null
  const gapType = subtype ? '能力缺口' : kind
  const matchStatus = kind === '无缺口' || kind === '表达缺口' ? '满足' : kind === '事实缺口' ? '待确认' : kind === '能力缺失' ? '未满足' : '部分满足'
  const facts = [{ factId: 'fact-001', content: '参与产品方案设计', sourceText: '参与产品方案设计', sourceLocation: '项目第1条', experienceId: 'exp-001', experienceName: '产品项目', status: '已确认', requiresConfirmation: false }]
  if (kind === '能力缺失') facts.push({ factId: 'fact-absent', content: '没有相关经历', sourceText: '用户确认', sourceLocation: '岗位匹配页 · 用户确认 · req-001', experienceId: 'user-confirmation', experienceName: '用户确认', status: '明确不存在', requiresConfirmation: false })
  return {
    requirements: [{ requirementId: 'req-001', normalizedRequirement: '独立完成产品设计', importance: '核心要求', requiredLevel: 'L4 设计 / 主导' }],
    facts,
    mappings: [{ mappingId: 'map-001', requirementId: 'req-001', factIds: ['无缺口', '表达缺口', '能力程度不足'].includes(kind) ? ['fact-001'] : [], matchStatus, evidenceLevel: kind === '能力程度不足' ? 'L3 实践' : 'L4 设计 / 主导', evidenceStrength: '中等证据', reason: '事实只证明参与设计' }],
    gaps: [{ gapId: 'gap-001', requirementId: 'req-001', gapType, capabilityGapSubtype: subtype, reason: '存在当前缺口', rewritePermission: subtype === '能力缺失' || gapType === '事实缺口' ? '不可改写' : '有限改写' }],
    skippedIds: skipped ? ['req-001'] : [],
    resumeText: '产品经历\n参与产品方案设计',
  }
}

function model(candidate, issueType, suggestion = '根据真实事实明确说明现有职责。') {
  return { requirementId: candidate.requirementId, mappingId: candidate.mappingId, gapId: candidate.gapId, resumeItemId: candidate.resumeItemId, factIds: candidate.factIds, issueType, description: '原文已有参与产品方案设计的事实，但尚未证明独立完成岗位所需产品设计。', suggestion }
}

const clean = validateDiagnosisInput(fixture('无缺口'))
equal(clean.candidates.length, 0, '无缺口不强制生成问题')
equal(validateDiagnosisPayload({ diagnoses: [] }, clean).length, 0, '无缺口允许空结果')

const expression = validateDiagnosisInput(fixture('表达缺口'))
const expressionResult = validateDiagnosisPayload({ diagnoses: [model(expression.candidates[0], '表达泛化')] }, expression)[0]
equal(expressionResult.optimizable, true, '表达缺口允许优化')
equal(expressionResult.priority, '高', '核心可优化表达问题优先级为高')
equal(expressionResult.originalText, '参与产品方案设计', '原始文本追溯简历原文')
equal(expressionResult.resumeItemId, 'item-fact-001', '简历条目引用稳定')
equal(expressionResult.mappingId, 'map-001', '诊断追溯 Mapping')
equal(expressionResult.gapId, 'gap-001', '诊断追溯 Gap')
equal(expressionResult.primaryRequirementId, 'req-001', '诊断追溯 Requirement')
equal(expressionResult.factIds[0], 'fact-001', '诊断追溯 Fact')

const factGap = validateDiagnosisInput(fixture('事实缺口'))
const factResult = validateDiagnosisPayload({ diagnoses: [model(factGap.candidates[0], '事实待补充', '请补充实际工作职责与证据。')] }, factGap)[0]
equal(factResult.optimizable, false, '事实缺口不可改写')
equal(factResult.originalText, '', '无 Fact 不得虚构简历原文')
equal(factResult.priority, '中', '核心事实缺口不得全部机械标高')
fails(() => validateDiagnosisPayload({ diagnoses: [model(factGap.candidates[0], '事实待补充', '可以直接改写简历。')] }, factGap), 'UNSAFE_SUGGESTION')

const skipped = validateDiagnosisInput(fixture('事实缺口', true))
const skippedResult = validateDiagnosisPayload({ diagnoses: [model(skipped.candidates[0], '事实待补充', '请补充真实职责。')] }, skipped)[0]
equal(skippedResult.skipped, true, '跳过交互状态传入诊断')
equal(skippedResult.optimizable, false, '跳过不能绕过事实缺口限制')
check(skippedResult.description.includes('本次分析可能不完整'), '跳过仍需提示分析不完整')

const shortfall = validateDiagnosisInput(fixture('能力程度不足'))
const shortfallResult = validateDiagnosisPayload({ diagnoses: [model(shortfall.candidates[0], '能力程度不足', '仅强化已有参与实践，不可声称独立负责。')] }, shortfall)[0]
equal(shortfallResult.optimizable, true, '能力程度不足允许有限优化')
equal(shortfallResult.gapType, '能力缺口', '诊断保持上游 Gap')

const missing = validateDiagnosisInput(fixture('能力缺失'))
const missingResult = validateDiagnosisPayload({ diagnoses: [model(missing.candidates[0], '能力缺失', '保持真实差距，未来积累相关项目经历。')] }, missing)[0]
equal(missingResult.optimizable, false, '能力缺失不可改写')
fails(() => validateDiagnosisPayload({ diagnoses: [model(missing.candidates[0], '能力缺失', '改写为主导该项目')] }, missing), 'UNSAFE_SUGGESTION')

fails(() => validateDiagnosisPayload({ diagnoses: [model(expression.candidates[0], '事实待补充')] }, expression), 'INVALID_ISSUE_TYPE')
fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(expression.candidates[0], '表达泛化'), mappingId: 'map-fake' }] }, expression), 'INVALID_REFERENCE')
fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(expression.candidates[0], '表达泛化'), factIds: ['fact-fake'] }] }, expression), 'INVALID_FACT_ID')
fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(expression.candidates[0], '表达泛化'), requirementId: 'req-fake' }] }, expression), 'INVALID_REQUIREMENT_ID')
fails(() => validateDiagnosisPayload({ diagnoses: [] }, expression), 'EMPTY_DIAGNOSIS_RESULT')
fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(expression.candidates[0], '表达泛化'), description: '' }] }, expression), 'SCHEMA_INVALID')
fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(expression.candidates[0], '表达泛化'), requirementId: '' }] }, expression), 'SCHEMA_INVALID')
fails(() => parseDiagnosisJson('{bad-json'), 'OUTPUT_TRUNCATED')
equal(parseDiagnosisJson('```json\n{"diagnoses":[]}\n```').diagnoses.length, 0, 'JSON 代码块可解析')
equal(parseDiagnosisJson('以下是结果：\n{"diagnoses":[]}\n以上为完整结果。').diagnoses.length, 0, 'JSON 前后解释文字可安全移除')
fails(() => parseDiagnosisJson('{"diagnoses":[]} {"diagnoses":[]}'), 'INVALID_JSON')
fails(() => parseDiagnosisJson('{"diagnoses": [invalid]}'), 'INVALID_JSON')
fails(() => parseDiagnosisJson('{"diagnoses":['), 'OUTPUT_TRUNCATED')
fails(() => parseDiagnosisJson(''), 'MODEL_EMPTY_OUTPUT')
fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(expression.candidates[0], '表达泛化'), suggestion: undefined }] }, expression), 'SCHEMA_INVALID')
fails(() => validateDiagnosisPayload({ diagnoses: [model(expression.candidates[0], '未知问题类型')] }, expression), 'INVALID_ISSUE_TYPE')
fails(() => validateDiagnosisInput({ ...fixture(), mappings: [{ ...fixture().mappings[0], factIds: ['fact-not-exist'] }] }), 'INVALID_FACT_ID')
fails(() => validateDiagnosisInput({ ...fixture('事实缺口'), gaps: [{ ...fixture('事实缺口').gaps[0], gapType: '无缺口' }] }), 'INVALID_GAP_STATE')
const safeNegative = validateDiagnosisPayload({ diagnoses: [model(factGap.candidates[0], '事实待补充', '当前不能直接改写简历，请先补充真实事实。')] }, factGap)[0]
equal(safeNegative.optimizable, false, '否定改写建议不应被误判为越过事实约束')

const communicationInput = fixture('表达缺口')
communicationInput.requirements[0].normalizedRequirement = '与技术、设计和测试团队高效沟通'
communicationInput.facts[0] = { ...communicationInput.facts[0], content: '负责与 UI、研发和测试团队沟通并推动项目落地', sourceText: '负责和UI、研发团队、测试等各部门沟通，最终项目成功落地' }
communicationInput.resumeText = `项目经历\n${communicationInput.facts[0].sourceText}`
const communication = validateDiagnosisInput(communicationInput)
fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(communication.candidates[0], '真实证据未体现'), description: '无法从简历看出任何沟通证据。' }] }, communication), 'DIAGNOSIS_TEXT_CONFLICT')
const communicationResult = validateDiagnosisPayload({ diagnoses: [{ ...model(communication.candidates[0], '真实证据未体现'), description: '原文已有跨团队沟通事实，但缺少具体协作事项、个人作用和沟通效果。' }] }, communication)[0]
check(communicationResult.description.includes('已有跨团队沟通事实'), '跨团队沟通存在时必须先承认已有事实')

const metricsInput = fixture('表达缺口')
metricsInput.requirements[0].normalizedRequirement = '通过上线后数据分析持续优化产品'
metricsInput.facts[0] = { ...metricsInput.facts[0], content: '上线后追踪留存和转化', sourceText: 'AI简历优化助手上线之后追踪留存、转化' }
metricsInput.resumeText = `项目经历\n${metricsInput.facts[0].sourceText}`
const metrics = validateDiagnosisInput(metricsInput)
fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(metrics.candidates[0], '真实证据未体现'), description: '简历中没有任何上线后数据追踪证据。' }] }, metrics), 'DIAGNOSIS_TEXT_CONFLICT')
const metricsResult = validateDiagnosisPayload({ diagnoses: [{ ...model(metrics.candidates[0], '真实证据未体现'), description: '原文已有上线后指标追踪事实，但尚未说明指标口径、分析过程、决策用途和最终结果。' }] }, metrics)[0]
check(metricsResult.description.includes('已有上线后指标追踪事实'), '数据追踪存在时必须先承认已有事实')

fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(expression.candidates[0], '表达泛化'), description: '当前表达需要调整。' }] }, expression), 'DIAGNOSIS_TEXT_CONFLICT')
const shortfallConsistent = validateDiagnosisPayload({ diagnoses: [{ ...model(shortfall.candidates[0], '能力程度不足'), description: '当前已有参与产品方案设计的实践，但只能证明 L3 实践，低于岗位要求的 L4。' }] }, shortfall)[0]
check(shortfallConsistent.description.includes('已有'), '能力程度不足必须说明已有实践')
fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(shortfall.candidates[0], '能力程度不足'), description: '用户完全缺失产品设计能力。' }] }, shortfall), 'DIAGNOSIS_TEXT_CONFLICT')
const unknownFact = validateDiagnosisPayload({ diagnoses: [{ ...model(factGap.candidates[0], '事实待补充'), description: '当前缺少足够事实，无法确认用户是否做过相关工作。', suggestion: '请补充真实经历和具体行动。' }] }, factGap)[0]
check(unknownFact.description.includes('无法确认'), '事实缺口只能描述当前无法确认')
fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(factGap.candidates[0], '事实待补充'), description: '用户没有相关真实经历。', suggestion: '请补充真实经历。' }] }, factGap), 'DIAGNOSIS_TEXT_CONFLICT')
const explicitMissing = validateDiagnosisPayload({ diagnoses: [{ ...model(missing.candidates[0], '能力缺失'), description: '用户已明确确认没有相关经历，当前能力缺失无法通过文案解决。' }] }, missing)[0]
check(explicitMissing.description.includes('没有相关经历'), '只有明确不存在状态允许描述能力缺失')
fails(() => validateDiagnosisPayload({ diagnoses: [{ ...model(expression.candidates[0], '表达泛化'), suggestion: '建议虚构一个完整项目补足岗位要求。' }] }, expression), 'UNSAFE_SUGGESTION')

const before = JSON.stringify(fixture('事实缺口'))
check(before !== JSON.stringify(fixture('事实缺口', true)), '跳过状态变化使 Diagnosis 输入失效')
check(before !== JSON.stringify({ ...fixture('事实缺口'), facts: [] }), 'Fact 变化使 Diagnosis 输入失效')
check(before !== JSON.stringify({ ...fixture('事实缺口'), mappings: [{ ...fixture('事实缺口').mappings[0], reason: '更新后的 Mapping' }] }), 'Mapping 变化使 Diagnosis 输入失效')
check(before !== JSON.stringify({ ...fixture('事实缺口'), gaps: [{ ...fixture('事实缺口').gaps[0], reason: '更新后的 Gap' }] }), 'Gap 变化使 Diagnosis 输入失效')
check(before !== JSON.stringify({ ...fixture('事实缺口'), requirements: [{ ...fixture('事实缺口').requirements[0], normalizedRequirement: '新的要求' }] }), 'Requirement 变化使 Diagnosis 输入失效')

const retryConfig = { maxRetries: 1, development: false }
let retryCalls = 0
const retried = await generateDiagnoses(retryConfig, expression, async () => {
  retryCalls += 1
  return retryCalls === 1
    ? { content: '{"diagnoses":[', finishReason: 'length' }
    : { content: JSON.stringify({ diagnoses: [model(expression.candidates[0], '表达泛化')] }), finishReason: 'stop' }
})
equal(retryCalls, 2, '首次非法 JSON 后只重试一次')
equal(retried.length, 1, '第二次合法响应成功生成 Diagnosis')

let invalidJsonCalls = 0
await generateDiagnoses(retryConfig, expression, async () => {
  invalidJsonCalls += 1
  return { content: invalidJsonCalls === 1 ? '{"diagnoses": [invalid]}' : JSON.stringify({ diagnoses: [model(expression.candidates[0], '表达泛化')] }), finishReason: 'stop' }
})
equal(invalidJsonCalls, 2, '普通非法 JSON 也只重试一次')

let failedCalls = 0
await failsAsync(() => generateDiagnoses(retryConfig, expression, async () => {
  failedCalls += 1
  return { content: '{"diagnoses":[', finishReason: 'length' }
}), 'OUTPUT_TRUNCATED')
equal(failedCalls, 2, '两次均失败后停止重试')

process.stdout.write(`${JSON.stringify({ ok: true, checks })}\n`)

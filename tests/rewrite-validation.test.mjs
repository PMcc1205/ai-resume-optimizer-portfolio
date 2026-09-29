import { generateRewriteValidations, parseRewriteValidationJson, REWRITE_VALIDATION_OUTPUT_CONTRACT, REWRITE_VALIDATION_PROMPT, validateRewriteValidationInput, validateRewriteValidationPayload } from '../server/rewriteValidation.js'
import { acceptButtonState, applyManualRewriteEdit, applyRewriteDecision, canEnterFinalResume, confirmRewriteFacts, finalRewriteText, mergeRegeneratedRewrite, mergeRewriteValidations, normalizeRewriteItems, normalizeRewriteValidationStatus, rejectButtonState } from '../src/services/rewriteState.js'
import { diagnosisDisplayNames, humanizeTechnicalError, stripInternalIdentifiers, validationReasonPresentation } from '../src/services/validationPresentation.js'

let checks = 0
const equal = (actual, expected, message) => { checks += 1; if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`) }
const fails = (fn, code, message) => { checks += 1; try { fn(); throw new Error(`${message}: expected failure`) } catch (error) { equal(error.code, code, message) } }

const fact = (overrides = {}) => ({ factId: 'fact-001', experienceId: 'exp-001', experienceName: '产品项目', content: '参与用户访谈并整理记录，完成 5 次访谈。', sourceText: '参与用户访谈并整理记录，完成 5 次访谈。', status: '已确认', requiresConfirmation: false, ...overrides })
const rewrite = (overrides = {}) => ({ rewriteId: 'rewrite-001', experienceId: 'exp-001', originalText: '整理用户访谈记录', optimizedText: '参与 5 次用户访谈并整理记录。', usedFactIds: ['fact-001'], requirementIds: ['req-001'], ...overrides })
const input = (overrides = {}) => validateRewriteValidationInput({ rewrites: [rewrite(overrides.rewrite)], facts: [fact(overrides.fact)], requirements: [{ requirementId: 'req-001', normalizedRequirement: '用户研究' }] })
const validPayload = (claim = {}) => ({ validations: [{ rewriteId: 'rewrite-001', reason: '所有声明均可追溯。', claims: [{ claimText: '参与 5 次用户访谈', claimType: '行动', supported: true, supportingFactIds: ['fact-001'], reason: 'Fact 明确支持。', ...claim }] }] })

equal(validateRewriteValidationPayload(validPayload(), input())[0].status, '校验通过', '真实 Rewrite 应通过')
equal(REWRITE_VALIDATION_OUTPUT_CONTRACT.validation.reason.required, true, '输出契约要求 validation.reason')
equal(REWRITE_VALIDATION_OUTPUT_CONTRACT.claim.supportingFactIds.allowEmpty, true, '输出契约允许无支撑时使用空 Fact 数组')
equal(REWRITE_VALIDATION_PROMPT.includes('校验通过示例'), true, 'Prompt 包含校验通过完整示例')
equal(REWRITE_VALIDATION_PROMPT.includes('校验不通过示例'), true, 'Prompt 包含校验不通过完整示例')
equal(REWRITE_VALIDATION_PROMPT.includes('无 supporting Fact 示例'), true, 'Prompt 包含无 supporting Fact 完整示例')
equal(REWRITE_VALIDATION_PROMPT.includes('即使已经发现一个不支持的 Claim'), true, 'Prompt 要求 Multi-risk 继续完整扫描')
equal(REWRITE_VALIDATION_PROMPT.includes('参加与参与'), true, 'Prompt 保护同级职责与压缩表达')
equal(validateRewriteValidationPayload(validPayload(), input({ rewrite: { optimizedText: '负责 5 次用户访谈并整理记录。' } }))[0].status, '校验不通过', '参与不得升级为负责')
equal(validateRewriteValidationPayload(validPayload(), input({ rewrite: { optimizedText: '主导 5 次用户访谈并整理记录。' } }))[0].status, '校验不通过', '参与不得升级为主导')
equal(validateRewriteValidationPayload(validPayload(), input({ rewrite: { optimizedText: '参与 6 次用户访谈并整理记录。' } }))[0].status, '校验不通过', '不得新增数字')
equal(validateRewriteValidationPayload(validPayload(), input({ rewrite: { optimizedText: '参与 5 次用户访谈并显著提升转化率。' } }))[0].status, '校验不通过', '不得新增结果')
equal(validateRewriteValidationPayload(validPayload(), input({ rewrite: { optimizedText: '参与 MVP 用户访谈并整理记录。' }, fact: { content: '参与用户访谈并整理记录，完成 5 次访谈。 MVP 阶段。', sourceText: '参与用户访谈并整理记录，完成 5 次访谈。 MVP 阶段。' } }))[0].status, '校验通过', 'MVP 有 Fact 支持时应通过')
equal(validateRewriteValidationPayload(validPayload(), input({ rewrite: { optimizedText: '参与正式上线用户访谈并整理记录。' } }))[0].status, '校验不通过', 'MVP 不得升级正式上线')
equal(validateRewriteValidationPayload(validPayload({ supported: false, reason: '无法从 Fact 支持。' }), input())[0].status, '校验不通过', 'unsupported claim 应不通过')
const capabilityInput = input({
  fact: { content: '熟悉 SQL 基础语法，能够阅读基础查询。', sourceText: '熟悉 SQL 基础语法，能够阅读基础查询。' },
  rewrite: { optimizedText: '掌握 SQL 基础语法，能够阅读基础查询。' },
})
const capabilityPayload = { validations: [{ rewriteId: 'rewrite-001', reason: '模型认为有支持。', claims: [{ claimText: '掌握 SQL 基础语法', claimType: '技术', supported: true, supportingFactIds: ['fact-001'], reason: 'Fact 提及 SQL。' }] }] }
equal(validateRewriteValidationPayload(capabilityPayload, capabilityInput)[0].reason.includes('能力程度超过 Fact 支持上限'), true, '熟悉不得升级为掌握，即使模型错误标为 supported')
const cleanDutyInput = input({
  fact: { content: '参加项目周会并整理待办。', sourceText: '参加项目周会并整理待办。' },
  rewrite: { optimizedText: '参与项目周会并整理待办。' },
})
const cleanDutyPayload = { validations: [{ rewriteId: 'rewrite-001', reason: '同级表达。', claims: [{ claimText: '参与项目周会并整理待办', claimType: '行动', supported: true, supportingFactIds: ['fact-001'], reason: '同一行动。' }] }] }
equal(validateRewriteValidationPayload(cleanDutyPayload, cleanDutyInput)[0].status, '校验通过', '参加与参与是同级表达，不应误判职责升级')
const naturalStageInput = input({
  fact: { content: '完成任务管理 MVP。', sourceText: '完成任务管理 MVP。' },
  rewrite: { optimizedText: '任务管理产品已投入正式使用。' },
})
const naturalStagePayload = { validations: [{ rewriteId: 'rewrite-001', reason: '模型认为有支持。', claims: [{ claimText: '投入正式使用', claimType: '项目状态', supported: true, supportingFactIds: ['fact-001'], reason: 'Fact 提及产品。' }] }] }
equal(validateRewriteValidationPayload(naturalStagePayload, naturalStageInput)[0].reason.includes('项目状态超过 Fact 支持上限'), true, 'MVP 不得通过自然语言包装为投入正式使用')
fails(() => validateRewriteValidationInput({ rewrites: [rewrite({ usedFactIds: ['fact-002'] })], facts: [fact()], requirements: [{ requirementId: 'req-001' }] }), 'INVALID_FACT_ID', 'usedFactId 不存在时应拒绝输入')
const crossInput = validateRewriteValidationInput({ rewrites: [rewrite({ usedFactIds: ['fact-001', 'fact-002'] })], facts: [fact(), fact({ factId: 'fact-002', experienceId: 'exp-002' })], requirements: [{ requirementId: 'req-001', normalizedRequirement: '用户研究' }] })
equal(validateRewriteValidationPayload({ validations: [{ rewriteId: 'rewrite-001', reason: '跨项目。', claims: [{ claimText: '跨项目事实', claimType: '行动', supported: true, supportingFactIds: ['fact-001', 'fact-002'], reason: '错误引用。' }] }] }, crossInput)[0].status, '校验不通过', '跨项目 Fact 应不通过')
equal(parseRewriteValidationJson('```json\n{"validations":[]}\n```').validations.length, 0, '应支持安全去除 JSON 代码块外壳')
fails(() => parseRewriteValidationJson('{"validations":['), 'OUTPUT_TRUNCATED', '截断 JSON 应失败')
let missingReasonError
try { validateRewriteValidationPayload({ validations: [{ rewriteId: 'rewrite-001', claims: [] }] }, input()) } catch (error) { missingReasonError = error }
equal(missingReasonError.code, 'SCHEMA_INVALID', '缺少 validation.reason 应返回 Schema 错误')
equal(missingReasonError.schemaErrors[0].errorPath, '$.validations[0].reason', 'Schema 错误应定位缺失字段')
equal(missingReasonError.schemaErrors[0].errorType, 'required', 'Schema 错误应标记 required')
equal(missingReasonError.schemaErrors[0].expected, 'string', 'Schema 错误应记录期望类型')
equal(missingReasonError.schemaErrors[0].actual, 'undefined', 'Schema 错误应记录实际类型')
let extraFieldError
try { validateRewriteValidationPayload({ validations: [{ ...validPayload().validations[0], status: '校验通过' }] }, input()) } catch (error) { extraFieldError = error }
equal(extraFieldError.schemaErrors[0].errorType, 'additional_property', '额外业务字段不得被静默删除')
let attempts = 0
const retryResult = await generateRewriteValidations({ maxRetries: 1 }, input(), async (_config, _input, hint) => {
  attempts += 1
  if (!hint) return { content: '{"validations": [', finishReason: null }
  return { content: JSON.stringify(validPayload()), finishReason: 'stop' }
})
equal(attempts, 2, '首次非法响应后应只重试一次')
equal(retryResult[0].status, '校验通过', '重试成功应返回通过')
let schemaAttempts = 0
let schemaRetryHint = ''
const attemptDiagnostics = []
await generateRewriteValidations({ maxRetries: 1 }, input(), async (_config, _input, hint) => {
  schemaAttempts += 1
  schemaRetryHint = hint
  if (!hint) return { content: JSON.stringify({ validations: [{ rewriteId: 'rewrite-001', claims: [] }] }), finishReason: 'stop' }
  return { content: JSON.stringify(validPayload()), finishReason: 'stop' }
}, { onAttempt(record) { attemptDiagnostics.push(record) } })
equal(schemaAttempts, 2, 'Schema 缺字段仍只有限重试一次')
equal(schemaRetryHint.includes('$.validations[0].reason'), true, '重试 Prompt 应指出具体错误路径')
equal(attemptDiagnostics[0].schemaErrors[0].errorType, 'required', '诊断回调应记录字段级 Schema 错误')
equal(attemptDiagnostics[1].errorCode, null, '诊断回调应记录重试成功')
const passed = { ...rewrite(), diagnosisId: 'diag-001', validationStatus: '校验通过', validation: { validatedText: rewrite().optimizedText, status: '校验通过' }, userDecision: '已接受' }
equal(canEnterFinalResume([passed]), true, '已接受且事实校验通过才可进入最终简历')
const edited = applyManualRewriteEdit([passed], passed.rewriteId, '参与 5 次用户访谈并整理记录，形成洞察。')[0]
equal(edited.validationStatus, '待事实校验', '手动修改后必须重新校验')
equal(edited.validation, undefined, '手动修改后清除旧校验详情')
const regenerated = mergeRegeneratedRewrite([passed], { ...rewrite(), diagnosisId: 'diag-001', optimizedText: '参与 5 次用户访谈，整理记录。' })[0]
equal(regenerated.validationStatus, '待事实校验', '重新生成后必须重新校验')
equal(canEnterFinalResume([{ ...passed, validationStatus: '待事实校验' }]), false, '待校验内容不得进入最终简历')
const failedAccepted = { ...passed, validationStatus: '校验不通过', validation: { ...passed.validation, status: '校验不通过', unsupportedClaims: ['新增职责'] } }
equal(canEnterFinalResume([failedAccepted]), false, '已接受但校验不通过不得进入最终简历')
const confirmed = confirmRewriteFacts([failedAccepted], failedAccepted.rewriteId)[0]
equal(confirmed.validationStatus, '校验通过', '用户确认真实后当前版本转为校验通过')
equal(confirmed.validation.confirmationMode, 'user-confirmed', '记录用户手动确认来源')
equal(confirmed.userDecision, '已接受', '手动确认不修改用户决策')
equal(canEnterFinalResume([confirmed]), true, '已接受且手动确认通过后允许进入结果页')
const pendingFailed = { ...failedAccepted, userDecision: '待处理' }
equal(canEnterFinalResume([confirmRewriteFacts([pendingFailed], pendingFailed.rewriteId)[0]]), false, '手动确认不等于接受，待处理仍阻塞结果页')
const lateAiResult = { validationId: 'validation-rewrite-001', rewriteId: failedAccepted.rewriteId, rewriteVersion: failedAccepted.version || 'v1', status: '校验不通过', claims: [], unsupportedClaims: ['旧请求结论'], usedFactIds: failedAccepted.usedFactIds, reason: '旧请求返回。', validatedText: failedAccepted.optimizedText }
equal(mergeRewriteValidations([confirmed], [lateAiResult])[0].validation.confirmationMode, 'user-confirmed', '旧 AI 校验请求不得覆盖用户手动确认')
const newVersion = applyManualRewriteEdit([failedAccepted], failedAccepted.rewriteId, '参与用户访谈并整理新记录。')[0]
equal(mergeRewriteValidations([newVersion], [lateAiResult])[0].validationStatus, '待事实校验', '旧版本校验不得覆盖新文本版本')
const refreshedConfirmed = normalizeRewriteItems(JSON.parse(JSON.stringify([confirmed])))[0]
equal(refreshedConfirmed.validationStatus, '校验通过', '刷新后保留用户手动确认状态')
equal(refreshedConfirmed.validation.confirmationMode, 'user-confirmed', '刷新后保留手动确认来源')

const stateItem = (userDecision, validationStatus, overrides = {}) => {
  const current = { ...rewrite(), version: 'v-state', diagnosisId: 'diag-state', userDecision, validationStatus, ...overrides }
  if (validationStatus !== '待事实校验' && !current.validation) current.validation = { validationId: 'validation-state', rewriteId: current.rewriteId, rewriteVersion: current.version, status: validationStatus, claims: [], unsupportedClaims: validationStatus === '校验不通过' ? ['不支持的声明'] : [], usedFactIds: current.usedFactIds, reason: '状态机测试', validatedText: current.editedText?.trim() || current.optimizedText }
  return current
}

const pendingPending = stateItem('待处理', '待事实校验')
equal(acceptButtonState(pendingPending).label, '接受', 'pending + pending 显示接受')
equal(rejectButtonState(pendingPending).label, '拒绝', 'pending + pending 显示拒绝')
equal(canEnterFinalResume([pendingPending]), false, 'pending + pending 阻塞结果页')

const pendingPassed = stateItem('待处理', '校验通过')
equal(acceptButtonState(pendingPassed).label, '接受', 'pending + passed 仍需用户接受')
equal(canEnterFinalResume([pendingPassed]), false, 'pending + passed 阻塞结果页')

const acceptedPending = applyRewriteDecision([pendingPending], pendingPending.rewriteId, '已接受')[0]
equal(acceptedPending.validationStatus, '待事实校验', 'accepted + pending 保持独立校验状态')
equal(canEnterFinalResume([acceptedPending]), false, 'accepted + pending 阻塞结果页')

const acceptedPassed = applyRewriteDecision([pendingPassed], pendingPassed.rewriteId, '已接受')[0]
equal(acceptButtonState(acceptedPassed).label, '已接受', 'accepted + passed 显示已接受')
equal(rejectButtonState(acceptedPassed).label, '改为拒绝', 'accepted + passed 可改为拒绝')
equal(canEnterFinalResume([acceptedPassed]), true, 'accepted + passed 允许结果页')

const acceptedFailed = stateItem('已接受', '校验不通过')
equal(acceptButtonState(acceptedFailed).label, '已接受', 'accepted + failed 保持已接受决策')
equal(canEnterFinalResume([acceptedFailed]), false, 'accepted + failed 阻塞结果页')

const rejectedPending = stateItem('已拒绝', '待事实校验')
equal(acceptButtonState(rejectedPending).label, '改为接受', 'rejected + pending 可改为接受')
equal(canEnterFinalResume([rejectedPending]), true, 'rejected + pending 可直接进入结果页')

const rejectedPassedState = stateItem('已拒绝', '校验通过')
equal(acceptButtonState(rejectedPassedState).label, '改为接受', 'rejected + passed 可改为接受')
equal(acceptButtonState(rejectedPassedState).disabled, false, 'rejected + passed 接受按钮可用')
const changedToAccepted = applyRewriteDecision([rejectedPassedState], rejectedPassedState.rewriteId, '已接受')[0]
equal(changedToAccepted.userDecision, '已接受', 'rejected + passed 改为 accepted')
equal(changedToAccepted.validationStatus, '校验通过', '改为接受不修改 passed')

const rejectedFailed = stateItem('已拒绝', '校验不通过')
equal(acceptButtonState(rejectedFailed).label, '校验未通过，无法接受', 'rejected + failed 明确禁止接受原因')
equal(acceptButtonState(rejectedFailed).disabled, true, 'rejected + failed 接受按钮禁用')
equal(rejectButtonState(rejectedFailed).label, '已拒绝', 'rejected + failed 保持已拒绝选中态')
equal(canEnterFinalResume([rejectedFailed]), true, 'rejected + failed 使用原文并允许结果页')

const matrixManual = applyManualRewriteEdit([acceptedPassed], acceptedPassed.rewriteId, '用户手动修改后的当前文本。')[0]
equal(matrixManual.userDecision, '待处理', 'manual edit 重置为 pending decision')
equal(matrixManual.validationStatus, '待事实校验', 'manual edit 重置为 pending validation')
equal(matrixManual.validation, undefined, 'manual edit 不继承旧 validation')

const matrixRegenerated = mergeRegeneratedRewrite([rejectedFailed], { ...rewrite(), diagnosisId: 'diag-state', optimizedText: '重新生成后的当前文本。' })[0]
equal(matrixRegenerated.userDecision, '待处理', 'regenerate 重置为 pending decision')
equal(matrixRegenerated.validationStatus, '待事实校验', 'regenerate 重置为 pending validation')
equal(matrixRegenerated.validation, undefined, 'regenerate 不继承旧 validation')

equal(canEnterFinalResume([acceptedPassed, rejectedPending, rejectedFailed]), true, '多条 accepted + passed 与 rejected 混合允许结果页')
equal(canEnterFinalResume([acceptedPassed, rejectedPending, acceptedPending]), false, '混合状态中 accepted + pending 阻塞结果页')
equal(finalRewriteText(acceptedPassed), acceptedPassed.optimizedText, 'accepted + passed 最终使用 AI Rewrite')
equal(finalRewriteText({ ...acceptedPassed, editedText: '用户手动版本。', validation: { ...acceptedPassed.validation, validatedText: '用户手动版本。' } }), '用户手动版本。', 'manual + accepted + passed 最终使用 editedText')
equal(finalRewriteText(rejectedFailed), rejectedFailed.originalText, 'rejected 最终使用 originalText')
equal(finalRewriteText(acceptedFailed), null, 'accepted + failed 没有可采用的最终文本')

const refreshedMatrix = normalizeRewriteItems(JSON.parse(JSON.stringify([acceptedPassed, rejectedPending, rejectedFailed])))
equal(refreshedMatrix[0].userDecision, '已接受', '刷新恢复 accepted')
equal(refreshedMatrix[0].validationStatus, '校验通过', '刷新恢复 passed')
equal(refreshedMatrix[1].userDecision, '已拒绝', '刷新恢复 rejected')
equal(refreshedMatrix[1].validationStatus, '待事实校验', '刷新恢复 pending validation')
equal(normalizeRewriteItems([{ ...pendingPending, userDecision: 'accepted', validationStatus: 'pending' }])[0].userDecision, '已接受', '兼容 accepted 状态值')
equal(normalizeRewriteValidationStatus('failed'), '校验不通过', '兼容 failed 校验状态值')

const staleVersion = { ...lateAiResult, rewriteVersion: 'v-old', validatedText: matrixManual.editedText, status: '校验通过' }
equal(mergeRewriteValidations([matrixManual], [staleVersion])[0].validationStatus, '待事实校验', '旧 validation version 不得覆盖 manual 新版本')
const presentationDiagnoses = [
  { diagnosisId: 'diag-002', primaryRequirementId: 'req-002', issueType: '关键行动不清' },
  { diagnosisId: 'diag-011', primaryRequirementId: 'req-011', issueType: '能力程度不足' },
]
const presentationRequirements = [
  { requirementId: 'req-002', capability: '需求定义与方案设计', normalizedRequirement: '完成需求定义与方案设计' },
  { requirementId: 'req-011', capability: 'AI 工具应用能力', normalizedRequirement: '应用 AI 工具' },
]
const displayNames = diagnosisDisplayNames(['diag-002', 'diag-011'], presentationDiagnoses, presentationRequirements)
equal(displayNames[0], '需求定义与方案设计表达', 'Diagnosis ID 映射为真实能力名称')
equal(displayNames.length, 2, '多 Diagnosis 显示多个问题名称')
equal(diagnosisDisplayNames(['diag-missing'], [], [])[0], '相关简历表达问题', '缺失 Diagnosis 使用安全兜底')
equal(humanizeTechnicalError('Rewrite diag-002、diag-011 的核心目的扩大了职责等级。').includes('diag-'), false, '主提示不显示 Diagnosis ID')
equal(stripInternalIdentifiers('覆盖 diag-002、diag-011 后优化。').includes('diag-'), false, '普通说明隐藏内部 ID')
equal(validationReasonPresentation('职责等级超过 Fact 支持上限').kind, 'duty', '职责升级使用专属文案')
equal(validationReasonPresentation('数字或口径无法追溯').kind, 'number', '数字问题使用专属文案')
equal(validationReasonPresentation('项目状态超过 Fact 支持上限').kind, 'project-status', '项目状态使用专属文案')
equal(validationReasonPresentation('声明没有得到 Fact 支持').kind, 'unsupported', '无事实支撑使用专属文案')
equal(validationReasonPresentation('存在跨项目信息').kind, 'cross-project', '跨项目使用专属文案')
process.stdout.write(`${JSON.stringify({ ok: true, checks })}\n`)

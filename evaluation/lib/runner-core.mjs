import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { calculateMatchAndGaps } from '../../src/services/matchGap.js'
import { generateRewriteValidations, validateRewriteValidationInput } from '../../server/rewriteValidation.js'

const EXACT_EXPECTED_FIELDS = new Map([
  ['expectedValidationStatus', 'validationStatus'],
  ['expectedMatchStatus', 'matchStatus'],
  ['expectedGapType', 'gapType'],
  ['expectedCapabilityGapSubtype', 'capabilityGapSubtype'],
  ['expectedRewritePermission', 'rewritePermission'],
  ['expectedRewriteCallAllowed', 'rewriteCallAllowed'],
])

export async function runEvaluation(cases, options = {}) {
  const results = []
  const validationExecutor = options.validationExecutor ?? ((config, input, diagnostics) => generateRewriteValidations(config, input, undefined, diagnostics))
  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index]
    options.onCaseStart?.(testCase, index, cases.length)
    const result = await runEvaluationCase(testCase, { config: options.config, validationExecutor, now: options.now })
    results.push(result)
    options.onCaseComplete?.(result, index, cases.length)
  }
  return { results, summary: buildSummary(results) }
}

export async function runEvaluationCase(testCase, { config = {}, validationExecutor = (modelConfig, input, diagnostics) => generateRewriteValidations(modelConfig, input, undefined, diagnostics), now = () => performance.now() } = {}) {
  const started = now()
  const modelAttempts = []
  try {
    const actual = {}
    if (hasMatchGold(testCase.expected)) Object.assign(actual, executeMatchGap(testCase))

    const rewriteCallAllowed = testCase.candidateUsedFactIds?.length > 0
      && testCase.confirmedFacts.some((fact) => fact.status === '已确认' && fact.requiresConfirmation === false)
      && actual.rewritePermission !== '不可改写'
    if ('expectedRewriteCallAllowed' in testCase.expected) actual.rewriteCallAllowed = rewriteCallAllowed

    if (rewriteCallAllowed && testCase.candidateRewrite) {
      const input = validateRewriteValidationInput(buildValidationInput(testCase))
      const validations = await validationExecutor(config, input, {
        onAttempt(record) { modelAttempts.push(sanitizeModelAttempt(record)) },
      })
      if (!Array.isArray(validations) || validations.length !== 1) throw executionError('VALIDATION_RESULT_INVALID', '事实校验没有返回唯一结果。')
      Object.assign(actual, presentValidation(validations[0], testCase))
      if (modelAttempts.some((attempt) => attempt.errorCode === 'SCHEMA_INVALID')) actual.evaluationDebug = { attempts: modelAttempts }
    } else if (testCase.expected.expectedValidationStatus) {
      throw executionError('VALIDATION_NOT_EXECUTED', '当前案例无法进入事实校验链路。')
    }

    if (actual.rewriteCallAllowed === false) actual.violationTypes = ['rewrite_not_allowed']
    const failedChecks = compareExpected(testCase, actual)
    return caseResult(testCase, actual, failedChecks.length === 0, failedChecks, Math.max(0, now() - started), null)
  } catch (error) {
    return caseResult(testCase, null, false, [], Math.max(0, now() - started), normalizeError(error, modelAttempts))
  }
}

export function compareExpected(testCase, actual) {
  const failed = []
  const expected = testCase.expected
  for (const [expectedKey, actualKey] of EXACT_EXPECTED_FIELDS) {
    if (expectedKey in expected && expected[expectedKey] !== actual[actualKey]) failed.push(`${expectedKey}: expected ${format(expected[expectedKey])}, actual ${format(actual[actualKey])}`)
  }

  if (expected.violationTypes) {
    const expectedTypes = normalizeExpectedViolations(expected.violationTypes, testCase)
    const actualTypes = new Set(actual.violationTypes ?? [])
    if (!sameSet(expectedTypes, actualTypes)) failed.push(`violationTypes: expected ${format([...expectedTypes].sort())}, actual ${format([...actualTypes].sort())}`)
  }
  if (expected.requiredFactIds) {
    const used = new Set(actual.usedFactIds ?? [])
    const missing = expected.requiredFactIds.filter((id) => !used.has(id))
    if (missing.length) failed.push(`requiredFactIds 缺失: ${missing.join('、')}`)
  }
  if (expected.forbiddenFactIds) {
    const invalid = new Set(actual.invalidFactIds ?? [])
    if (!sameSet(new Set(expected.forbiddenFactIds), invalid)) failed.push(`forbiddenFactIds: expected ${format([...expected.forbiddenFactIds].sort())}, actual ${format([...invalid].sort())}`)
  }
  if (expected.requiredClaims) {
    const evidence = actual.evidenceClaims ?? []
    const missing = expected.requiredClaims.filter((claim) => !evidence.some((actualClaim) => semanticMatch(claim, actualClaim)))
    if (missing.length) failed.push(`requiredClaims 未获得实际 Fact 支撑: ${missing.join('；')}`)
  }
  if (expected.forbiddenClaims) {
    const active = expected.forbiddenClaims.filter((claim) => semanticMatch(claim, testCase.candidateRewrite ?? ''))
    const extracted = actual.claims?.map((claim) => claim.claimText) ?? []
    const combinedClaims = extracted.join('；')
    const missing = actual.rewriteCallAllowed === false ? [] : active.filter((claim) => !extracted.some((actualClaim) => semanticMatch(claim, actualClaim)) && !semanticMatch(claim, combinedClaims))
    if (missing.length) failed.push(`forbiddenClaims 未被事实校验提取: ${missing.join('；')}`)
    if (active.length && actual.rewriteCallAllowed !== false && actual.validationStatus !== '校验不通过') failed.push('forbiddenClaims 出现在候选文本中，但 Validation 未判定为校验不通过')
  }
  return failed
}

export function buildSummary(results) {
  const errors = results.filter((item) => item.error)
  const judged = results.filter((item) => !item.error)
  const passed = judged.filter((item) => item.passed)
  const failed = judged.filter((item) => !item.passed)
  const byRiskTag = {}
  for (const result of results) for (const tag of result.riskTags) {
    const entry = byRiskTag[tag] ?? { total: 0, passed: 0, failed: 0, executionErrors: 0 }
    entry.total += 1
    if (result.error) entry.executionErrors += 1
    else if (result.passed) entry.passed += 1
    else entry.failed += 1
    byRiskTag[tag] = entry
  }
  return {
    totalCases: results.length,
    executedCases: judged.length,
    passedCases: passed.length,
    failedCases: failed.length,
    executionErrors: errors.length,
    passRate: judged.length ? passed.length / judged.length : null,
    byRiskTag,
    failedTestCaseIds: failed.map((item) => item.testCaseId),
    executionErrorTestCaseIds: errors.map((item) => item.testCaseId),
  }
}

export function writeEvaluationResults({ results, summary }, { resultsPath, summaryPath, generatedAt = new Date().toISOString(), evaluationId = 'high-risk-v1' }) {
  mkdirSync(dirname(resultsPath), { recursive: true })
  mkdirSync(dirname(summaryPath), { recursive: true })
  writeFileSync(resultsPath, `${JSON.stringify({ evaluationId, generatedAt, results }, null, 2)}\n`, 'utf8')
  writeFileSync(summaryPath, `${JSON.stringify({ evaluationId, generatedAt, ...summary }, null, 2)}\n`, 'utf8')
}

function buildValidationInput(testCase) {
  return {
    rewrites: [{
      rewriteId: `eval-${testCase.testCaseId}`,
      version: 'eval-v1',
      experienceId: testCase.candidateExperienceId,
      originalText: testCase.resumeText,
      optimizedText: testCase.candidateRewrite,
      usedFactIds: testCase.candidateUsedFactIds,
      requirementIds: ['req-eval'],
    }],
    facts: testCase.confirmedFacts,
    requirements: [{ requirementId: 'req-eval', normalizedRequirement: testCase.jdText }],
  }
}

function executeMatchGap(testCase) {
  const explicitFact = testCase.confirmedFacts.find((fact) => fact.status === '明确不存在')
  const requirementId = explicitFact?.sourceLocation?.match(/REQ-[\w-]+/i)?.[0] ?? 'req-eval'
  const requirement = {
    requirementId,
    normalizedRequirement: testCase.jdText,
    sourceText: testCase.jdText,
    capability: testCase.jdText,
    requiredLevel: /独立|主导|完整流程/.test(testCase.jdText) ? 'L4 设计 / 主导' : 'L3 实践',
    importance: '核心要求',
  }
  const usableFacts = testCase.confirmedFacts.filter((fact) => fact.status === '已确认' && fact.requiresConfirmation === false)
  const mapping = {
    mappingId: 'map-eval', requirementId, factIds: usableFacts.map((fact) => fact.factId),
    relevance: usableFacts.length ? '直接相关' : '无相关', evidenceStrength: usableFacts.length ? '强证据' : '无有效证据',
    evidenceLevel: inferEvidenceLevel(usableFacts), matchStatus: '待确认', reason: 'Evaluation 固定输入。', confidence: 1,
  }
  const result = calculateMatchAndGaps([requirement], testCase.confirmedFacts, [mapping])
  const evaluated = result.mappings[0]; const gap = result.gaps[0]
  return { matchStatus: evaluated.matchStatus, gapType: gap.gapType, capabilityGapSubtype: gap.capabilityGapSubtype, rewritePermission: gap.rewritePermission }
}

function presentValidation(validation, testCase) {
  const invalidFactIds = (testCase.candidateUsedFactIds ?? []).filter((id) => testCase.confirmedFacts.find((fact) => fact.factId === id)?.experienceId !== testCase.candidateExperienceId)
  return {
    validationStatus: validation.status,
    violationTypes: classifyViolations(validation, testCase),
    claims: validation.claims,
    unsupportedClaims: validation.unsupportedClaims,
    usedFactIds: validation.usedFactIds,
    invalidFactIds,
    evidenceClaims: validation.usedFactIds.flatMap((id) => {
      const fact = testCase.confirmedFacts.find((item) => item.factId === id)
      return fact ? [fact.content, fact.sourceText] : []
    }),
    reason: validation.reason,
    validationId: validation.validationId,
  }
}

const RESPONSIBILITY_LEVEL_PATTERNS = [
  [/(?:主导|核心负责人|第一负责人|项目负责人|产品负责人|统筹|全面负责)/i, 5],
  [/(?:独立负责|独立完成|独立输出|本人闭环|全程闭环|整体闭环)/i, 4],
  [/(?:负责)/i, 3],
  [/(?:组织)/i, 3],
  [/(?:参与|参加)/i, 2],
  [/(?:协助|配合)/i, 1],
]
const CAPABILITY_LEVEL_PATTERNS = [
  [/(?:精通|专家级|完整体系能力)/i, 4],
  [/(?:掌握|熟练使用|实践经验|能够独立)/i, 3],
  [/(?:熟悉)/i, 2],
  [/(?:了解)/i, 1],
]
const PROJECT_STAGE_PATTERN = /(?:正式上线|商业上线|生产环境|上线后|正式使用|投入使用|面向真实用户|稳定运行|内部测试|内测|最小可行产品|MVP|演示版本|Demo|原型|方案设计)/i
const EXPLICIT_OWNERSHIP_PATTERN = /(?:主导|核心负责人|第一负责人|项目负责人|产品负责人|独立负责|独立完成|本人闭环|全程闭环|统筹|整体|整个|全局|全流程|全过程|端到端)/i

export function classifyViolations(validation, testCase) {
  if (validation.status !== '校验不通过') return []
  const violations = new Set(); const reason = `${validation.reason}\n${validation.claims.map((claim) => claim.reason).join('\n')}`
  const candidate = testCase.candidateRewrite ?? ''; const factsText = testCase.confirmedFacts.map((fact) => `${fact.content}\n${fact.sourceText}`).join('\n')
  const hasProjectStatusUpgrade = /项目状态超过/.test(reason)
  if (/职责等级超过/.test(reason) && hasIndependentResponsibilityUpgrade(candidate, factsText, hasProjectStatusUpgrade)) violations.add('responsibility_upgrade')
  if (hasProjectStatusUpgrade) violations.add('project_status_upgrade')
  if (/跨项目/.test(reason)) violations.add('cross_project_fact')
  const candidateNumbers = numberExpressions(candidate); const factNumbers = numberExpressions(factsText)
  const unsupportedNumbers = candidateNumbers.filter((number) => !factNumbers.some((factNumber) => factNumber.raw === number.raw))
  if (unsupportedNumbers.length) {
    if (!factNumbers.length) violations.add('unsupported_number')
    else if (unsupportedNumbers.some((number) => factNumbers.some((factNumber) => factNumber.value === number.value))) violations.add('numeric_metric_changed')
    else violations.add('numeric_value_changed')
  }
  if (['提升', '提高', '降低', '增长', '转化', '留存', '满意度', '准确率', '形成用户洞察', '缩短', '改善', '稳定运行'].some((term) => candidate.includes(term) && !factsText.includes(term))) violations.add('unsupported_result')
  const unsupportedSignal = validation.unsupportedClaims.length > 0 || /无法支撑|没有.*支持|没有得到 Fact 支持|没有 supporting Fact/.test(reason)
  if (/Agent/i.test(candidate) && !/Agent/i.test(factsText) && unsupportedSignal) violations.add('unsupported_technology')
  if (/A\s*\/\s*B\s*测试/i.test(candidate) && !/A\s*\/\s*B\s*测试/i.test(factsText) && unsupportedSignal) violations.add('unsupported_experiment')
  if (/(?:整体|整个|全局|全流程)/.test(candidate) && /模块/.test(factsText) && unsupportedSignal) violations.add('responsibility_scope_expanded')
  if (/(?:完全满足|达到\s*L4|独立主导.{0,20}完整)/i.test(candidate) && /职责等级超过/.test(reason)) violations.add('capability_overstatement')
  if (/上线后迭代/.test(candidate) && !/上线后迭代/.test(factsText) && unsupportedSignal) violations.add('unsupported_claim')
  addClaimViolations(validation, candidate, factsText, reason, violations)
  return [...violations]
}

function addClaimViolations(validation, candidate, factsText, reason, violations) {
  for (const claim of validation.claims ?? []) {
    if (claim.supported !== false) continue
    const claimText = String(claim.claimText ?? '')
    const claimReason = String(claim.reason ?? '')
    const evidence = `${claimText}\n${claimReason}`
    const crossProject = /跨项目|其他项目|属于.*项目|不能跨项目|项目归属/.test(evidence)
    if (claim.claimType === '技术') {
      if (isCapabilityClaim(evidence, factsText)) violations.add('capability_overstatement')
      else if (!crossProject) violations.add('unsupported_technology')
    } else if (claim.claimType === '方法' || /(?:A\s*\/\s*B|灰度实验|可用性实验|实验验证|实验方法)/i.test(evidence)) {
      violations.add('unsupported_experiment')
    } else if (claim.claimType === '结果') {
      violations.add('unsupported_result')
    } else if (claim.claimType === '项目状态') {
      if (/(?:运营|迭代|维护)/.test(claimText) && !/(?:正式上线|正式使用|生产环境|投入使用|稳定运行)/.test(claimText)) violations.add('unsupported_claim')
      else violations.add('project_status_upgrade')
    } else if (claim.claimType === '职责') {
      if (/职责等级|ownership|闭环|统筹|主导|负责/.test(evidence) || hasIndependentResponsibilityUpgrade(claimText, factsText, false)) violations.add('responsibility_upgrade')
      else violations.add('unsupported_claim')
    } else if (claim.claimType === '数字') {
      if (crossProject) continue
      if (/(?:指标|口径|单位|统计对象|准确率|转化率|满意度|留存率)/.test(evidence)) violations.add('numeric_metric_changed')
      else if (claim.supportingFactIds?.length) violations.add('numeric_value_changed')
      else if (numberExpressions(claimText).length) violations.add('unsupported_number')
    } else {
      violations.add('unsupported_claim')
    }
  }
}

function isCapabilityClaim(evidence, factsText) {
  const candidateLevel = maxCapabilityLevel(evidence)
  const factLevel = maxCapabilityLevel(factsText)
  return candidateLevel > 0 && candidateLevel > factLevel && /(?:程度|熟悉|掌握|精通|熟练|实践|能力|能够)/.test(evidence)
}

function hasIndependentResponsibilityUpgrade(candidate, factsText, hasProjectStatusUpgrade) {
  const factLevel = maxResponsibilityLevel(factsText)
  return responsibilityClauses(candidate).some((clause) => {
    const candidateLevel = maxResponsibilityLevel(clause)
    if (candidateLevel <= factLevel) return false
    if (!hasProjectStatusUpgrade || !PROJECT_STAGE_PATTERN.test(clause)) return true
    return EXPLICIT_OWNERSHIP_PATTERN.test(clause)
  })
}

function responsibilityClauses(text) {
  return String(text).split(/(?:并且|同时|以及|并|且)|[，。；;、\n]|(?:→|->)/).map((part) => part.trim()).filter(Boolean)
}

function maxResponsibilityLevel(text) {
  return RESPONSIBILITY_LEVEL_PATTERNS.reduce((max, [pattern, level]) => pattern.test(String(text)) ? Math.max(max, level) : max, 0)
}

function maxCapabilityLevel(text) {
  return CAPABILITY_LEVEL_PATTERNS.reduce((max, [pattern, level]) => pattern.test(String(text)) ? Math.max(max, level) : max, 0)
}

function normalizeExpectedViolations(values, testCase) {
  const aliases = {
    '职责升级': 'responsibility_upgrade', '职责范围扩大': 'responsibility_scope_expanded', '项目状态升级': 'project_status_upgrade',
    '新增数字': 'unsupported_number', '无支撑结果': 'unsupported_result', '数字值改变': 'numeric_value_changed',
    '数字口径改变': 'numeric_metric_changed', '跨项目引用': 'cross_project_fact', '新增技术': 'unsupported_technology',
    '新增方法': 'unsupported_experiment', '错误改写权限': 'rewrite_not_allowed', '能力程度包装': 'capability_overstatement',
    '无支撑行动': 'unsupported_claim',
  }
  return new Set(values.map((value) => {
    if (value !== '虚构经历') return aliases[value] ?? value
    if (testCase.coverageKey === 'invent-agent-experience') return 'unsupported_technology'
    if (testCase.coverageKey === 'invent-ab-test') return 'unsupported_experiment'
    if (testCase.coverageKey === 'rewrite-explicit-absence') return 'rewrite_not_allowed'
    return 'unsupported_claim'
  }))
}

function numberExpressions(text) {
  return [...String(text).matchAll(/\d[\d,]*(?:\.\d+)?\+?\s*(?:%|％|条|名|人|次|轮|组|项|款|类|份|个|年|月|天)?/g)].map((match) => {
    const raw = match[0].replace(/\s+/g, '').replace(/,/g, '').replace(/％/g, '%')
    return { raw, value: raw.match(/^\d+(?:\.\d+)?\+?/)?.[0] ?? raw }
  })
}
function inferEvidenceLevel(facts) {
  const text = facts.map((fact) => `${fact.content}\n${fact.sourceText}`).join('\n')
  if (/主导|独立负责|独立完成/.test(text)) return 'L4 设计 / 主导'
  if (/参与|负责|完成|开展|使用/.test(text)) return 'L3 实践'
  if (/熟悉|理解/.test(text)) return 'L2 熟悉'
  return 'L1 了解'
}
function hasMatchGold(expected) { return ['expectedMatchStatus', 'expectedGapType', 'expectedCapabilityGapSubtype', 'expectedRewritePermission', 'expectedRewriteCallAllowed'].some((key) => key in expected) }
function semanticMatch(left, right) {
  const a = normalizeText(left); const b = normalizeText(right)
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return true
  const grams = bigrams(a); if (!grams.size) return false
  const other = bigrams(b); let overlap = 0; grams.forEach((gram) => { if (other.has(gram)) overlap += 1 })
  return overlap / Math.min(grams.size, other.size) >= 0.35
}
function normalizeText(text) { return String(text).toLowerCase().replace(/[\s，。、“”‘’（）()：:；;、/\\·…!?！？【】\[\]{}<>《》]/g, '') }
function bigrams(text) { const result = new Set(); for (let index = 0; index < text.length - 1; index += 1) result.add(text.slice(index, index + 2)); return result }
function sameSet(left, right) { return left.size === right.size && [...left].every((value) => right.has(value)) }
function format(value) { return JSON.stringify(value) }
function executionError(code, message) { const error = new Error(message); error.code = code; return error }
function normalizeError(error, modelAttempts = []) {
  const normalized = { code: typeof error?.code === 'string' ? error.code : 'EXECUTION_ERROR', message: error instanceof Error ? error.message : '未知执行错误' }
  if (Array.isArray(error?.schemaErrors) && error.schemaErrors.length) normalized.schemaErrors = error.schemaErrors
  if (modelAttempts.length) normalized.evaluationDebug = { attempts: modelAttempts }
  return normalized
}

function sanitizeModelAttempt(record) {
  return {
    attempt: Number.isInteger(record?.attempt) ? record.attempt : null,
    finishReason: typeof record?.finishReason === 'string' ? record.finishReason : null,
    errorCode: typeof record?.errorCode === 'string' ? record.errorCode : null,
    schemaErrors: Array.isArray(record?.schemaErrors) ? record.schemaErrors.map((issue) => ({
      errorPath: String(issue.errorPath ?? ''),
      errorType: String(issue.errorType ?? ''),
      expected: String(issue.expected ?? ''),
      actual: String(issue.actual ?? ''),
    })) : [],
    responsePreview: sanitizeResponsePreview(record?.responseContent),
  }
}

function sanitizeResponsePreview(content) {
  if (typeof content !== 'string' || !content.trim()) return null
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return sanitizeJsonValue(JSON.parse(cleaned), 0) } catch { return cleaned.slice(0, 1000) }
}

function sanitizeJsonValue(value, depth) {
  if (depth >= 6) return '<max-depth>'
  if (typeof value === 'string') return value.slice(0, 300)
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeJsonValue(item, depth + 1))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => [key, sanitizeJsonValue(item, depth + 1)]))
  return String(value)
}
function caseResult(testCase, actual, passed, failedChecks, latencyMs, error) {
  return { testCaseId: testCase.testCaseId, title: testCase.title, riskTags: testCase.riskTags, targetModule: testCase.targetModule, expected: testCase.expected, actual, passed, failedChecks, latencyMs: Math.round(latencyMs), error }
}

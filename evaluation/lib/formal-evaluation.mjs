import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateSchema } from './case-loader.mjs'

const STATUS_MAP = {
  confirmed: '已确认',
  explicit_absence: '明确不存在',
  unconfirmed: '待确认',
}

export function loadFrozenEvaluationDataset({ manifestPath, projectRoot }) {
  const manifest = parseJson(manifestPath, 'Dataset Manifest')
  if (manifest.status !== 'frozen') throw new Error('Dataset Manifest 未处于 frozen 状态。')
  if (manifest.datasetVersion !== 'automatic-evaluation-v1') throw new Error(`不支持的数据集版本：${manifest.datasetVersion}`)
  if (manifest.goldAudit?.needsReviewCount !== 0 || manifest.goldAudit?.ambiguousCount !== 0 || manifest.goldAudit?.duplicateCount !== 0) {
    throw new Error('冻结数据集仍包含未处置的 Gold Audit 问题。')
  }

  const sourcePath = resolve(projectRoot, manifest.sourceDevelopmentDataset.path)
  const schemaPath = resolve(projectRoot, manifest.schema.path)
  const automaticPath = resolve(projectRoot, manifest.automaticDataset.path)
  const humanPath = resolve(projectRoot, manifest.humanRubricDataset.path)
  verifyHash(sourcePath, manifest.sourceDevelopmentDataset.sha256, 'Development Dataset')
  verifyHash(schemaPath, manifest.schema.sha256, 'Dataset Schema')
  verifyHash(automaticPath, manifest.automaticDataset.sha256, 'Automatic Dataset')
  verifyHash(humanPath, manifest.humanRubricDataset.sha256, 'Human Rubric Dataset')

  const schema = parseJson(schemaPath, 'Dataset Schema')
  const sourceCases = parseJsonl(sourcePath, 'Development Dataset')
  const cases = parseJsonl(automaticPath, 'Automatic Dataset')
  const humanCases = parseJsonl(humanPath, 'Human Rubric Dataset')
  for (const testCase of [...cases, ...humanCases]) validateSchema(testCase, schema)

  assertUnique(cases.map((item) => item.caseId), 'Automatic Dataset caseId')
  assertUnique(humanCases.map((item) => item.caseId), 'Human Rubric Dataset caseId')
  assertExactList(cases.map((item) => item.caseId), manifest.automaticDataset.caseIds, 'Automatic Dataset caseIds')
  assertExactList(humanCases.map((item) => item.caseId), manifest.humanRubricDataset.caseIds, 'Human Rubric Dataset caseIds')
  if (cases.length !== manifest.automaticDataset.caseCount) throw new Error('Automatic Dataset 数量与 Manifest 不一致。')
  if (humanCases.length !== manifest.humanRubricDataset.caseCount) throw new Error('Human Rubric Dataset 数量与 Manifest 不一致。')
  if (sourceCases.length !== manifest.sourceDevelopmentDataset.caseCount) throw new Error('Development Dataset 数量与 Manifest 不一致。')

  const removedIds = manifest.removedDuplicates.map((item) => item.caseId)
  const dispositionIds = [...cases.map((item) => item.caseId), ...humanCases.map((item) => item.caseId), ...removedIds]
  assertUnique(dispositionIds, '最终审计处置 caseId')
  assertExactSet(dispositionIds, sourceCases.map((item) => item.caseId), '最终审计处置必须覆盖全部 Development Case')

  return {
    manifest,
    cases,
    humanCases,
    schema,
    paths: { sourcePath, schemaPath, automaticPath, humanPath },
  }
}

export function adaptFrozenCase(testCase) {
  const confirmedFacts = testCase.sourceFacts.map((fact, index) => ({
    factId: fact.factId,
    experienceId: fact.experienceId,
    experienceName: fact.experienceId,
    content: fact.text,
    sourceText: fact.text,
    sourceLocation: `${testCase.caseId} · Source Fact ${index + 1}`,
    type: inferFactType(testCase.expectedViolations),
    status: STATUS_MAP[fact.status],
    requiresConfirmation: fact.status !== 'confirmed',
  }))
  const shouldRunValidation = testCase.expectedValidation !== 'not_run'
  const candidateUsedFactIds = shouldRunValidation
    ? testCase.sourceFacts.filter((fact) => fact.status === 'confirmed').map((fact) => fact.factId)
    : []
  const expected = testCase.expectedValidation === 'not_run'
    ? { expectedRewriteCallAllowed: false, violationTypes: testCase.expectedViolations, acceptanceCriteria: [testCase.rationale] }
    : {
        expectedValidationStatus: testCase.expectedValidation === 'pass' ? '校验通过' : '校验不通过',
        violationTypes: testCase.expectedViolations,
        acceptanceCriteria: [testCase.rationale],
      }
  return {
    testCaseId: testCase.caseId,
    title: testCase.title,
    category: testCase.category,
    sourceType: testCase.sourceType,
    riskTags: testCase.expectedViolations.length ? [...testCase.expectedViolations] : ['clean'],
    targetModule: shouldRunValidation ? 'post-generation-validation' : 'rewrite-permission',
    targetRole: '简历候选人',
    jdText: '在不改变事实的前提下优化简历表达。',
    resumeText: testCase.sourceFacts.map((fact) => fact.text).join('\n'),
    confirmedFacts,
    candidateRewrite: testCase.candidateText,
    candidateExperienceId: testCase.candidateExperienceId,
    candidateUsedFactIds,
    expected,
    notes: testCase.rationale,
  }
}

export function buildFormalCaseResult(sourceCase, runnerResult, attemptRecords = []) {
  const status = runnerResult.error ? 'ERROR' : runnerResult.passed ? 'PASS' : 'FAIL'
  const attempts = attemptRecords.map(sanitizeAttempt)
  const lastAttempt = attempts.at(-1) ?? null
  const schemaErrors = runnerResult.error?.schemaErrors
    ?? attempts.flatMap((attempt) => attempt.schemaErrors).filter((issue, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(issue)) === index)
  return {
    testCaseId: sourceCase.caseId,
    title: sourceCase.title,
    category: sourceCase.category,
    riskTags: [...sourceCase.expectedViolations],
    expected: {
      validationStatus: sourceCase.expectedValidation,
      violationTypes: [...sourceCase.expectedViolations],
      rationale: sourceCase.rationale,
    },
    actual: runnerResult.actual,
    status,
    passed: status === 'PASS',
    failedChecks: [...runnerResult.failedChecks],
    violationTypesExpected: [...sourceCase.expectedViolations].sort(),
    violationTypesActual: [...new Set(runnerResult.actual?.violationTypes ?? [])].sort(),
    attempts: attempts.length,
    modelRetryOccurred: attempts.length > 1,
    latencyMs: runnerResult.latencyMs,
    finishReason: lastAttempt?.finishReason ?? null,
    errorCode: runnerResult.error?.code ?? null,
    error: runnerResult.error ? { code: runnerResult.error.code, message: runnerResult.error.message } : null,
    schemaErrors,
    modelAttempts: attempts.map((attempt) => ({
      attempt: attempt.attempt,
      finishReason: attempt.finishReason,
      errorCode: attempt.errorCode,
      schemaErrors: attempt.schemaErrors,
      ...(attempt.errorCode || attempts.length > 1 ? { responsePreview: attempt.responsePreview } : {}),
    })),
  }
}

export function buildFormalSummary(results, { pendingHumanReview = 0 } = {}) {
  const passCases = results.filter((item) => item.status === 'PASS')
  const failCases = results.filter((item) => item.status === 'FAIL')
  const errorCases = results.filter((item) => item.status === 'ERROR')
  const executedCases = passCases.length + failCases.length
  const categories = Object.fromEntries(['normal-clean', 'single-risk', 'multi-risk', 'boundary', 'adversarial'].map((category) => [category, categorySummary(results.filter((item) => item.category === category))]))
  const clean = categories['normal-clean']
  clean.falsePositiveCount = results.filter((item) => item.category === 'normal-clean' && item.status === 'FAIL').length
  clean.falsePositiveRate = clean.pass + clean.fail ? clean.falsePositiveCount / (clean.pass + clean.fail) : null

  const singleRisk = buildSingleRiskSummary(results.filter((item) => item.category === 'single-risk'))
  const multiRisk = buildMultiRiskSummary(results.filter((item) => item.category === 'multi-risk'))
  const violationTypeMetrics = buildViolationMetrics(results)
  const failures = failCases.map(classifyFailure)
  const executionErrors = errorCases.map(classifyExecutionError)
  const successfulResults = results.filter((item) => item.status !== 'ERROR')
  return {
    totalCases: results.length,
    executedCases,
    passCases: passCases.length,
    failCases: failCases.length,
    errorCases: errorCases.length,
    executionSuccessRate: ratio(executedCases, results.length),
    casePassRate: ratio(passCases.length, executedCases),
    rawPassRate: ratio(passCases.length, results.length),
    pendingHumanReview,
    categories,
    clean,
    singleRisk,
    multiRisk,
    boundary: categories.boundary,
    adversarial: categories.adversarial,
    violationTypeMetrics,
    failures,
    executionErrors,
    failedTestCaseIds: failCases.map((item) => item.testCaseId),
    executionErrorTestCaseIds: errorCases.map((item) => item.testCaseId),
    schemaInvalidCount: errorCases.filter((item) => item.errorCode === 'SCHEMA_INVALID').length,
    modelRetryCaseCount: results.filter((item) => item.modelRetryOccurred).length,
    totalModelRetries: results.reduce((total, item) => total + Math.max(0, item.attempts - 1), 0),
    latency: {
      overall: latencySummary(results.map((item) => item.latencyMs)),
      successfulCalls: latencySummary(successfulResults.map((item) => item.latencyMs)),
    },
  }
}

export function buildFormalReport({ manifest, summary, generatedAt }) {
  const lines = [
    '# 15｜AI Evaluation',
    '',
    '## 一、Evaluation 目标',
    '',
    '使用冻结的 `automatic-evaluation-v1` 对当前真实生成后事实校验链路建立第一次正式 Baseline。本轮不修改 Prompt、Schema、Gold、产品规则或模型配置。',
    '',
    '## 二、数据集',
    '',
    `- Dataset：${manifest.datasetVersion}`,
    `- 自动案例：${summary.totalCases}`,
    `- 待人工评审：${summary.pendingHumanReview}（不进入自动指标分母）`,
    `- 运行时间：${generatedAt}`,
    '',
    '## 三、评估方法',
    '',
    '每条 Case 通过现有 Evaluation Runner 调用真实 Validation 链路；需要模型判断的案例调用当前 DeepSeek 配置。PASS、FAIL、ERROR 分开统计，ERROR 不作为普通判断失败。',
    '',
    '## 四、指标定义',
    '',
    '- executionSuccessRate = (PASS + FAIL) / totalCases',
    '- casePassRate = PASS / (PASS + FAIL)',
    '- rawPassRate = PASS / totalCases',
    '- violation Precision / Recall / F1 仅使用成功形成判断的 Case。',
    '',
    '## 五、Baseline 结果',
    '',
    '| 指标 | 结果 |',
    '| --- | ---: |',
    `| Total | ${summary.totalCases} |`,
    `| PASS | ${summary.passCases} |`,
    `| FAIL | ${summary.failCases} |`,
    `| ERROR | ${summary.errorCases} |`,
    `| executionSuccessRate | ${formatRate(summary.executionSuccessRate)} |`,
    `| casePassRate | ${formatRate(summary.casePassRate)} |`,
    `| rawPassRate | ${formatRate(summary.rawPassRate)} |`,
    '',
    '## 六、分类结果',
    '',
    '| 类别 | Total | PASS | FAIL | ERROR | Pass Rate |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(summary.categories).map(([category, value]) => `| ${category} | ${value.total} | ${value.pass} | ${value.fail} | ${value.error} | ${formatRate(value.passRate)} |`),
    '',
    `Clean False Positive：${summary.clean.falsePositiveCount}（${formatRate(summary.clean.falsePositiveRate)}）`,
    '',
    `Multi-risk：Exact ${summary.multiRisk.exactMatchCount} / Partial ${summary.multiRisk.partialMatchCount} / Complete Miss ${summary.multiRisk.completeMissCount} / ERROR ${summary.multiRisk.errorCount}`,
    '',
    '### Violation Type',
    '',
    '| Violation | Gold | TP | FP | FN | Precision | Recall | F1 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(summary.violationTypeMetrics).map(([type, value]) => `| ${type} | ${value.goldCount} | ${value.tp} | ${value.fp} | ${value.fn} | ${formatRate(value.precision)} | ${formatRate(value.recall)} | ${formatRate(value.f1)} |`),
    '',
    '## 七、Failure Cases',
    '',
    ...(summary.failures.length ? summary.failures.map((failure) => `- ${failure.testCaseId}：${failure.failureType}；missing=${failure.missingTypes.join(', ') || '无'}；extra=${failure.extraTypes.join(', ') || '无'}`) : ['无。']),
    '',
    '## 八、Execution Errors',
    '',
    ...(summary.executionErrors.length ? summary.executionErrors.map((error) => `- ${error.testCaseId}：${error.errorType}（${error.errorCode ?? '无错误码'}）`) : ['无。']),
    '',
    '## 九、延迟',
    '',
    `- 平均：${formatLatency(summary.latency.overall.averageMs)}`,
    `- P50：${formatLatency(summary.latency.overall.p50Ms)}`,
    `- P95：${formatLatency(summary.latency.overall.p95Ms)}`,
    '',
    '## 十、阶段结论与下一轮方向',
    '',
    '本报告仅记录本次真实 Baseline。失败与执行错误保留原样，下一轮应先依据 Failure Analysis 选择是否进入 Prompt、规则或结构稳定性迭代，不在本轮修改。',
    '',
  ]
  return `${lines.join('\n')}\n`
}

function buildSingleRiskSummary(results) {
  const byViolationType = {}
  for (const result of results) {
    const expectedType = result.violationTypesExpected[0]
    const entry = byViolationType[expectedType] ?? { goldCount: 0, correctIdentificationCount: 0, missedCount: 0, wrongClassificationCount: 0, extraClassificationCount: 0, errorCount: 0 }
    entry.goldCount += 1
    if (result.status === 'ERROR') entry.errorCount += 1
    else if (result.violationTypesActual.includes(expectedType)) {
      entry.correctIdentificationCount += 1
      if (result.violationTypesActual.some((type) => type !== expectedType)) entry.extraClassificationCount += 1
    } else {
      entry.missedCount += 1
      if (result.violationTypesActual.length) entry.wrongClassificationCount += 1
    }
    byViolationType[expectedType] = entry
  }
  return { ...categorySummary(results), byViolationType }
}

function buildMultiRiskSummary(results) {
  let exactMatchCount = 0; let partialMatchCount = 0; let completeMissCount = 0; let errorCount = 0
  const cases = results.map((result) => {
    const expected = new Set(result.violationTypesExpected); const actual = new Set(result.violationTypesActual)
    const missingTypes = [...expected].filter((type) => !actual.has(type)).sort()
    const extraTypes = [...actual].filter((type) => !expected.has(type)).sort()
    let matchStatus = 'ERROR'
    if (result.status === 'ERROR') errorCount += 1
    else if (!missingTypes.length && !extraTypes.length) { exactMatchCount += 1; matchStatus = 'EXACT_MATCH' }
    else if ([...expected].some((type) => actual.has(type))) { partialMatchCount += 1; matchStatus = 'PARTIAL_MATCH' }
    else { completeMissCount += 1; matchStatus = 'COMPLETE_MISS' }
    return { testCaseId: result.testCaseId, status: result.status, matchStatus, expectedViolationTypes: [...expected].sort(), actualViolationTypes: [...actual].sort(), missingTypes, extraTypes }
  })
  return { ...categorySummary(results), exactMatchCount, partialMatchCount, completeMissCount, errorCount, cases }
}

function buildViolationMetrics(results) {
  const judged = results.filter((item) => item.status !== 'ERROR')
  const labels = [...new Set(judged.flatMap((item) => [...item.violationTypesExpected, ...item.violationTypesActual]))].sort()
  return Object.fromEntries(labels.map((label) => {
    const goldCount = results.filter((item) => item.violationTypesExpected.includes(label)).length
    const tp = judged.filter((item) => item.violationTypesExpected.includes(label) && item.violationTypesActual.includes(label)).length
    const fp = judged.filter((item) => !item.violationTypesExpected.includes(label) && item.violationTypesActual.includes(label)).length
    const fn = judged.filter((item) => item.violationTypesExpected.includes(label) && !item.violationTypesActual.includes(label)).length
    const precision = ratio(tp, tp + fp); const recall = ratio(tp, tp + fn)
    const f1 = precision == null || recall == null || precision + recall === 0 ? null : 2 * precision * recall / (precision + recall)
    return [label, { goldCount, tp, fp, fn, precision, recall, f1 }]
  }))
}

function classifyFailure(result) {
  const expected = new Set(result.violationTypesExpected); const actual = new Set(result.violationTypesActual)
  const missingTypes = [...expected].filter((type) => !actual.has(type)).sort()
  const extraTypes = [...actual].filter((type) => !expected.has(type)).sort()
  let failureType = 'OTHER'
  if (result.category === 'normal-clean') failureType = 'OVER_BLOCKING'
  else if (result.category === 'multi-risk' && missingTypes.length && [...expected].some((type) => actual.has(type))) failureType = 'PARTIAL_MULTI_RISK'
  else if (missingTypes.includes('capability_overstatement')) failureType = 'CAPABILITY_LEVEL_ERROR'
  else if (missingTypes.includes('cross_project_fact')) failureType = 'CROSS_PROJECT_ERROR'
  else if (missingTypes.some((type) => type.includes('numeric') || type === 'unsupported_number')) failureType = 'NUMERIC_REASONING_ERROR'
  else if (missingTypes.some((type) => type.startsWith('responsibility_'))) failureType = 'RESPONSIBILITY_REASONING_ERROR'
  else if (missingTypes.length) failureType = 'MISSED_RISK'
  else if (extraTypes.length) failureType = 'WRONG_VIOLATION_TYPE'
  return { testCaseId: result.testCaseId, category: result.category, failureType, expectedViolationTypes: [...expected].sort(), actualViolationTypes: [...actual].sort(), missingTypes, extraTypes, failedChecks: result.failedChecks }
}

function classifyExecutionError(result) {
  const aliases = { MODEL_TIMEOUT: 'TIMEOUT', INVALID_JSON: 'JSON_INVALID', SCHEMA_INVALID: 'SCHEMA_INVALID', MODEL_CALL_FAILED: 'MODEL_CALL_FAILED' }
  return {
    testCaseId: result.testCaseId,
    category: result.category,
    errorCode: result.errorCode,
    errorType: aliases[result.errorCode] ?? (result.errorCode?.includes('INTERNAL') ? 'INTERNAL_ERROR' : 'OTHER'),
    attempts: result.attempts,
    retried: result.modelRetryOccurred,
    formedJudgment: false,
    schemaErrors: result.schemaErrors,
  }
}

function categorySummary(results) {
  const pass = results.filter((item) => item.status === 'PASS').length
  const fail = results.filter((item) => item.status === 'FAIL').length
  const error = results.filter((item) => item.status === 'ERROR').length
  return { total: results.length, pass, fail, error, passRate: ratio(pass, pass + fail) }
}

function latencySummary(values) {
  const valid = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!valid.length) return { count: 0, averageMs: null, p50Ms: null, p95Ms: null }
  return {
    count: valid.length,
    averageMs: Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length),
    p50Ms: percentile(valid, 0.5),
    p95Ms: percentile(valid, 0.95),
  }
}

function percentile(sorted, quantile) { return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)] }
function ratio(numerator, denominator) { return denominator ? numerator / denominator : null }
function formatRate(value) { return value == null ? '不适用' : `${(value * 100).toFixed(2)}%` }
function formatLatency(value) { return value == null ? '不适用' : `${value} ms` }

function sanitizeAttempt(record) {
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
  try { return sanitizeValue(JSON.parse(cleaned), 0) } catch { return cleaned.slice(0, 1000) }
}

function sanitizeValue(value, depth) {
  if (depth >= 6) return '<max-depth>'
  if (typeof value === 'string') return value.slice(0, 300)
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => [key, sanitizeValue(item, depth + 1)]))
  return String(value)
}

function inferFactType(violations) {
  if (violations.some((value) => value.startsWith('responsibility_'))) return '职责事实'
  if (violations.includes('project_status_upgrade')) return '项目状态事实'
  if (violations.some((value) => value.includes('numeric') || value === 'unsupported_number')) return '数字事实'
  if (violations.includes('unsupported_technology')) return '技术事实'
  if (violations.includes('unsupported_result')) return '结果事实'
  return '行动事实'
}

function parseJson(path, label) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch (error) { throw new Error(`${label} 不是合法 JSON：${error.message}`) }
}

function parseJsonl(path, label) {
  return readFileSync(path, 'utf8').split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    try { return JSON.parse(line) } catch (error) { throw new Error(`${label} 第 ${index + 1} 行不是合法 JSON：${error.message}`) }
  })
}

function verifyHash(path, expected, label) {
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (actual !== expected) throw new Error(`${label} SHA-256 与 Manifest 不一致：expected ${expected}, actual ${actual}`)
}

function assertUnique(values, label) { if (new Set(values).size !== values.length) throw new Error(`${label} 包含重复值。`) }
function assertExactList(actual, expected, label) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} 与 Manifest 不一致。`) }
function assertExactSet(actual, expected, label) {
  const left = new Set(actual); const right = new Set(expected)
  if (left.size !== right.size || [...left].some((value) => !right.has(value))) throw new Error(`${label}。`)
}

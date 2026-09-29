import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { adaptFrozenCase, buildFormalCaseResult, buildFormalReport, buildFormalSummary, loadFrozenEvaluationDataset } from '../evaluation/lib/formal-evaluation.mjs'

let checks = 0
const check = (value, message) => { assert.ok(value, message); checks += 1 }
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1 }

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const manifestPath = fileURLToPath(new URL('../evaluation/datasets/evaluation-dataset-v1.manifest.json', import.meta.url))
const frozen = loadFrozenEvaluationDataset({ manifestPath, projectRoot })
equal(frozen.cases.length, 61, '冻结自动集包含 61 条')
equal(frozen.humanCases.length, 1, '人工 Rubric 包含 1 条')

const cleanSource = frozen.cases.find((item) => item.caseId === 'DEV-CLN-001')
const clean = adaptFrozenCase(cleanSource)
equal(clean.expected.expectedValidationStatus, '校验通过', 'PASS Gold 适配为校验通过')
equal(clean.expected.violationTypes.length, 0, 'Clean 不含 violation')
check(clean.candidateUsedFactIds.length > 0, '需要 Validation 的案例保留 Fact')

const notRunSource = frozen.cases.find((item) => item.expectedValidation === 'not_run')
const notRun = adaptFrozenCase(notRunSource)
equal(notRun.expected.expectedRewriteCallAllowed, false, 'not_run 适配为禁止 Rewrite 调用')
equal(notRun.candidateUsedFactIds.length, 0, 'not_run 不调用模型 Validation')

const passResult = buildFormalCaseResult(cleanSource, { actual: { validationStatus: '校验通过', violationTypes: [] }, passed: true, failedChecks: [], latencyMs: 100, error: null }, [{ attempt: 1, finishReason: 'stop', errorCode: null, schemaErrors: [], responseContent: '{"validations":[]}'}])
equal(passResult.status, 'PASS', '正式结果区分 PASS')
equal(passResult.attempts, 1, '正式结果保存模型尝试次数')
equal(passResult.finishReason, 'stop', '正式结果保存 finishReason')

const riskSource = frozen.cases.find((item) => item.caseId === 'DEV-MLT-001')
const failResult = buildFormalCaseResult(riskSource, { actual: { validationStatus: '校验不通过', violationTypes: ['responsibility_upgrade'] }, passed: false, failedChecks: ['violationTypes mismatch'], latencyMs: 200, error: null }, [{ attempt: 1, finishReason: 'stop', errorCode: null, schemaErrors: [], responseContent: '{}'}])
const errorSource = frozen.cases.find((item) => item.caseId === 'DEV-SNG-001')
const errorResult = buildFormalCaseResult(errorSource, { actual: null, passed: false, failedChecks: [], latencyMs: 300, error: { code: 'SCHEMA_INVALID', message: 'schema', schemaErrors: [{ errorPath: '$.reason', errorType: 'required', expected: 'string', actual: 'undefined' }] } }, [{ attempt: 1, finishReason: 'stop', errorCode: 'SCHEMA_INVALID', schemaErrors: [{ errorPath: '$.reason', errorType: 'required', expected: 'string', actual: 'undefined' }], responseContent: '{"validations":[]}'}])
const summary = buildFormalSummary([passResult, failResult, errorResult], { pendingHumanReview: 1 })
equal(summary.passCases, 1, 'summary PASS 正确')
equal(summary.failCases, 1, 'summary FAIL 正确')
equal(summary.errorCases, 1, 'summary ERROR 正确')
equal(summary.executionSuccessRate, 2 / 3, 'executionSuccessRate 不混入判断正确率')
equal(summary.casePassRate, 0.5, 'casePassRate 仅使用已形成判断案例')
equal(summary.rawPassRate, 1 / 3, 'rawPassRate 使用全部案例')
equal(summary.multiRisk.partialMatchCount, 1, 'Multi-risk 部分识别计为 Partial Match')
equal(summary.schemaInvalidCount, 1, 'SCHEMA_INVALID 单独统计')
equal(summary.pendingHumanReview, 1, '人工 Rubric 不进入自动分母')
check(buildFormalReport({ manifest: frozen.manifest, summary, generatedAt: '2026-09-20T00:00:00.000Z' }).includes('executionSuccessRate'), '正式报告包含指标定义和真实汇总字段')

process.stdout.write(`${JSON.stringify({ ok: true, checks })}\n`)

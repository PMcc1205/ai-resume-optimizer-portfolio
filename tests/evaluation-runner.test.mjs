import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEvaluationCases } from '../evaluation/lib/case-loader.mjs'
import { buildSummary, classifyViolations, compareExpected, runEvaluation, writeEvaluationResults } from '../evaluation/lib/runner-core.mjs'

let checks = 0
const check = (value, message) => { assert.ok(value, message); checks += 1 }
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1 }
const throws = (run, pattern, message) => { assert.throws(run, pattern, message); checks += 1 }
const casesPath = fileURLToPath(new URL('../evaluation/cases/high-risk-v1.jsonl', import.meta.url))
const schemaPath = fileURLToPath(new URL('../evaluation/schema/test-case.schema.json', import.meta.url))

const loaded = loadEvaluationCases({ casesPath, schemaPath })
equal(loaded.cases.length, 12, '正常 JSONL 加载 12 个案例')

const temp = mkdtempSync(join(tmpdir(), 'resume-eval-runner-'))
const invalidJsonPath = join(temp, 'invalid.jsonl')
writeFileSync(invalidJsonPath, '{"testCaseId":\n', 'utf8')
throws(() => loadEvaluationCases({ casesPath: invalidJsonPath, schemaPath }), /不是合法 JSON/, '非法 JSON 明确失败')

const invalidSchemaPath = join(temp, 'invalid-schema.jsonl')
const invalidCase = { ...loaded.cases[0] }; delete invalidCase.title
writeFileSync(invalidSchemaPath, `${JSON.stringify(invalidCase)}\n`, 'utf8')
throws(() => loadEvaluationCases({ casesPath: invalidSchemaPath, schemaPath }), /Schema 校验失败/, 'Schema 不合法明确失败')

const partialCase = { ...loaded.cases[0], expected: { expectedValidationStatus: '校验不通过', acceptanceCriteria: ['必须拒绝'] } }
equal(compareExpected(partialCase, { validationStatus: '校验不通过' }).length, 0, '只比较 expected 中实际存在的字段')

const unorderedCase = { ...partialCase, expected: { violationTypes: ['职责范围扩大', '职责升级'], acceptanceCriteria: ['必须识别两类风险'] } }
equal(compareExpected(unorderedCase, { violationTypes: ['responsibility_upgrade', 'responsibility_scope_expanded'] }).length, 0, '数组顺序不影响集合判断')

const forbiddenCase = { ...partialCase, candidateRewrite: '主导需求分析。', expected: { expectedValidationStatus: '校验不通过', forbiddenClaims: ['主导需求分析'], acceptanceCriteria: ['识别禁止声明'] } }
equal(compareExpected(forbiddenCase, { validationStatus: '校验不通过', claims: [{ claimText: '主导需求分析并制定方案' }] }).length, 0, 'forbiddenClaims 使用规范化语义匹配')
check(compareExpected(forbiddenCase, { validationStatus: '校验不通过', claims: [{ claimText: '整理需求记录' }] }).some((item) => item.includes('forbiddenClaims')), '未提取 forbiddenClaims 时失败')
const splitForbiddenCase = { ...forbiddenCase, candidateRewrite: '设计并执行 A/B 测试，通过实验验证方案。', expected: { expectedValidationStatus: '校验不通过', forbiddenClaims: ['设计实验'], acceptanceCriteria: ['识别组合语义'] } }
equal(compareExpected(splitForbiddenCase, { validationStatus: '校验不通过', claims: [{ claimText: '设计并执行 A/B 测试' }, { claimText: '通过实验验证方案' }] }).length, 0, '分拆 claims 可组合匹配同一 forbidden 语义')
const forbiddenPermissionCase = { ...forbiddenCase, expected: { expectedRewriteCallAllowed: false, forbiddenClaims: ['主导需求分析'], acceptanceCriteria: ['禁止调用 Rewrite'] } }
equal(compareExpected(forbiddenPermissionCase, { rewriteCallAllowed: false, violationTypes: ['rewrite_not_allowed'] }).length, 0, '权限已禁止 Rewrite 时不要求调用模型提取 forbiddenClaims')

const requiredCase = { ...partialCase, expected: { requiredClaims: ['参与需求分析和方案讨论'], acceptanceCriteria: ['保留已有事实'] } }
equal(compareExpected(requiredCase, { evidenceClaims: ['参与需求分析和产品方案讨论'] }).length, 0, 'requiredClaims 使用实际 Fact 证据语义匹配')
check(compareExpected(requiredCase, { evidenceClaims: ['整理会议纪要'] }).some((item) => item.includes('requiredClaims')), '缺少 requiredClaims 时失败')

const violationFixture = (candidateRewrite, factContent, reason = '职责等级超过 Fact 支持上限；项目状态超过 Fact 支持上限') => classifyViolations({
  status: '校验不通过',
  reason,
  claims: [],
  unsupportedClaims: [],
}, {
  candidateRewrite,
  confirmedFacts: [{ content: factContent, sourceText: factContent }],
})
const stageOnlyViolations = violationFixture('负责产品正式上线。', '完成 MVP 并验证核心流程。')
check(stageOnlyViolations.includes('project_status_upgrade'), '阶段升级应保留 project_status_upgrade')
equal(stageOnlyViolations.includes('responsibility_upgrade'), false, '职责词只修饰升级后的项目阶段时不判职责升级')
const participateToResponsible = violationFixture('负责需求分析。', '参与需求分析。', '职责等级超过 Fact 支持上限')
check(participateToResponsible.includes('responsibility_upgrade'), '参与需求分析到负责需求分析继续判职责升级')
const moduleToLead = violationFixture('主导产品整体规划与项目推进。', '负责搜索模块方案设计。', '职责等级超过 Fact 支持上限')
check(moduleToLead.includes('responsibility_upgrade'), '负责模块到主导整体项目继续判职责升级')
const explicitOwnership = violationFixture('担任项目负责人，独立负责整体产品规划。', '负责推荐功能方案。', '职责等级超过 Fact 支持上限')
check(explicitOwnership.includes('responsibility_upgrade'), '新增项目负责人或独立负责整体规划继续判职责升级')
const independentDutyAndStage = violationFixture('负责需求分析，并推动产品正式上线。', '参与需求分析，完成 MVP。')
check(independentDutyAndStage.includes('responsibility_upgrade'), '职责升级具有独立证据时允许与阶段升级并存')
check(independentDutyAndStage.includes('project_status_upgrade'), '独立职责升级不应吞掉项目阶段升级')

const classifiedUnsupported = (claims, candidateRewrite, factContent = '已确认基础事实。') => classifyViolations({
  status: '校验不通过',
  reason: claims.map((claim) => claim.reason).join('；'),
  claims,
  unsupportedClaims: claims.filter((claim) => !claim.supported).map((claim) => claim.claimText),
}, {
  candidateRewrite,
  confirmedFacts: [{ content: factContent, sourceText: factContent }],
})
const unsupportedClaimTypes = classifiedUnsupported([{ claimText: '制定产品路线图', claimType: '行动', supported: false, supportingFactIds: [], reason: '没有 supporting Fact。' }], '制定产品路线图。')
check(unsupportedClaimTypes.includes('unsupported_claim'), '无支撑通用行动归一化为 unsupported_claim')
const unsupportedTechTypes = classifiedUnsupported([{ claimText: '使用向量数据库', claimType: '技术', supported: false, supportingFactIds: [], reason: 'Fact 未支持该技术。' }], '使用向量数据库。', '使用关键词检索。')
check(unsupportedTechTypes.includes('unsupported_technology'), '无支撑技术 Claim 归一化为 unsupported_technology')
const unsupportedExperimentTypes = classifiedUnsupported([{ claimText: '设计灰度实验', claimType: '行动', supported: false, supportingFactIds: [], reason: 'Fact 未支持灰度实验。' }], '设计灰度实验。')
check(unsupportedExperimentTypes.includes('unsupported_experiment'), '实验行动归一化为 unsupported_experiment')
const capabilityTypes = classifiedUnsupported([{ claimText: '精通 SQL', claimType: '技术', supported: false, supportingFactIds: [], reason: 'Fact 只支持熟悉程度，不支持精通。' }], '精通 SQL。', '熟悉 SQL。')
check(capabilityTypes.includes('capability_overstatement'), '技术 Claim 的能力等级升级归一化为 capability_overstatement')
equal(capabilityTypes.includes('unsupported_technology'), false, '已有技术的能力升级不重复标为 unsupported_technology')
const multiClaimTypes = classifiedUnsupported([
  { claimText: '基于知识图谱重构流程', claimType: '技术', supported: false, supportingFactIds: [], reason: 'Fact 未支持知识图谱。' },
  { claimText: '降低审批时长', claimType: '结果', supported: false, supportingFactIds: [], reason: 'Fact 未支持该结果。' },
], '基于知识图谱重构流程，降低审批时长。', '使用规则引擎重构流程。')
check(multiClaimTypes.includes('unsupported_technology') && multiClaimTypes.includes('unsupported_result'), 'Multi-risk 按全部 unsupported Claims 聚合')
const metricTypes = classifiedUnsupported([{ claimText: '用户满意度达到 85%', claimType: '数字', supported: false, supportingFactIds: ['fact-001'], reason: 'Fact 是准确率 85%，指标口径不一致。' }], '用户满意度达到 85%。', '准确率达到 85%。')
check(metricTypes.includes('numeric_metric_changed'), '同值数字但指标变化归一化为 numeric_metric_changed')
const implicitDutyTypes = classifiedUnsupported([{ claimText: '由本人闭环完成需求评审', claimType: '职责', supported: false, supportingFactIds: [], reason: '参与经历不支持闭环职责等级。' }], '由本人闭环完成需求评审。', '参与需求评审。')
check(implicitDutyTypes.includes('responsibility_upgrade'), '隐式闭环 ownership 归一化为 responsibility_upgrade')
const naturalStageTypes = classifiedUnsupported([{ claimText: '产品已面向真实用户稳定运行', claimType: '项目状态', supported: false, supportingFactIds: [], reason: '内测不支持稳定运行状态。' }], '产品已面向真实用户稳定运行。', '产品处于内测。')
check(naturalStageTypes.includes('project_status_upgrade'), '自然语言阶段升级归一化为 project_status_upgrade')

const runnerCases = [
  { ...partialCase, testCaseId: 'RUN-PASS', title: '正常执行', candidateUsedFactIds: ['fact-001'], candidateExperienceId: 'exp-001', candidateRewrite: '负责需求分析。' },
  { ...partialCase, testCaseId: 'RUN-ERROR', title: '服务错误', candidateUsedFactIds: ['fact-001'], candidateExperienceId: 'exp-001', candidateRewrite: '触发服务错误。' },
]
const evaluation = await runEvaluation(runnerCases, {
  config: {},
  validationExecutor: async (_config, input, diagnostics) => {
    if (input.rewrites[0].rewriteId.includes('RUN-ERROR')) {
      const schemaErrors = [{ errorPath: '$.validations[0].reason', errorType: 'required', expected: 'string', actual: 'undefined' }]
      diagnostics.onAttempt({ attempt: 1, finishReason: 'stop', errorCode: 'SCHEMA_INVALID', schemaErrors, responseContent: '{"validations":[{"rewriteId":"eval-RUN-ERROR","claims":[]}]}' })
      const error = new Error('$.validations[0].reason 缺少必填字段'); error.code = 'SCHEMA_INVALID'; error.schemaErrors = schemaErrors; throw error
    }
    return [{ validationId: 'validation-pass', rewriteId: input.rewrites[0].rewriteId, status: '校验不通过', claims: [{ claimText: '负责需求分析', claimType: '职责', supported: false, supportingFactIds: ['fact-001'], reason: '职责升级' }], unsupportedClaims: ['负责需求分析'], usedFactIds: ['fact-001'], reason: '职责等级超过 Fact 支持上限', validatedText: input.rewrites[0].optimizedText }]
  },
})
equal(evaluation.results[0].passed, true, '正常执行结果参与 Gold 判断')
equal(evaluation.results[1].error.code, 'SCHEMA_INVALID', 'execution error 保留独立错误码')
equal(evaluation.results[1].error.schemaErrors[0].errorPath, '$.validations[0].reason', 'Evaluation 保存字段级 Schema 错误')
equal(evaluation.results[1].error.evaluationDebug.attempts[0].attempt, 1, 'Evaluation 保存失败尝试次数')
equal(evaluation.results[1].error.evaluationDebug.attempts[0].finishReason, 'stop', 'Evaluation 保存 finishReason')
equal(evaluation.results[1].error.evaluationDebug.attempts[0].responsePreview.validations[0].reason, undefined, '安全响应预览保留导致错误的结构')
equal(JSON.stringify(evaluation.results[1].error).includes('Authorization'), false, 'Evaluation 调试信息不包含 Authorization')
equal(evaluation.summary.executedCases, 1, 'execution error 不计入已执行判断案例')
equal(evaluation.summary.executionErrors, 1, 'execution error 单独统计')
equal(evaluation.summary.failedCases, 0, 'execution error 不计入普通判断失败')

const summaryFixture = buildSummary([
  { testCaseId: 'A', riskTags: ['风险一'], passed: true, error: null },
  { testCaseId: 'B', riskTags: ['风险一', '风险二'], passed: false, error: null },
  { testCaseId: 'C', riskTags: ['风险二'], passed: false, error: { code: 'MODEL_CALL_FAILED' } },
])
equal(summaryFixture.totalCases, 3, 'summary 总数正确')
equal(summaryFixture.passedCases, 1, 'summary 通过数正确')
equal(summaryFixture.failedCases, 1, 'summary 失败数正确')
equal(summaryFixture.executionErrors, 1, 'summary 执行错误数正确')
equal(summaryFixture.passRate, 0.5, 'passRate 只按实际完成判断的案例计算')
equal(summaryFixture.byRiskTag['风险二'].executionErrors, 1, '按 riskTag 统计执行错误')

const resultsPath = join(temp, 'results', 'results.json')
const summaryPath = join(temp, 'results', 'summary.json')
writeEvaluationResults(evaluation, { resultsPath, summaryPath, generatedAt: '2026-09-19T00:00:00.000Z' })
equal(JSON.parse(readFileSync(resultsPath, 'utf8')).results.length, 2, '结果文件正确生成')
equal(JSON.parse(readFileSync(summaryPath, 'utf8')).executionErrors, 1, '汇总文件正确生成')
const v2ResultsPath = join(temp, 'results', 'v2-results.json')
const v2SummaryPath = join(temp, 'results', 'v2-summary.json')
writeEvaluationResults(evaluation, { evaluationId: 'high-risk-v2', resultsPath: v2ResultsPath, summaryPath: v2SummaryPath, generatedAt: '2026-09-19T00:00:00.000Z' })
equal(JSON.parse(readFileSync(v2ResultsPath, 'utf8')).evaluationId, 'high-risk-v2', '结果文件支持独立 Evaluation 版本')

process.stdout.write(`${JSON.stringify({ ok: true, checks })}\n`)

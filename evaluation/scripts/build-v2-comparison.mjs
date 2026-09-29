import { readFileSync, writeFileSync } from 'node:fs'

const v1 = JSON.parse(readFileSync(new URL('../results/formal-eval-v1-summary.json', import.meta.url), 'utf8'))
const v2 = JSON.parse(readFileSync(new URL('../results/formal-eval-v2-summary.json', import.meta.url), 'utf8'))
const v1Results = JSON.parse(readFileSync(new URL('../results/formal-eval-v1-results.json', import.meta.url), 'utf8')).results
const v2Results = JSON.parse(readFileSync(new URL('../results/formal-eval-v2-results.json', import.meta.url), 'utf8')).results
const baseline = new Map(v1Results.map((item) => [item.testCaseId, item.status]))
const improved = v2Results.filter((item) => baseline.get(item.testCaseId) === 'FAIL' && item.status === 'PASS').map((item) => item.testCaseId)
const regressed = v2Results.filter((item) => baseline.get(item.testCaseId) === 'PASS' && item.status === 'FAIL').map((item) => item.testCaseId)
const persistentFailures = v2Results.filter((item) => baseline.get(item.testCaseId) === 'FAIL' && item.status === 'FAIL').map((item) => item.testCaseId)
const focusTypes = ['unsupported_claim', 'unsupported_technology', 'unsupported_experiment', 'capability_overstatement']
const delta = (next, previous) => next - previous
const comparison = {
  version: 'formal-eval-v2-comparison',
  datasetVersion: 'automatic-evaluation-v1',
  datasetHash: '0e0e55ea049f0e6743f2c4b78da00f3c72fe586aa3534fde498763e177d8337e',
  metrics: {
    total: [v1.totalCases, v2.totalCases], pass: [v1.passCases, v2.passCases], fail: [v1.failCases, v2.failCases], error: [v1.errorCases, v2.errorCases],
    casePassRate: [v1.casePassRate, v2.casePassRate],
    cleanPass: [v1.clean.pass, v2.clean.pass], cleanFalsePositive: [v1.clean.falsePositiveCount, v2.clean.falsePositiveCount],
    singleRiskPass: [v1.singleRisk.pass, v2.singleRisk.pass],
    multiRiskExact: [v1.multiRisk.exactMatchCount, v2.multiRisk.exactMatchCount], multiRiskPartial: [v1.multiRisk.partialMatchCount, v2.multiRisk.partialMatchCount], multiRiskMiss: [v1.multiRisk.completeMissCount, v2.multiRisk.completeMissCount],
    boundaryPass: [v1.boundary.pass, v2.boundary.pass], adversarialPass: [v1.adversarial.pass, v2.adversarial.pass],
  },
  focusViolationTypes: Object.fromEntries(focusTypes.map((type) => [type, { v1: v1.violationTypeMetrics[type], v2: v2.violationTypeMetrics[type] }])),
  p0Case: v2Results.find((item) => item.testCaseId === 'DEV-BDR-014'),
  improved,
  regressed,
  persistentFailures,
  tradeoffs: [
    '总体 PASS 增加 15，Case Pass Rate 提升 24.59 个百分点。',
    'Clean False Positive 从 1 降至 0，没有以牺牲 Clean 为代价。',
    '所有 violation 类型的主要 Recall 除 unsupported_number 外均达到 100%；unsupported_number 仍为 75%。',
    '精确标签的主要代价是 False Positive 增加：numeric_metric_changed 4、unsupported_result 3、unsupported_claim 2。',
    'V2 出现 3 个模型结构重试，但最终 ERROR=0、SCHEMA_INVALID=0；结构稳定性最终成功率保持 100%。',
  ],
}

writeFileSync(new URL('../results/formal-eval-v1-v2-comparison.json', import.meta.url), `${JSON.stringify(comparison, null, 2)}\n`, 'utf8')

const reportPath = new URL('../../15_AI_Evaluation.md', import.meta.url)
const existing = readFileSync(reportPath, 'utf8').replace(/\n## Evaluation V2 最小迭代[\s\S]*$/u, '').trim()
const pct = (value) => `${(value * 100).toFixed(2)}%`
const pp = (value) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}pp`
const md = `## Evaluation V2 最小迭代

### 1. 改进假设与实际修改

- Prompt：要求逐 Claim 扫描职责、能力、数字/指标、技术、实验、项目状态、项目归属、结果与通用无支撑事实；发现一个风险后继续扫描；明确职责、能力、项目状态三维独立，并保护同义压缩与保守表达。
- Rule：补齐“参加/参与”“协助/配合”的同级职责边界，增加“闭环/统筹”等隐式 ownership、能力程度层级，以及“正式使用/稳定运行”等自然语言项目阶段。
- Normalizer：只针对模型已标记 unsupported 的 Claim，结合 claimType、claimText 和 reason 归一化 violation，并聚合全部 Claim；没有按 Case ID 特判，也没有将 supported Claim 自动改为风险。
- Schema 未修改；模型配置未修改；冻结 Dataset 与 Gold 未修改。

### 2. V1 / V2 对照

| 指标 | V1 | V2 | 变化 |
| --- | ---: | ---: | ---: |
| Total | ${v1.totalCases} | ${v2.totalCases} | - |
| PASS | ${v1.passCases} | ${v2.passCases} | ${delta(v2.passCases, v1.passCases) >= 0 ? '+' : ''}${delta(v2.passCases, v1.passCases)} |
| FAIL | ${v1.failCases} | ${v2.failCases} | ${delta(v2.failCases, v1.failCases)} |
| ERROR | ${v1.errorCases} | ${v2.errorCases} | ${delta(v2.errorCases, v1.errorCases)} |
| Case Pass Rate | ${pct(v1.casePassRate)} | ${pct(v2.casePassRate)} | ${pp(v2.casePassRate - v1.casePassRate)} |
| Clean PASS | ${v1.clean.pass}/12 | ${v2.clean.pass}/12 | +${v2.clean.pass - v1.clean.pass} |
| Clean False Positive | ${v1.clean.falsePositiveCount} | ${v2.clean.falsePositiveCount} | ${v2.clean.falsePositiveCount - v1.clean.falsePositiveCount} |
| Single-risk | ${v1.singleRisk.pass}/17 | ${v2.singleRisk.pass}/17 | +${v2.singleRisk.pass - v1.singleRisk.pass} |
| Multi-risk Exact | ${v1.multiRisk.exactMatchCount}/7 | ${v2.multiRisk.exactMatchCount}/7 | +${v2.multiRisk.exactMatchCount - v1.multiRisk.exactMatchCount} |
| Multi-risk Partial | ${v1.multiRisk.partialMatchCount}/7 | ${v2.multiRisk.partialMatchCount}/7 | ${v2.multiRisk.partialMatchCount - v1.multiRisk.partialMatchCount} |
| Multi-risk Miss | ${v1.multiRisk.completeMissCount}/7 | ${v2.multiRisk.completeMissCount}/7 | ${v2.multiRisk.completeMissCount - v1.multiRisk.completeMissCount} |
| Boundary | ${v1.boundary.pass}/16 | ${v2.boundary.pass}/16 | +${v2.boundary.pass - v1.boundary.pass} |
| Adversarial | ${v1.adversarial.pass}/9 | ${v2.adversarial.pass}/9 | +${v2.adversarial.pass - v1.adversarial.pass} |

### 3. 重点风险类型

| Violation | V1 Recall | V2 Recall | V1 Precision | V2 Precision |
| --- | ---: | ---: | ---: | ---: |
${focusTypes.map((type) => `| ${type} | ${pct(v1.violationTypeMetrics[type].recall)} | ${pct(v2.violationTypeMetrics[type].recall)} | ${v1.violationTypeMetrics[type].precision == null ? '不适用' : pct(v1.violationTypeMetrics[type].precision)} | ${v2.violationTypeMetrics[type].precision == null ? '不适用' : pct(v2.violationTypeMetrics[type].precision)} |`).join('\n')}

P0 DEV-BDR-014 已修复：V2 对“熟悉 SQL→掌握 SQL”形成有效拦截，并输出 capability_overstatement。

### 4. Trade-off

- Recall 显著改善，但精确标签出现多报：numeric_metric_changed 有 4 个 FP、unsupported_result 有 3 个 FP、unsupported_claim 有 2 个 FP。
- Clean 从 11/12 提升到 12/12，False Positive 从 1 降到 0，说明本轮没有以牺牲正常改写为代价。
- Boundary 从 11/16 提升到 15/16，Adversarial 从 2/9 提升到 6/9。
- Multi-risk Exact 从 3/7 提升到 4/7；仍有 3 条 Partial，其中 DEV-MLT-005 继续漏掉 unsupported_number，另外两条主要是多报。
- 新增 3 个模型结构重试：模型首次使用 Schema 未允许的“能力/能力程度” claimType，有限重试后全部成功。最终 ERROR=0、SCHEMA_INVALID=0，但 Retry Rate 从 0 上升到 4.92%。

### 5. 仍未解决问题

- unsupported_number Recall 仍为 75%，DEV-MLT-005 未把复购率 15% 单独归入新数字。
- 数字归一化对“跨项目数字”和“同值不同单位”的优先级仍会多标 numeric_metric_changed 或 numeric_value_changed。
- 具体标签优先规则还不够严格，实验、职责、状态已命中具体标签时，偶尔仍增加 unsupported_claim 或 unsupported_result。
- responsibility_scope_expanded 与 responsibility_upgrade 仍有一条范围/等级边界多报。

### 6. 最终 Evaluation 阶段结论

V2 使用完全相同的 61 条冻结 Case，得到 PASS ${v2.passCases}、FAIL ${v2.failCases}、ERROR ${v2.errorCases}，Case Pass Rate ${pct(v2.casePassRate)}。相较 V1 提升 ${pp(v2.casePassRate - v1.casePassRate)}，P0 能力等级漏检已修复，Clean、Boundary、Adversarial 和 unsupported 类风险均改善。

本轮也真实暴露了 Recall 提升后的标签多报和 3 次有限重试。按照最小迭代约束，Evaluation 在 V2 正式收口，不继续开发 V3；剩余问题作为作品集复盘与后续路线图记录。
`
writeFileSync(reportPath, `${existing}\n\n${md}`, 'utf8')

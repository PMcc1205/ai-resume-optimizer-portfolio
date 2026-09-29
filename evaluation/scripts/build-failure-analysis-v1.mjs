import { readFileSync, writeFileSync } from 'node:fs'

const resultsPath = new URL('../results/formal-eval-v1-results.json', import.meta.url)
const casesPath = new URL('../datasets/automatic-evaluation-v1/cases.jsonl', import.meta.url)
const reportPath = new URL('../../15_AI_Evaluation.md', import.meta.url)
const analysisPath = new URL('../results/formal-eval-v1-failure-analysis.json', import.meta.url)

const results = JSON.parse(readFileSync(resultsPath, 'utf8')).results.filter((item) => item.status === 'FAIL')
const cases = new Map(readFileSync(casesPath, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line)).map((item) => [item.caseId, item]))

const meta = {
  'DEV-CLN-004': ['OVER_BLOCKING', 'MODEL_REASONING', 'P2', false, true, false, false, '模型把“参加”与“参与”措辞差异视为职责层级不一致，表现为过度保守。'],
  'DEV-SNG-001': ['MISSED_RISK', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型已明确指出路线图缺少 supporting Fact，但分类层没有将此类通用无支撑行动归入 unsupported_claim。'],
  'DEV-SNG-002': ['MISSED_RISK', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型识别出定价方案无支持；分类层同样没有从 unsupportedClaims/通用 reason 生成 unsupported_claim。'],
  'DEV-SNG-004': ['WRONG_VIOLATION_TYPE', 'MODEL_REASONING', 'P1', false, true, true, false, '数字风险识别正确，但模型/规则额外把“组织”解释为职责升级，形成 Single-risk 误报。'],
  'DEV-SNG-005': ['MISSED_RISK', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型识别交付周期结果无支持，但 unsupported_result 的分类词表未覆盖“缩短交付周期”。'],
  'DEV-SNG-007': ['TECHNOLOGY_INFERENCE_ERROR', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型指出关键词检索不能支持向量数据库；分类层只覆盖 Agent 形式的技术触发，未覆盖一般技术栈替换。'],
  'DEV-SNG-008': ['TECHNOLOGY_INFERENCE_ERROR', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型明确指出 API 调用不等于 LangChain；分类层没有通用 unsupported_technology 归一化。'],
  'DEV-SNG-009': ['METHOD_INFERENCE_ERROR', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型区分了同事体验与灰度实验；分类层没有把实验方法缺失映射到 unsupported_experiment。'],
  'DEV-SNG-010': ['METHOD_INFERENCE_ERROR', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型识别普通沟通不能支持可用性实验；分类层缺少通用 unsupported_experiment 映射。'],
  'DEV-SNG-016': ['CAPABILITY_LEVEL_ERROR', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型识别熟悉→精通的能力提升，但分类层没有 capability_overstatement 的通用 reason 映射。'],
  'DEV-MLT-002': ['PARTIAL_MULTI_RISK', 'RULE_COVERAGE', 'P1', true, false, false, true, '项目状态升级已识别；上线后运营这一独立无支撑行动未映射为 unsupported_claim。'],
  'DEV-MLT-003': ['PARTIAL_MULTI_RISK', 'RULE_COVERAGE', 'P1', true, false, false, true, '模型同时识别知识图谱和降时长均无支持，但分类层只生成 unsupported_result，漏掉 unsupported_technology。'],
  'DEV-MLT-005': ['PARTIAL_MULTI_RISK', 'NUMERIC_REASONING_ERROR', 'P1', true, false, false, true, '订单数 40→90 与复购结果被识别；新增 15% 没有单独归入 unsupported_number。'],
  'DEV-MLT-008': ['PARTIAL_MULTI_RISK', 'TECHNOLOGY_INFERENCE_ERROR', 'P1', true, false, false, true, '跨项目和结果风险识别；图神经网络及实时语音识别的技术风险未完整映射。'],
  'DEV-BDR-001': ['OVER_BLOCKING', 'MODEL_REASONING', 'P2', false, true, false, false, '模型将“参与”→“协助”的保守改写判为不受支持，职责边界判断过严。'],
  'DEV-BDR-012': ['PROJECT_STATUS_ERROR', 'MODEL_REASONING', 'P1', true, false, false, false, '模型理由已指出 MVP 不能推出正式使用，但分类层未从自然语言状态理由识别 project_status_upgrade。'],
  'DEV-BDR-014': ['CAPABILITY_LEVEL_ERROR', 'MODEL_REASONING', 'P0', true, false, false, false, '模型直接判定熟悉→掌握仍可追溯并返回通过，导致能力升级没有阻塞。'],
  'DEV-BDR-015': ['OVER_BLOCKING', 'MODEL_REASONING', 'P2', false, true, false, false, '模型把“熟练使用 Figma”相对“掌握 Figma”误解为职责升级，属于能力与职责维度混淆。'],
  'DEV-BDR-016': ['CAPABILITY_LEVEL_ERROR', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型指出掌握→精通无支持，但分类层没有 capability_overstatement 映射。'],
  'DEV-ADV-001': ['RESPONSIBILITY_REASONING_ERROR', 'COMPOSITIONAL_REASONING', 'P1', true, false, false, false, '模型识别“个人闭环”超出参与事实；分类层依赖显式职责等级词，未捕获隐式 ownership。'],
  'DEV-ADV-002': ['RESPONSIBILITY_REASONING_ERROR', 'COMPOSITIONAL_REASONING', 'P1', true, false, false, false, '模型识别个人闭环与团队结果归因冲突；分类层未把隐式个人归因映射为 responsibility_upgrade。'],
  'DEV-ADV-003': ['PROJECT_STATUS_ERROR', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型识别计划/内测→真实用户稳定运行的状态升级；分类层未覆盖自然语言阶段表达。'],
  'DEV-ADV-004': ['NUMERIC_REASONING_ERROR', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型识别搜索入口指标被改成产品整体指标；同值数字的 metric 变化未被分类层捕获。'],
  'DEV-ADV-005': ['NUMERIC_REASONING_ERROR', 'RULE_COVERAGE', 'P1', true, false, false, false, '模型识别准确率→满意度的指标口径变化；分类层只比较数字值，没有比较指标语义。'],
  'DEV-ADV-006': ['TECHNOLOGY_INFERENCE_ERROR', 'NORMALIZATION', 'P1', true, false, false, false, '模型识别自主规划/工具调用隐含 Agent 类技术；分类层依赖“Agent”字面关键词。'],
  'DEV-ADV-008': ['RESPONSIBILITY_REASONING_ERROR', 'NORMALIZATION', 'P1', true, false, false, false, '模型识别协助→统筹与生产状态升级；分类层未将“统筹”归入职责等级或 ownership 词表。'],
}

const analysis = results.map((result) => {
  const source = cases.get(result.testCaseId)
  const [failureType, rootCauseHypothesis, severity, falseNegative, falsePositive, wrongType, partialDetection, notes] = meta[result.testCaseId] ?? ['OTHER', 'OTHER', 'P2', false, false, false, false, '待人工补充。']
  const expected = new Set(result.violationTypesExpected)
  const actual = new Set(result.violationTypesActual)
  return {
    testCaseId: result.testCaseId,
    category: result.category,
    riskTags: [...source.expectedViolations],
    sourceFacts: source.sourceFacts,
    candidateText: source.candidateText,
    gold: { expectedValidation: source.expectedValidation, expectedViolations: source.expectedViolations, rationale: source.rationale },
    actual: result.actual,
    expectedViolationTypes: [...expected].sort(),
    actualViolationTypes: [...actual].sort(),
    missingViolationTypes: [...expected].filter((value) => !actual.has(value)).sort(),
    extraViolationTypes: [...actual].filter((value) => !expected.has(value)).sort(),
    failedChecks: result.failedChecks,
    failureType,
    rootCauseHypothesis,
    severity,
    falseNegative,
    falsePositive,
    wrongType,
    partialDetection,
    notes,
  }
})

const summary = {
  totalFailures: analysis.length,
  failureTypeCounts: countBy(analysis, 'failureType'),
  severityCounts: countBy(analysis, 'severity'),
  dimensions: {
    falseNegative: analysis.filter((item) => item.falseNegative).length,
    falsePositive: analysis.filter((item) => item.falsePositive).length,
    wrongType: analysis.filter((item) => item.wrongType).length,
    partialDetection: analysis.filter((item) => item.partialDetection).length,
    note: 'falseNegative 包含 4 条 Multi-risk partialDetection；维度统计允许交叉。',
  },
  singleRisk: [
    ['unsupported_claim', 2, 0, 2], ['unsupported_number', 2, 2, 0], ['unsupported_result', 2, 1, 1], ['unsupported_technology', 2, 0, 2], ['unsupported_experiment', 2, 0, 2], ['numeric_value_changed', 1, 1, 0], ['numeric_metric_changed', 1, 1, 0], ['project_status_upgrade', 1, 1, 0], ['responsibility_upgrade', 1, 1, 0], ['capability_overstatement', 1, 0, 1], ['cross_project_fact', 1, 1, 0], ['rewrite_not_allowed', 1, 1, 0],
  ].map(([violationType, caseCount, pass, fail]) => ({ violationType, caseCount, pass, fail, recall: caseCount ? pass / caseCount : null })),
  weakestSingleRisk: ['unsupported_claim', 'unsupported_technology', 'unsupported_experiment', 'capability_overstatement'],
  patterns: [
    { id: 'A', title: '通用无支撑声明未归一化', caseCount: 9, cases: ['DEV-SNG-001', 'DEV-SNG-002', 'DEV-SNG-005', 'DEV-SNG-007', 'DEV-SNG-008', 'DEV-SNG-009', 'DEV-SNG-010', 'DEV-SNG-016', 'DEV-MLT-003'], severity: 'P1', rootCause: '模型语义多已正确，但结果分类依赖狭窄关键词/理由模板。', direction: '建立理由到统一 violation 的可解释归一化，并保持具体标签优先。' },
    { id: 'B', title: '多风险组合的第二风险漏检', caseCount: 4, cases: ['DEV-MLT-002', 'DEV-MLT-003', 'DEV-MLT-005', 'DEV-MLT-008'], severity: 'P1', rootCause: '同一 validation 中多个 claim 已被模型指出，但分类输出没有逐 claim 聚合。', direction: '按 claim 证据逐项聚合风险，再计算集合，不把一个 reason 当作单标签。' },
    { id: 'C', title: '隐式职责与阶段表达绕过分类', caseCount: 6, cases: ['DEV-BDR-012', 'DEV-ADV-001', 'DEV-ADV-002', 'DEV-ADV-003', 'DEV-ADV-006', 'DEV-ADV-008'], severity: 'P1', rootCause: '分类层偏向显式词，难以处理闭环归因、计划/稳定运行、隐含 Agent 等自然语言表达。', direction: '优先完善语义边界与结构化 claimType/理由组合的通用判定。' },
    { id: 'D', title: '合法保守改写被过度拦截', caseCount: 3, cases: ['DEV-CLN-004', 'DEV-BDR-001', 'DEV-BDR-015'], severity: 'P2', rootCause: '职责规则对同义或能力维度表达过于保守。', direction: '增加 Clean/Boundary 回归，先验证职责、能力、项目状态三维独立性。' },
    { id: 'E', title: '同值数字的指标口径变化漏检', caseCount: 3, cases: ['DEV-MLT-005', 'DEV-ADV-004', 'DEV-ADV-005'], severity: 'P1', rootCause: '规则层比较数字值但没有稳定比较数字对应的指标、统计对象和单位语义。', direction: '将数字实体与指标语义绑定后再判断 numeric_metric_changed。' },
  ],
}

const report = JSON.parse(readFileSync(new URL('../results/formal-eval-v1-summary.json', import.meta.url), 'utf8'))
const markdown = buildMarkdown(analysis, summary, report)
writeFileSync(analysisPath, `${JSON.stringify({ analysisVersion: 'failure-analysis-v1', baseline: { evaluationId: 'formal-eval-v1', totalCases: 61, passCases: 35, failCases: 26, errorCases: 0 }, summary, cases: analysis }, null, 2)}\n`, 'utf8')
writeFileSync(reportPath, `${readFileSync(reportPath, 'utf8').replace(/\n## Failure Analysis V1[\s\S]*$/u, '').trim()}\n\n${markdown}`, 'utf8')

function countBy(items, key) { return Object.fromEntries([...new Set(items.map((item) => item[key]))].sort().map((value) => [value, items.filter((item) => item[key] === value).length])) }
function rate(value) { return value == null ? '不适用' : `${(value * 100).toFixed(2)}%` }
function buildMarkdown(items, summary, report) {
  const lines = ['## Failure Analysis V1', '', '本节仅分析 `formal-eval-v1` 的真实结果，不修改冻结 Dataset、Gold、Prompt、Schema、Runner 或产品规则。', '', `Baseline：61 条，PASS ${report.passCases}，FAIL ${report.failCases}，ERROR ${report.errorCases}。`, '', '### 1. Failure Type 汇总', '', '| Failure Type | 数量 |', '| --- | ---: |', ...Object.entries(summary.failureTypeCounts).map(([key, value]) => `| ${key} | ${value} |`), '', '### 2. 错误维度', '', `- falseNegative：${summary.dimensions.falseNegative}（包含 4 条 Multi-risk partialDetection）`, `- falsePositive：${summary.dimensions.falsePositive}`, `- wrongType：${summary.dimensions.wrongType}`, `- partialDetection：${summary.dimensions.partialDetection}`, '', '### 3. 26 条 FAIL 逐条审计', '', '| Case | Category | Failure Type | Severity | Expected | Actual | Missing | Extra | Root Cause |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |', ...items.map((item) => `| ${item.testCaseId} | ${item.category} | ${item.failureType} | ${item.severity} | ${item.expectedViolationTypes.join(', ') || '无'} | ${item.actualViolationTypes.join(', ') || '无'} | ${item.missingViolationTypes.join(', ') || '无'} | ${item.extraViolationTypes.join(', ') || '无'} | ${item.rootCauseHypothesis} |`), '', '逐条 Source Fact、Candidate、Gold、Actual、failedChecks、根因、严重程度和说明已保存至 `evaluation/results/formal-eval-v1-failure-analysis.json`。', '', '### 4. Single-risk 分析', '', '| Violation Type | Case 数 | PASS | FAIL | Recall |', '| --- | ---: | ---: | ---: | ---: |', ...summary.singleRisk.map((item) => `| ${item.violationType} | ${item.caseCount} | ${item.pass} | ${item.fail} | ${rate(item.recall)} |`), '', `当前最弱类型：${summary.weakestSingleRisk.join('、')}。其中四类 Recall 均为 0%，并列最弱。`, '', '### 5. Multi-risk Partial Match', '', '| Case | Expected | Actual | Missing | Extra |', '| --- | --- | --- | --- | --- |', ...items.filter((item) => item.partialDetection).map((item) => `| ${item.testCaseId} | ${item.expectedViolationTypes.join(', ')} | ${item.actualViolationTypes.join(', ') || '无'} | ${item.missingViolationTypes.join(', ')} | ${item.extraViolationTypes.join(', ') || '无'} |`), '', '4 条 Partial 均漏掉了第二个或第三个独立风险，没有 Complete Miss。', '', '### 6. Boundary FAIL', '', ...items.filter((item) => item.category === 'boundary').map((item) => `- ${item.testCaseId}：${item.failureType}；${item.notes}`), '', 'Boundary 主要表现为能力等级漏检（BDR-014/016）与合法表达过度拦截（BDR-001/015），同时存在阶段升级漏检（BDR-012），不是单一方向偏差。', '', '### 7. Adversarial FAIL', '', ...items.filter((item) => item.category === 'adversarial').map((item) => `- ${item.testCaseId}：攻击方式=${attackMode(item.testCaseId)}；Gold=${item.expectedViolationTypes.join(', ')}；Actual=${item.actualViolationTypes.join(', ') || '无'}；${item.notes}`), '', 'Adversarial 最容易绕过的三类表达：隐式 ownership/个人归因、自然语言项目阶段升级、同值数字的指标口径变化/隐含技术。', '', '### 8. Clean False Positive：DEV-CLN-004', '', '- Source：参加项目周会，记录会议讨论内容，并在会后整理待办事项。', '- Candidate：参与项目周会，记录讨论内容并整理会后待办。', '- Gold：合法压缩，事实、行动和职责均未升级。', '- Actual：校验不通过，`responsibility_upgrade`。', '- 判断：模型将“参加→参与”或“参加”缺少显式职责词理解为职责不一致，属于过度保守的语义判断，不是新增事实风险。', '', '### 9. 严重程度', '', `- P0：${summary.severityCounts.P0 ?? 0}（可能让能力升级直接通过：DEV-BDR-014）`, `- P1：${summary.severityCounts.P1 ?? 0}（风险被拦截但标签漏检/组合漏检/对抗表达漏检）`, `- P2：${summary.severityCounts.P2 ?? 0}（合法改写误杀或边界解释问题）`, '', '### 10. Failure Pattern', '', ...summary.patterns.map((pattern) => `**Pattern ${pattern.id}：${pattern.title}**（${pattern.caseCount} 条，${pattern.severity}）\n\n- 典型 Case：${pattern.cases.join('、')}\n- 根因假设：${pattern.rootCause}\n- 后续方向：${pattern.direction}`), '', '### 11. 后续优先级', '', '1. 优先处理能力等级漏检与隐式职责/项目状态漏检，避免真实经历升级后直接通过。', '2. 其次完善多风险逐 claim 聚合，避免一个 Candidate 的第二风险被遗漏。', '3. 再处理通用 unsupported_claim / technology / experiment / metric 的分类归一化。', '4. 最后收紧职责规则的 Clean/Boundary 误杀，降低 False Positive。', '', '本轮没有实施任何修复，也没有重新运行 V2。', '']
  return lines.join('\n')
}

function attackMode(id) {
  return {
    'DEV-ADV-001': '删除参与限定、隐式闭环 ownership',
    'DEV-ADV-002': '团队结果归因个人',
    'DEV-ADV-003': '计划/内测包装为稳定运行',
    'DEV-ADV-004': '局部指标包装为整体指标',
    'DEV-ADV-005': '准确率包装为满意度',
    'DEV-ADV-006': '用自主规划/工具调用隐含 Agent',
    'DEV-ADV-008': '协助→统筹并内部测试→生产使用',
  }[id] ?? '语义改写'
}

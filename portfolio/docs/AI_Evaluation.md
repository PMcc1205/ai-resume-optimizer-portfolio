# 15｜AI Evaluation

## 一、Evaluation 目标

使用冻结的 `automatic-evaluation-v1` 对当前真实生成后事实校验链路建立第一次正式 Baseline。本轮不修改 Prompt、Schema、Gold、产品规则或模型配置。

## 二、数据集

- Dataset：automatic-evaluation-v1
- 自动案例：61
- 待人工评审：1（不进入自动指标分母）
- 运行时间：2026-09-20T05:09:55.852Z

## 三、评估方法

每条 Case 通过现有 Evaluation Runner 调用真实 Validation 链路；需要模型判断的案例调用当前 DeepSeek 配置。PASS、FAIL、ERROR 分开统计，ERROR 不作为普通判断失败。

## 四、指标定义

- executionSuccessRate = (PASS + FAIL) / totalCases
- casePassRate = PASS / (PASS + FAIL)
- rawPassRate = PASS / totalCases
- violation Precision / Recall / F1 仅使用成功形成判断的 Case。

## 五、Baseline 结果

| 指标 | 结果 |
| --- | ---: |
| Total | 61 |
| PASS | 35 |
| FAIL | 26 |
| ERROR | 0 |
| executionSuccessRate | 100.00% |
| casePassRate | 57.38% |
| rawPassRate | 57.38% |

## 六、分类结果

| 类别 | Total | PASS | FAIL | ERROR | Pass Rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| normal-clean | 12 | 11 | 1 | 0 | 91.67% |
| single-risk | 17 | 8 | 9 | 0 | 47.06% |
| multi-risk | 7 | 3 | 4 | 0 | 42.86% |
| boundary | 16 | 11 | 5 | 0 | 68.75% |
| adversarial | 9 | 2 | 7 | 0 | 22.22% |

Clean False Positive：1（8.33%）

Multi-risk：Exact 3 / Partial 4 / Complete Miss 0 / ERROR 0

### Violation Type

| Violation | Gold | TP | FP | FN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| capability_overstatement | 3 | 0 | 0 | 3 | 不适用 | 0.00% | 不适用 |
| cross_project_fact | 4 | 4 | 0 | 0 | 100.00% | 100.00% | 100.00% |
| numeric_metric_changed | 3 | 1 | 0 | 2 | 100.00% | 33.33% | 50.00% |
| numeric_value_changed | 3 | 3 | 0 | 0 | 100.00% | 100.00% | 100.00% |
| project_status_upgrade | 7 | 5 | 0 | 2 | 100.00% | 71.43% | 83.33% |
| responsibility_scope_expanded | 1 | 1 | 0 | 0 | 100.00% | 100.00% | 100.00% |
| responsibility_upgrade | 10 | 7 | 3 | 3 | 70.00% | 70.00% | 70.00% |
| rewrite_not_allowed | 2 | 2 | 0 | 0 | 100.00% | 100.00% | 100.00% |
| unsupported_claim | 3 | 0 | 0 | 3 | 不适用 | 0.00% | 不适用 |
| unsupported_experiment | 2 | 0 | 0 | 2 | 不适用 | 0.00% | 不适用 |
| unsupported_number | 4 | 3 | 0 | 1 | 100.00% | 75.00% | 85.71% |
| unsupported_result | 7 | 6 | 0 | 1 | 100.00% | 85.71% | 92.31% |
| unsupported_technology | 5 | 0 | 0 | 5 | 不适用 | 0.00% | 不适用 |

## 七、Failure Cases

- DEV-CLN-004：OVER_BLOCKING；missing=无；extra=responsibility_upgrade
- DEV-SNG-001：MISSED_RISK；missing=unsupported_claim；extra=无
- DEV-SNG-002：MISSED_RISK；missing=unsupported_claim；extra=无
- DEV-SNG-004：WRONG_VIOLATION_TYPE；missing=无；extra=responsibility_upgrade
- DEV-SNG-005：MISSED_RISK；missing=unsupported_result；extra=无
- DEV-SNG-007：MISSED_RISK；missing=unsupported_technology；extra=无
- DEV-SNG-008：MISSED_RISK；missing=unsupported_technology；extra=无
- DEV-SNG-009：MISSED_RISK；missing=unsupported_experiment；extra=无
- DEV-SNG-010：MISSED_RISK；missing=unsupported_experiment；extra=无
- DEV-SNG-016：CAPABILITY_LEVEL_ERROR；missing=capability_overstatement；extra=无
- DEV-MLT-002：PARTIAL_MULTI_RISK；missing=unsupported_claim；extra=无
- DEV-MLT-003：PARTIAL_MULTI_RISK；missing=unsupported_technology；extra=无
- DEV-MLT-005：PARTIAL_MULTI_RISK；missing=unsupported_number；extra=无
- DEV-MLT-008：PARTIAL_MULTI_RISK；missing=unsupported_technology；extra=无
- DEV-BDR-001：OTHER；missing=无；extra=无
- DEV-BDR-012：MISSED_RISK；missing=project_status_upgrade；extra=无
- DEV-BDR-014：CAPABILITY_LEVEL_ERROR；missing=capability_overstatement；extra=无
- DEV-BDR-015：WRONG_VIOLATION_TYPE；missing=无；extra=responsibility_upgrade
- DEV-BDR-016：CAPABILITY_LEVEL_ERROR；missing=capability_overstatement；extra=无
- DEV-ADV-001：RESPONSIBILITY_REASONING_ERROR；missing=responsibility_upgrade；extra=无
- DEV-ADV-002：RESPONSIBILITY_REASONING_ERROR；missing=responsibility_upgrade；extra=无
- DEV-ADV-003：MISSED_RISK；missing=project_status_upgrade；extra=无
- DEV-ADV-004：NUMERIC_REASONING_ERROR；missing=numeric_metric_changed；extra=无
- DEV-ADV-005：NUMERIC_REASONING_ERROR；missing=numeric_metric_changed；extra=无
- DEV-ADV-006：MISSED_RISK；missing=unsupported_technology；extra=无
- DEV-ADV-008：RESPONSIBILITY_REASONING_ERROR；missing=responsibility_upgrade；extra=无

## 八、Execution Errors

无。

## 九、延迟

- 平均：1095 ms
- P50：1107 ms
- P95：1536 ms

## 十、阶段结论与下一轮方向

本报告仅记录本次真实 Baseline。失败与执行错误保留原样，下一轮应先依据 Failure Analysis 选择是否进入 Prompt、规则或结构稳定性迭代，不在本轮修改。

## Failure Analysis V1

本节仅分析 `formal-eval-v1` 的真实结果，不修改冻结 Dataset、Gold、Prompt、Schema、Runner 或产品规则。

Baseline：61 条，PASS 35，FAIL 26，ERROR 0。

### 1. Failure Type 汇总

| Failure Type | 数量 |
| --- | ---: |
| CAPABILITY_LEVEL_ERROR | 3 |
| METHOD_INFERENCE_ERROR | 2 |
| MISSED_RISK | 3 |
| NUMERIC_REASONING_ERROR | 2 |
| OVER_BLOCKING | 3 |
| PARTIAL_MULTI_RISK | 4 |
| PROJECT_STATUS_ERROR | 2 |
| RESPONSIBILITY_REASONING_ERROR | 3 |
| TECHNOLOGY_INFERENCE_ERROR | 3 |
| WRONG_VIOLATION_TYPE | 1 |

### 2. 错误维度

- falseNegative：22（包含 4 条 Multi-risk partialDetection）
- falsePositive：4
- wrongType：1
- partialDetection：4

### 3. 26 条 FAIL 逐条审计

| Case | Category | Failure Type | Severity | Expected | Actual | Missing | Extra | Root Cause |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEV-CLN-004 | normal-clean | OVER_BLOCKING | P2 | 无 | responsibility_upgrade | 无 | responsibility_upgrade | MODEL_REASONING |
| DEV-SNG-001 | single-risk | MISSED_RISK | P1 | unsupported_claim | 无 | unsupported_claim | 无 | RULE_COVERAGE |
| DEV-SNG-002 | single-risk | MISSED_RISK | P1 | unsupported_claim | 无 | unsupported_claim | 无 | RULE_COVERAGE |
| DEV-SNG-004 | single-risk | WRONG_VIOLATION_TYPE | P1 | unsupported_number | responsibility_upgrade, unsupported_number | 无 | responsibility_upgrade | MODEL_REASONING |
| DEV-SNG-005 | single-risk | MISSED_RISK | P1 | unsupported_result | 无 | unsupported_result | 无 | RULE_COVERAGE |
| DEV-SNG-007 | single-risk | TECHNOLOGY_INFERENCE_ERROR | P1 | unsupported_technology | 无 | unsupported_technology | 无 | RULE_COVERAGE |
| DEV-SNG-008 | single-risk | TECHNOLOGY_INFERENCE_ERROR | P1 | unsupported_technology | 无 | unsupported_technology | 无 | RULE_COVERAGE |
| DEV-SNG-009 | single-risk | METHOD_INFERENCE_ERROR | P1 | unsupported_experiment | 无 | unsupported_experiment | 无 | RULE_COVERAGE |
| DEV-SNG-010 | single-risk | METHOD_INFERENCE_ERROR | P1 | unsupported_experiment | 无 | unsupported_experiment | 无 | RULE_COVERAGE |
| DEV-SNG-016 | single-risk | CAPABILITY_LEVEL_ERROR | P1 | capability_overstatement | 无 | capability_overstatement | 无 | RULE_COVERAGE |
| DEV-MLT-002 | multi-risk | PARTIAL_MULTI_RISK | P1 | project_status_upgrade, unsupported_claim | project_status_upgrade | unsupported_claim | 无 | RULE_COVERAGE |
| DEV-MLT-003 | multi-risk | PARTIAL_MULTI_RISK | P1 | unsupported_result, unsupported_technology | unsupported_result | unsupported_technology | 无 | RULE_COVERAGE |
| DEV-MLT-005 | multi-risk | PARTIAL_MULTI_RISK | P1 | numeric_value_changed, unsupported_number, unsupported_result | numeric_value_changed, unsupported_result | unsupported_number | 无 | NUMERIC_REASONING_ERROR |
| DEV-MLT-008 | multi-risk | PARTIAL_MULTI_RISK | P1 | cross_project_fact, unsupported_result, unsupported_technology | cross_project_fact, unsupported_result | unsupported_technology | 无 | TECHNOLOGY_INFERENCE_ERROR |
| DEV-BDR-001 | boundary | OVER_BLOCKING | P2 | 无 | 无 | 无 | 无 | MODEL_REASONING |
| DEV-BDR-012 | boundary | PROJECT_STATUS_ERROR | P1 | project_status_upgrade | 无 | project_status_upgrade | 无 | MODEL_REASONING |
| DEV-BDR-014 | boundary | CAPABILITY_LEVEL_ERROR | P0 | capability_overstatement | 无 | capability_overstatement | 无 | MODEL_REASONING |
| DEV-BDR-015 | boundary | OVER_BLOCKING | P2 | 无 | responsibility_upgrade | 无 | responsibility_upgrade | MODEL_REASONING |
| DEV-BDR-016 | boundary | CAPABILITY_LEVEL_ERROR | P1 | capability_overstatement | 无 | capability_overstatement | 无 | RULE_COVERAGE |
| DEV-ADV-001 | adversarial | RESPONSIBILITY_REASONING_ERROR | P1 | responsibility_upgrade | 无 | responsibility_upgrade | 无 | COMPOSITIONAL_REASONING |
| DEV-ADV-002 | adversarial | RESPONSIBILITY_REASONING_ERROR | P1 | responsibility_upgrade | 无 | responsibility_upgrade | 无 | COMPOSITIONAL_REASONING |
| DEV-ADV-003 | adversarial | PROJECT_STATUS_ERROR | P1 | project_status_upgrade | 无 | project_status_upgrade | 无 | RULE_COVERAGE |
| DEV-ADV-004 | adversarial | NUMERIC_REASONING_ERROR | P1 | numeric_metric_changed, unsupported_result | unsupported_result | numeric_metric_changed | 无 | RULE_COVERAGE |
| DEV-ADV-005 | adversarial | NUMERIC_REASONING_ERROR | P1 | numeric_metric_changed, unsupported_result | unsupported_result | numeric_metric_changed | 无 | RULE_COVERAGE |
| DEV-ADV-006 | adversarial | TECHNOLOGY_INFERENCE_ERROR | P1 | unsupported_technology | 无 | unsupported_technology | 无 | NORMALIZATION |
| DEV-ADV-008 | adversarial | RESPONSIBILITY_REASONING_ERROR | P1 | project_status_upgrade, responsibility_upgrade | project_status_upgrade | responsibility_upgrade | 无 | NORMALIZATION |

逐条 Source Fact、Candidate、Gold、Actual、failedChecks、根因、严重程度和说明已保存至 `evaluation/results/formal-eval-v1-failure-analysis.json`。

### 4. Single-risk 分析

| Violation Type | Case 数 | PASS | FAIL | Recall |
| --- | ---: | ---: | ---: | ---: |
| unsupported_claim | 2 | 0 | 2 | 0.00% |
| unsupported_number | 2 | 2 | 0 | 100.00% |
| unsupported_result | 2 | 1 | 1 | 50.00% |
| unsupported_technology | 2 | 0 | 2 | 0.00% |
| unsupported_experiment | 2 | 0 | 2 | 0.00% |
| numeric_value_changed | 1 | 1 | 0 | 100.00% |
| numeric_metric_changed | 1 | 1 | 0 | 100.00% |
| project_status_upgrade | 1 | 1 | 0 | 100.00% |
| responsibility_upgrade | 1 | 1 | 0 | 100.00% |
| capability_overstatement | 1 | 0 | 1 | 0.00% |
| cross_project_fact | 1 | 1 | 0 | 100.00% |
| rewrite_not_allowed | 1 | 1 | 0 | 100.00% |

当前最弱类型：unsupported_claim、unsupported_technology、unsupported_experiment、capability_overstatement。其中四类 Recall 均为 0%，并列最弱。

### 5. Multi-risk Partial Match

| Case | Expected | Actual | Missing | Extra |
| --- | --- | --- | --- | --- |
| DEV-MLT-002 | project_status_upgrade, unsupported_claim | project_status_upgrade | unsupported_claim | 无 |
| DEV-MLT-003 | unsupported_result, unsupported_technology | unsupported_result | unsupported_technology | 无 |
| DEV-MLT-005 | numeric_value_changed, unsupported_number, unsupported_result | numeric_value_changed, unsupported_result | unsupported_number | 无 |
| DEV-MLT-008 | cross_project_fact, unsupported_result, unsupported_technology | cross_project_fact, unsupported_result | unsupported_technology | 无 |

4 条 Partial 均漏掉了第二个或第三个独立风险，没有 Complete Miss。

### 6. Boundary FAIL

- DEV-BDR-001：OVER_BLOCKING；模型将“参与”→“协助”的保守改写判为不受支持，职责边界判断过严。
- DEV-BDR-012：PROJECT_STATUS_ERROR；模型理由已指出 MVP 不能推出正式使用，但分类层未从自然语言状态理由识别 project_status_upgrade。
- DEV-BDR-014：CAPABILITY_LEVEL_ERROR；模型直接判定熟悉→掌握仍可追溯并返回通过，导致能力升级没有阻塞。
- DEV-BDR-015：OVER_BLOCKING；模型把“熟练使用 Figma”相对“掌握 Figma”误解为职责升级，属于能力与职责维度混淆。
- DEV-BDR-016：CAPABILITY_LEVEL_ERROR；模型指出掌握→精通无支持，但分类层没有 capability_overstatement 映射。

Boundary 主要表现为能力等级漏检（BDR-014/016）与合法表达过度拦截（BDR-001/015），同时存在阶段升级漏检（BDR-012），不是单一方向偏差。

### 7. Adversarial FAIL

- DEV-ADV-001：攻击方式=删除参与限定、隐式闭环 ownership；Gold=responsibility_upgrade；Actual=无；模型识别“个人闭环”超出参与事实；分类层依赖显式职责等级词，未捕获隐式 ownership。
- DEV-ADV-002：攻击方式=团队结果归因个人；Gold=responsibility_upgrade；Actual=无；模型识别个人闭环与团队结果归因冲突；分类层未把隐式个人归因映射为 responsibility_upgrade。
- DEV-ADV-003：攻击方式=计划/内测包装为稳定运行；Gold=project_status_upgrade；Actual=无；模型识别计划/内测→真实用户稳定运行的状态升级；分类层未覆盖自然语言阶段表达。
- DEV-ADV-004：攻击方式=局部指标包装为整体指标；Gold=numeric_metric_changed, unsupported_result；Actual=unsupported_result；模型识别搜索入口指标被改成产品整体指标；同值数字的 metric 变化未被分类层捕获。
- DEV-ADV-005：攻击方式=准确率包装为满意度；Gold=numeric_metric_changed, unsupported_result；Actual=unsupported_result；模型识别准确率→满意度的指标口径变化；分类层只比较数字值，没有比较指标语义。
- DEV-ADV-006：攻击方式=用自主规划/工具调用隐含 Agent；Gold=unsupported_technology；Actual=无；模型识别自主规划/工具调用隐含 Agent 类技术；分类层依赖“Agent”字面关键词。
- DEV-ADV-008：攻击方式=协助→统筹并内部测试→生产使用；Gold=project_status_upgrade, responsibility_upgrade；Actual=project_status_upgrade；模型识别协助→统筹与生产状态升级；分类层未将“统筹”归入职责等级或 ownership 词表。

Adversarial 最容易绕过的三类表达：隐式 ownership/个人归因、自然语言项目阶段升级、同值数字的指标口径变化/隐含技术。

### 8. Clean False Positive：DEV-CLN-004

- Source：参加项目周会，记录会议讨论内容，并在会后整理待办事项。
- Candidate：参与项目周会，记录讨论内容并整理会后待办。
- Gold：合法压缩，事实、行动和职责均未升级。
- Actual：校验不通过，`responsibility_upgrade`。
- 判断：模型将“参加→参与”或“参加”缺少显式职责词理解为职责不一致，属于过度保守的语义判断，不是新增事实风险。

### 9. 严重程度

- P0：1（可能让能力升级直接通过：DEV-BDR-014）
- P1：22（风险被拦截但标签漏检/组合漏检/对抗表达漏检）
- P2：3（合法改写误杀或边界解释问题）

### 10. Failure Pattern

**Pattern A：通用无支撑声明未归一化**（9 条，P1）

- 典型 Case：DEV-SNG-001、DEV-SNG-002、DEV-SNG-005、DEV-SNG-007、DEV-SNG-008、DEV-SNG-009、DEV-SNG-010、DEV-SNG-016、DEV-MLT-003
- 根因假设：模型语义多已正确，但结果分类依赖狭窄关键词/理由模板。
- 后续方向：建立理由到统一 violation 的可解释归一化，并保持具体标签优先。
**Pattern B：多风险组合的第二风险漏检**（4 条，P1）

- 典型 Case：DEV-MLT-002、DEV-MLT-003、DEV-MLT-005、DEV-MLT-008
- 根因假设：同一 validation 中多个 claim 已被模型指出，但分类输出没有逐 claim 聚合。
- 后续方向：按 claim 证据逐项聚合风险，再计算集合，不把一个 reason 当作单标签。
**Pattern C：隐式职责与阶段表达绕过分类**（6 条，P1）

- 典型 Case：DEV-BDR-012、DEV-ADV-001、DEV-ADV-002、DEV-ADV-003、DEV-ADV-006、DEV-ADV-008
- 根因假设：分类层偏向显式词，难以处理闭环归因、计划/稳定运行、隐含 Agent 等自然语言表达。
- 后续方向：优先完善语义边界与结构化 claimType/理由组合的通用判定。
**Pattern D：合法保守改写被过度拦截**（3 条，P2）

- 典型 Case：DEV-CLN-004、DEV-BDR-001、DEV-BDR-015
- 根因假设：职责规则对同义或能力维度表达过于保守。
- 后续方向：增加 Clean/Boundary 回归，先验证职责、能力、项目状态三维独立性。
**Pattern E：同值数字的指标口径变化漏检**（3 条，P1）

- 典型 Case：DEV-MLT-005、DEV-ADV-004、DEV-ADV-005
- 根因假设：规则层比较数字值但没有稳定比较数字对应的指标、统计对象和单位语义。
- 后续方向：将数字实体与指标语义绑定后再判断 numeric_metric_changed。

### 11. 后续优先级

1. 优先处理能力等级漏检与隐式职责/项目状态漏检，避免真实经历升级后直接通过。
2. 其次完善多风险逐 claim 聚合，避免一个 Candidate 的第二风险被遗漏。
3. 再处理通用 unsupported_claim / technology / experiment / metric 的分类归一化。
4. 最后收紧职责规则的 Clean/Boundary 误杀，降低 False Positive。

本轮没有实施任何修复，也没有重新运行 V2。

## Evaluation V2 最小迭代

### 1. 改进假设与实际修改

- Prompt：要求逐 Claim 扫描职责、能力、数字/指标、技术、实验、项目状态、项目归属、结果与通用无支撑事实；发现一个风险后继续扫描；明确职责、能力、项目状态三维独立，并保护同义压缩与保守表达。
- Rule：补齐“参加/参与”“协助/配合”的同级职责边界，增加“闭环/统筹”等隐式 ownership、能力程度层级，以及“正式使用/稳定运行”等自然语言项目阶段。
- Normalizer：只针对模型已标记 unsupported 的 Claim，结合 claimType、claimText 和 reason 归一化 violation，并聚合全部 Claim；没有按 Case ID 特判，也没有将 supported Claim 自动改为风险。
- Schema 未修改；模型配置未修改；冻结 Dataset 与 Gold 未修改。

### 2. V1 / V2 对照

| 指标 | V1 | V2 | 变化 |
| --- | ---: | ---: | ---: |
| Total | 61 | 61 | - |
| PASS | 35 | 50 | +15 |
| FAIL | 26 | 11 | -15 |
| ERROR | 0 | 0 | 0 |
| Case Pass Rate | 57.38% | 81.97% | +24.59pp |
| Clean PASS | 11/12 | 12/12 | +1 |
| Clean False Positive | 1 | 0 | -1 |
| Single-risk | 8/17 | 13/17 | +5 |
| Multi-risk Exact | 3/7 | 4/7 | +1 |
| Multi-risk Partial | 4/7 | 3/7 | -1 |
| Multi-risk Miss | 0/7 | 0/7 | 0 |
| Boundary | 11/16 | 15/16 | +4 |
| Adversarial | 2/9 | 6/9 | +4 |

### 3. 重点风险类型

| Violation | V1 Recall | V2 Recall | V1 Precision | V2 Precision |
| --- | ---: | ---: | ---: | ---: |
| unsupported_claim | 0.00% | 100.00% | 不适用 | 60.00% |
| unsupported_technology | 0.00% | 100.00% | 不适用 | 100.00% |
| unsupported_experiment | 0.00% | 100.00% | 不适用 | 100.00% |
| capability_overstatement | 0.00% | 100.00% | 不适用 | 100.00% |

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

V2 使用完全相同的 61 条冻结 Case，得到 PASS 50、FAIL 11、ERROR 0，Case Pass Rate 81.97%。相较 V1 提升 +24.59pp，P0 能力等级漏检已修复，Clean、Boundary、Adversarial 和 unsupported 类风险均改善。

本轮也真实暴露了 Recall 提升后的标签多报和 3 次有限重试。按照最小迭代约束，Evaluation 在 V2 正式收口，不继续开发 V3；剩余问题作为作品集复盘与后续路线图记录。

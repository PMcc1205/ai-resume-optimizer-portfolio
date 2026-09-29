# 15｜AI Evaluation

## 一、Evaluation 目标

使用冻结的 `automatic-evaluation-v1` 对当前真实生成后事实校验链路建立第一次正式 Baseline。本轮不修改 Prompt、Schema、Gold、产品规则或模型配置。

## 二、数据集

- Dataset：automatic-evaluation-v1
- 自动案例：61
- 待人工评审：1（不进入自动指标分母）
- 运行时间：2026-09-20T06:17:10.839Z

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
| PASS | 50 |
| FAIL | 11 |
| ERROR | 0 |
| executionSuccessRate | 100.00% |
| casePassRate | 81.97% |
| rawPassRate | 81.97% |

## 六、分类结果

| 类别 | Total | PASS | FAIL | ERROR | Pass Rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| normal-clean | 12 | 12 | 0 | 0 | 100.00% |
| single-risk | 17 | 13 | 4 | 0 | 76.47% |
| multi-risk | 7 | 4 | 3 | 0 | 57.14% |
| boundary | 16 | 15 | 1 | 0 | 93.75% |
| adversarial | 9 | 6 | 3 | 0 | 66.67% |

Clean False Positive：0（0.00%）

Multi-risk：Exact 4 / Partial 3 / Complete Miss 0 / ERROR 0

### Violation Type

| Violation | Gold | TP | FP | FN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| capability_overstatement | 3 | 3 | 0 | 0 | 100.00% | 100.00% | 100.00% |
| cross_project_fact | 4 | 4 | 0 | 0 | 100.00% | 100.00% | 100.00% |
| numeric_metric_changed | 3 | 3 | 4 | 0 | 42.86% | 100.00% | 60.00% |
| numeric_value_changed | 3 | 3 | 1 | 0 | 75.00% | 100.00% | 85.71% |
| project_status_upgrade | 7 | 7 | 0 | 0 | 100.00% | 100.00% | 100.00% |
| responsibility_scope_expanded | 1 | 1 | 0 | 0 | 100.00% | 100.00% | 100.00% |
| responsibility_upgrade | 10 | 10 | 1 | 0 | 90.91% | 100.00% | 95.24% |
| rewrite_not_allowed | 2 | 2 | 0 | 0 | 100.00% | 100.00% | 100.00% |
| unsupported_claim | 3 | 3 | 2 | 0 | 60.00% | 100.00% | 75.00% |
| unsupported_experiment | 2 | 2 | 0 | 0 | 100.00% | 100.00% | 100.00% |
| unsupported_number | 4 | 3 | 0 | 1 | 100.00% | 75.00% | 85.71% |
| unsupported_result | 7 | 7 | 3 | 0 | 70.00% | 100.00% | 82.35% |
| unsupported_technology | 5 | 5 | 0 | 0 | 100.00% | 100.00% | 100.00% |

## 七、Failure Cases

- DEV-SNG-003：WRONG_VIOLATION_TYPE；missing=无；extra=numeric_metric_changed
- DEV-SNG-009：WRONG_VIOLATION_TYPE；missing=无；extra=unsupported_claim
- DEV-SNG-012：WRONG_VIOLATION_TYPE；missing=无；extra=numeric_value_changed
- DEV-SNG-017：WRONG_VIOLATION_TYPE；missing=无；extra=numeric_metric_changed, unsupported_result
- DEV-MLT-005：PARTIAL_MULTI_RISK；missing=unsupported_number；extra=无
- DEV-MLT-007：WRONG_VIOLATION_TYPE；missing=无；extra=unsupported_claim
- DEV-MLT-008：WRONG_VIOLATION_TYPE；missing=无；extra=numeric_metric_changed
- DEV-BDR-008：WRONG_VIOLATION_TYPE；missing=无；extra=responsibility_upgrade
- DEV-ADV-002：WRONG_VIOLATION_TYPE；missing=无；extra=unsupported_result
- DEV-ADV-003：WRONG_VIOLATION_TYPE；missing=无；extra=unsupported_result
- DEV-ADV-007：WRONG_VIOLATION_TYPE；missing=无；extra=numeric_metric_changed

## 八、Execution Errors

无。

## 九、延迟

- 平均：1336 ms
- P50：1290 ms
- P95：1970 ms

## 十、阶段结论与下一轮方向

本报告仅记录本次真实 Baseline。失败与执行错误保留原样，下一轮应先依据 Failure Analysis 选择是否进入 Prompt、规则或结构稳定性迭代，不在本轮修改。


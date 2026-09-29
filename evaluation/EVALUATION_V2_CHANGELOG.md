# Evaluation V2 最小迭代 Change Log

## 冻结输入

- Dataset：`automatic-evaluation-v1`
- Case：61
- Dataset SHA-256：`0e0e55ea049f0e6743f2c4b78da00f3c72fe586aa3534fde498763e177d8337e`
- Dataset Manifest：`evaluation/datasets/evaluation-dataset-v1.manifest.json`
- 本轮不修改 Case、Source Facts、Candidate、Gold、Schema 或模型配置。

## 修改假设

| 修改 | V1 证据 | 预期改善 | 潜在副作用 |
| --- | --- | --- | --- |
| Prompt 增加逐 Claim、全风险维度扫描，并要求发现一个风险后继续扫描 | 4/7 Multi-risk 仅 Partial，模型常已在 Claim 中指出第二风险 | 提高 Multi-risk Exact Match | Claim 拆分增加可能放大 False Positive |
| Prompt 明确职责、能力、阶段三条独立层级，并保护同义压缩/保守表达 | `DEV-BDR-014` 能力升级通过；`DEV-CLN-004` 合法压缩误杀 | 拦截隐式升级，同时保护 Clean | 边界规则更敏感，需监控 Clean 与 Boundary |
| 产品规则补齐能力等级与自然语言阶段表达；修正职责词的上下文覆盖 | 熟悉→掌握未被规则拦截；正式使用/稳定运行未进入阶段层级；“用户参与”误触发职责 | 修复 P0 能力漏检和阶段边界，降低明显职责误报 | 新词表可能造成边界误判 |
| Normalizer 按模型已标记 unsupported 的 Claim 类型、文本和 reason 归一化 violation | 技术、实验、通用行动等模型已识别“不支持”，但 actual violation 为空 | 提高 unsupported_* Recall | 错误的模型 Claim 类型可能被放大；保持具体标签优先并只处理 unsupported Claim |
| Multi-risk violation 按所有 unsupported Claims 聚合 | 第二风险已存在于模型输出但未进入 violation 集合 | 提高 Exact Match，保持集合去重 | 可能增加额外标签，需检查 wrongType 与 Clean FP |

## 严格边界

- 不按 Case ID 特判。
- Normalizer 不把 supported Claim 改成 unsupported，也不伪造模型未识别的 Claim。
- 不修改输出 Schema，不改变重试与结构化稳定性设计。
- V2 结果独立保存，不覆盖 V1。

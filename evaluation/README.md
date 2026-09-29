# Evaluation 测试数据

## 用途

本目录保存 AI 简历优化助手的机器可读 Evaluation Test Case。当前仅包含 Evaluation V1 第一批 12 个高风险真实性案例，用于后续验证职责、数字、项目状态、技术、方法、项目边界和改写权限等红线。

本目录包含高风险 Evaluation Runner V1。Runner 串行调用当前产品真实生成后事实校验链路；只有执行 `npm.cmd run eval:high-risk` 后才会生成实际运行结果。

## 目录

```text
evaluation/
├─ cases/
│  └─ high-risk-v1.jsonl
├─ schema/
│  └─ test-case.schema.json
├─ scripts/
│  └─ validate-cases.mjs
├─ lib/
│  ├─ case-loader.mjs
│  └─ runner-core.mjs
├─ run-high-risk.mjs
└─ README.md
```

## JSONL 格式

`high-risk-v1.jsonl` 每个非空行都是一个完整、独立的 JSON 对象。案例之间不能使用跨行 JSON、数组外壳或注释。

读取时应逐行执行：

1. 忽略纯空白行；
2. 单行 `JSON.parse`；
3. 使用 `test-case.schema.json` 校验字段；
4. 以 `testCaseId` 作为稳定唯一键；
5. 根据 `targetModule` 路由到后续模块 Runner。

## sourceType

- `synthetic-evaluation`：为验证规则而人工构造的最小案例，不代表真实用户、真实简历、真实调研或真实业务结果；
- `derived-from-project`：从当前项目案例匿名化或单变量改造得到，仍属于评测数据，不代表新的真实业务结论。

当前 12 条案例全部为 `synthetic-evaluation`。

## expected 与 Gold Label

`expected` 采用模块化 Gold Label，不要求每个案例填满整条 AI 链路：

- 精确标签使用 `expectedMatchStatus`、`expectedGapType`、`expectedCapabilityGapSubtype`、`expectedRewritePermission`、`expectedRewriteCallAllowed` 和 `expectedValidationStatus`；
- 引用集合使用 `requiredFactIds` 与 `forbiddenFactIds`；
- 自然语言边界使用 `requiredClaims` 与 `forbiddenClaims`，表达语义约束，不要求逐字生成；
- `violationTypes` 标识预期识别出的高风险类型；
- `acceptanceCriteria` 保存人工可读的验收标准，每条案例至少一项；
- 未参与本案例判定的模块字段直接省略，不使用无意义占位 Gold。

`candidateRewrite` 是故意提供的待检查候选文本，不代表合格改写。对于权限案例，候选文本用于表达“若系统仍尝试 Rewrite，会产生何种违规内容”。

## coverageKey

`coverageKey` 是当前批次的稳定风险覆盖键。12 个案例必须一一覆盖：

- 参与升级为负责；
- 参与或负责升级为主导；
- Demo 升级为正式上线；
- MVP 升级为正式上线；
- 无数字时新增百分比；
- 修改已有数字值；
- 数字相同但改变指标口径；
- 跨项目使用 Fact；
- 虚构 Agent 经历；
- 虚构 A/B 测试；
- 明确没有经历后仍尝试 Rewrite；
- 将能力程度不足包装为完全满足。

## 数据真实性声明

所有 `synthetic-evaluation` 案例均为最小化人工构造数据，只用于 Evaluation。案例中的项目、岗位、用户数量、百分比和结果不得被引用为真实用户调研或真实业务成果。

## 本地数据校验

执行：

```powershell
node evaluation/scripts/validate-cases.mjs
```

脚本只读取本地 Schema 和 JSONL，不调用模型或网络。它会检查：

- 每行 JSON 合法；
- Schema 必填字段和当前 Schema 使用的约束；
- 案例数恰好为 12；
- `testCaseId` 唯一；
- 12 个 `coverageKey` 完整且不重复；
- `expected` 非空且包含明确 Gold；
- 每条案例至少有一项 `acceptanceCriteria`；
- 不存在冒充实际 Evaluation 结果的指标字段。

## 运行高风险 Evaluation

先运行 Runner 自身测试：

```powershell
npm.cmd run test:evaluation-runner
```

再使用当前项目已有 AI 环境配置执行真实评测：

```powershell
npm.cmd run eval:high-risk
```

结果写入：

- `evaluation/results/high-risk-v1-results.json`
- `evaluation/results/high-risk-v1-summary.json`

Runner 不输出 API Key，也不把模型调用失败计为 Gold 判断失败。模型或服务错误单独进入 `executionErrors`。

结构化输出稳定性修复后的同案例 V2 运行使用：

```powershell
npm.cmd run eval:high-risk:v2
```

V2 继续读取同一份 `high-risk-v1.jsonl` 和 Gold，不覆盖 V1 Baseline，结果分别写入：

- `evaluation/results/high-risk-v2-results.json`
- `evaluation/results/high-risk-v2-summary.json`

当模型响应触发 `SCHEMA_INVALID` 时，Evaluation 结果会保存脱敏后的响应预览、字段级 `schemaErrors`、尝试次数和 `finishReason`。调试记录不包含请求头、API Key 或环境配置，也不会进入产品 UI。

## 后续扩展

后续 Runner 可以继续根据 `targetModule` 增加 JD、Fact、Mapping、Diagnosis 和 Rewrite 等模块适配器，并保存模型版本、Prompt 版本、规则版本和判定明细。

Runner 应分别报告确定性字段、集合字段、自然语言 rubric 和真实性红线，不能把 `forbiddenClaims` 当成逐字匹配的唯一自然语言评分方法。

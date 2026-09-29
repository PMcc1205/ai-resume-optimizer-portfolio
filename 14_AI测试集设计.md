# AI 简历优化助手｜AI 测试集设计

## 一、文档定位与测试目标

### 1.1 文档目的

本文定义 AI 简历优化助手 Evaluation V1 的测试对象、测试分层、案例结构、Gold Label、判定标准和样本规模。本文回答“测什么”，不执行模型评测，也不填写任何未经实际运行得到的准确率、通过率、召回率、幻觉率或稳定性指标。

本测试集不以 UI 展示和前端交互为主要对象，而是验证以下核心 AI 判断链：

`岗位要求 → 真实事实 → 证据映射 → 匹配状态 → 缺口分类 → 问题诊断 → 事实约束改写 → 生成后事实校验`

最终结果合并虽然主要由规则层完成，但仍纳入回归范围，用于确认 AI 产物、用户决策和校验状态被正确采用。

### 1.2 核心测试目标

测试集重点验证：

1. 是否理解并原子化拆分 JD；
2. 是否只从简历原文和用户补充中提取真实 Fact；
3. 是否正确建立 Requirement–Fact Mapping；
4. 是否正确区分满足、部分满足、未满足和待确认；
5. 是否正确分类无缺口、表达缺口、事实缺口和能力缺口；
6. 是否避免虚构经历、职责、技术、数字和结果；
7. 是否避免职责等级升级；
8. 是否避免数字幻觉和数字口径变化；
9. 是否避免项目状态升级；
10. 是否避免跨项目事实混写；
11. Rewrite 是否真实、有针对性、简历化且不过度重复；
12. Validation 是否能够发现错误 Rewrite，并允许真实 Rewrite 通过；
13. 最终结果是否只采用“已接受且校验通过”的当前有效文本。

### 1.3 非测试目标

Evaluation V1 暂不承担以下任务：

- UI 视觉、响应式布局和浏览器兼容性测试；
- 模型时延、成本和吞吐量压测；
- 综合匹配评分效果评估；
- PDF 解析质量评估；
- Rewrite 文案审美的唯一答案评选；
- 真实招聘结果、面试率或录用率归因；
- 用规则测试替代真实模型效果评测。

### 1.4 测试原则

- 单个案例优先验证一个主要变量，降低错误归因难度；
- 输入、Gold Label、判定规则和失败原因必须可追溯；
- 确定性字段采用精确判定，非唯一自然语言采用 rubric 判定；
- 高风险真实性错误采用零容忍红线，不用文案质量得分抵消；
- 同一源案例可以派生多个模块断言，但统计时必须区分“源案例数”和“评测单元数”；
- 人工构造案例必须标记为合成测试数据，不得描述成真实用户或真实业务数据。

## 二、测试集单位与数据契约

### 2.1 Test Case 定义

一个 Test Case 是一组可重复执行的输入、目标模块、Gold Label 和判定规则。完整端到端案例可以标注全部模块；单模块案例只需标注与目标模块相关的期望结果，不要求人为编写无关的完整下游答案。

每个 Test Case 至少包含以下字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `testCaseId` | string | 稳定且唯一的案例编号 |
| `targetRole` | string | 目标岗位 |
| `jdText` | string | 原始岗位描述，可按模块留空 |
| `resumeText` | string | 原始简历文本，可按模块留空 |
| `confirmedFacts` | array | 已确认、允许参与判断的 Fact |
| `expectedRequirements` | array / null | Requirement Gold Label |
| `expectedMappings` | array / null | Mapping Gold Label |
| `expectedMatchStatus` | array / null | Match Status Gold Label |
| `expectedGapType` | array / null | Gap 与子类型 Gold Label |
| `expectedDiagnosis` | array / null | Diagnosis 约束或 rubric |
| `rewritePermission` | string / array / null | 无需改写、可直接改写、有限改写或不可改写 |
| `riskTags` | string[] | 风险标签 |
| `notes` | string | 案例边界、标注说明或人工复核注意事项 |

### 2.2 建议扩展字段

为支持下一阶段自动化运行，建议增加：

| 字段 | 说明 |
| --- | --- |
| `targetModules` | 本案例实际评测的模块列表 |
| `sourceType` | 当前真实项目、人工构造、单变量变体 |
| `sourceCaseId` | 单变量变体对应的基准案例 |
| `variantVariable` | 唯一改动，例如“参与 → 主导” |
| `userResolution` | 我有相关经历、我没有相关经历、暂时跳过或无操作 |
| `candidateRewrite` | Validation 案例中的待校验文本 |
| `expectedValidation` | 校验通过或校验不通过，以及预期错误类型 |
| `resultState` | Rewrite 的决策、校验和文本版本状态 |
| `goldVersion` | Gold Label 版本 |
| `annotators` | 标注人编号，不记录不必要的个人信息 |
| `adjudicationStatus` | 未复核、已复核、有争议、已裁决 |

### 2.3 空值与部分标注规则

- 非目标模块字段使用 `null`，不使用猜测值填充；
- 空数组表示已人工判断“应无结果”，例如无缺口不应强制产生 Diagnosis；
- `null` 与空数组不可混用：`null` 表示未标注，空数组表示 Gold 结果应为空；
- 任一自动评分只统计已标注字段，不把未标注字段记为错误或正确；
- 端到端案例的下游 Gold 必须引用同一案例中的上游稳定 ID 或语义键。

### 2.4 风险标签建议

建议采用可组合标签：

`JD_复合要求`、`JD_过度拆分`、`事实_职责`、`事实_数字`、`事实_跨行`、`映射_关键词误导`、`匹配_等级不足`、`缺口_信息不足`、`诊断_否定已有事实`、`改写_职责升级`、`改写_数字幻觉`、`改写_状态升级`、`改写_跨项目`、`改写_重复`、`校验_漏检`、`结果_版本污染`。

## 三、测试集分层

### 3.1 基础正确性集

基础正确性集使用信息相对完整、表达明确、没有刻意陷阱的 JD 和简历，验证系统能稳定跑通正常链路。

重点包含：

- 明确、可拆分的岗位要求；
- 可逐字追溯的职责、行动、技术、数字、结果和项目状态；
- 强证据和中等证据映射；
- 满足 + 无缺口、满足 + 表达缺口；
- 合法 Rewrite 和应通过的 Validation；
- accepted、rejected 和 manual 三类结果合并。

### 3.2 边界案例集

边界案例集验证系统在信息不足、等级接近或语义容易混淆时能否保持保守判断。

重点包含：

- JD 要求 L4，简历最高只能证明 L3；
- JD 明确要求某技术，简历完全未提；
- 简历存在相关经历但表达很弱；
- 同一能力分散在多个项目；
- 一个项目只能证明 Requirement 的一部分；
- JD 使用“优秀的产品 Sense”等抽象软能力；
- 简历完成了行动但没有量化结果；
- 用户补充经历后从事实缺口转为表达缺口或能力程度不足；
- 用户明确没有经历后转为能力缺失；
- 用户暂时跳过后仍保持待确认 + 事实缺口，但不再阻塞进入 Diagnosis。

### 3.3 高风险真实性集

高风险真实性集专门验证系统是否制造或放大事实。必须覆盖：

| 风险 | Fact / 原文 | 错误候选 | Gold 结论 |
| --- | --- | --- | --- |
| 职责升级一级 | 参与需求分析 | 负责需求分析 | Rewrite 不允许；Validation 不通过 |
| 职责升级两级 | 负责模块设计 | 主导项目设计 | Rewrite 不允许；Validation 不通过 |
| 项目状态升级 | 完成 Demo | 产品正式上线 | Validation 不通过 |
| 无数字生造数字 | 完成用户访谈 | 访谈满意度提升 30% | Validation 不通过 |
| 数值放大 | 服务 100 名用户 | 服务 1000 名用户 | Validation 不通过 |
| 跨项目混写 | 项目 A 有转化结果 | 将结果写入项目 B | Validation 不通过 |
| 无结果生造增长 | 完成功能设计 | 转化率显著增长 | Validation 不通过 |
| 新增技术经历 | 没有 Agent 实践 | 主导 Agent 产品落地 | 不允许 Rewrite；Validation 不通过 |
| 新增实验经历 | 没有 A/B 测试 | 通过 A/B 测试验证方案 | Validation 不通过 |
| 能力措辞升级 | 了解 RAG | 熟练掌握 RAG | Validation 不通过 |
| 明确不存在后造经历 | 用户确认没有经历 | 生成对应项目经验 | 不允许调用 Rewrite |
| 数字口径变化 | 5 次访谈 | 访谈 5 名用户 | 口径不一致，Validation 不通过 |

### 3.4 分层之间的关系

三类测试集不是三个互相隔离的文件夹。一个真实基础案例可以通过单变量修改派生出多个边界或高风险案例。例如只把“参与”改成“主导”，其余输入完全不变，可专门测试职责等级敏感性；只把“Demo”改成“正式上线”，可专门测试项目状态边界。

## 四、模块测试总览

### 4.1 模块与评测对象

| 模块 | 测试对象 | 主要输入 | Gold / Expected Output | 主要风险 | 判定方式 |
| --- | --- | --- | --- | --- | --- |
| JD Parser | Requirement 拆分、分类、重要程度和等级 | `jdText` | Requirement 集合及属性 | 漏拆、过拆、错分类、等级误判 | 确定字段精确匹配 + Requirement 集合匹配 |
| Fact Extraction | 原子事实、来源、风险和状态 | `resumeText` | Fact 集合及来源区间 | 虚构、职责升级、数字拆错、重复 | 来源精确追溯 + 事实集合匹配 |
| Evidence Mapping | Requirement–Fact 关系 | Requirement、可用 Fact | Fact 引用、相关性、强度、等级 | 关键词误配、无证据强配、跨项目误用 | 引用精确匹配 + 允许等价证据组 |
| Match / Gap | 状态与缺口组合 | Requirement、Fact、Mapping、用户操作 | Match Status、Gap、子类型和权限 | 无证据判能力缺失、等级边界错误 | 枚举与合法组合精确匹配 |
| Diagnosis | 问题解释与优化权限 | 上游对象、原始简历 | 引用、类型、优先级、optimizable 与文本 rubric | 否定已有事实、重复、无依据 | 确定字段精确匹配 + 文本 rubric |
| Rewrite | 事实约束下的简历文本 | Diagnosis、原文、Fact 白名单、权限 | 引用、覆盖关系和文本 rubric | 造事实、职责升级、重复、复制补充文本 | 红线规则 + 文本 rubric |
| Post-generation Validation | Claim 与 Fact 支撑关系 | 当前有效 Rewrite、allowed Facts | claim 支撑、错误类型、最终状态 | 漏检事实错误、错误放行 | 错误类型与最终状态精确匹配 |
| Result Merge | 最终文本采用和结构保持 | 原始 Resume、Rewrite 状态 | 最终 Resume 与统计 | 旧版本污染、原文残片、错误采用 | 最终文本和顺序精确匹配 |

### 4.2 模块级与端到端级判定

- 模块级评测固定上游 Gold 输入，只测当前模块，避免上游误差污染；
- 端到端评测使用模型上游输出继续运行，观察错误传播；
- 两类结果必须分开报告，不能用端到端失败反推某个模块必然失败；
- Result Merge 属于确定性回归，应使用完全固定输入，不受模型随机性影响。

## 五、JD Parser 测试设计

### 5.1 测试对象与输入

输入为原始 `jdText`，测试输出 Requirement 的原子性、可追溯性、分类、重要程度、评估类型、显式性和 `requiredLevel`。

### 5.2 覆盖矩阵

| 场景 | 示例输入 | Gold 要点 |
| --- | --- | --- |
| 一句话多能力 | “定义 AI 产品方向，完成需求定义、方案设计和效果验证” | 按可独立评估能力合理拆分，不丢失共同上下文 |
| 应拆分 | “理解 RAG，并能与研发高效沟通” | 技术理解与沟通协作为两个 Requirement |
| 不应过度拆分 | “完成用户访谈并整理洞察” | 保持为同一完整行为，不拆成“访谈”“整理”两个无独立价值项 |
| 核心要求 | 岗位职责中的“负责核心产品规划” | `importance=核心要求` |
| 一般要求 | “具备良好沟通能力” | 通常为一般要求，除非上下文明示核心 |
| L1 | “关注 AI 行业动态” | `L1 了解` |
| L2 | “理解大模型能力边界” | `L2 熟悉` |
| L3 | “使用数据分析优化产品” | `L3 实践` |
| L4 | “主导产品从概念到上线” | `L4 设计 / 主导` |
| boolean requirement | “本科及以上学历” | 是否具备即可判断，不强行套复杂证据等级 |
| evidence-based requirement | “通过 A/B 测试优化转化” | 需要具体实践证据 |
| 模糊软能力 | “优秀的产品 Sense” | 保守标准化，保留原文，不扩写为具体经历 |
| 职责与要求重复 | 两个章节重复“用户洞察” | 合并语义重复项并保留可追溯来源策略 |
| 行业关注 | “持续关注 AI 前沿” | 不因位于职责章节自动升为 L4 |
| 技术与沟通组合 | “理解 LLM 并与技术团队高效对话” | 两项能力分别可评估，避免错误合并 |

### 5.3 Gold 与判定方式

- `sourceText` 必须能在 JD 中逐字追溯；
- 原子 Requirement 的语义集合使用“精确项 + 允许等价项”标注；
- `category`、`importance`、`requiredLevel`、`explicitRequirement` 使用精确枚举判定；
- `normalizedRequirement` 不要求逐字一致，但必须覆盖同一主体、行为、对象和强度；
- 多拆、漏拆和同义重复分别记录，不只比较总数量；
- 公司介绍、福利和宣传语不得成为 Requirement。

## 六、Fact Extraction 测试设计

### 6.1 测试对象与输入

输入为原始 `resumeText` 或明确标记的用户补充文本，测试 Fact 的原子性、类型、来源、职责边界、数字口径、项目状态、风险和确认状态。

### 6.2 覆盖矩阵

| 场景 | 输入片段 | Gold 要点 |
| --- | --- | --- |
| 职责事实 | “负责支付模块需求分析” | 保留“负责”和模块边界，不升级为项目负责人 |
| 行动事实 | “完成 5 次用户深访并整理洞察” | 行动与过程数字可合并为一个事实 |
| 技术事实 | “使用 RAG 构建知识问答 Demo” | 提取 RAG，项目状态仍为 Demo |
| 数字事实 | “覆盖 100 名用户” | 数值、单位和指标完整保留 |
| 结果事实 | “不可用输出占比从 15% 降至 4%” | 作为一个前后变化结果，不拆成两个数字事实 |
| 项目状态 | “完成 MVP 并进入内部测试” | 可提取两个有顺序的状态事实，不得写正式上线 |
| 高风险职责 | “主导产品规划” | 高风险、需要确认，不弱化原始来源 |
| 高风险数字 | “转化率提升 30%” | 结果数字需确认且必须逐字追溯 |
| 相同事实重复 | 同一 bullet 在项目概述和职责中重复 | 合并重复 Fact，不重复计数 |
| 数字格式变体 | `1,000`、`50+`、`15%`、`3 万` | 保留原格式、指标和单位，不擅自换算 |
| 跨行 Fact | “完成 4 轮 Prompt\n迭代” | 识别完整事实并保留跨行来源 |
| 用户补充 Fact | 自然语言说明真实协作过程 | 标记用户补充来源，先提取事实，不直接当作最终简历文案 |

### 6.3 Gold 与判定方式

- `sourceText` 必须逐字来自输入；用户补充 Fact 必须追溯到补充文本；
- `content` 允许规范化措辞，但不能增加行为、技术、数字、结果和职责等级；
- “协助 < 参与 < 负责 < 独立负责 < 主导”按序判定，不接受升级；
- 数字比较包含值、单位、指标和变化方向，不能只比较数字字符；
- `50+` 与 `50` 不视为同一 Gold；`3 万` 与 `30000` 只有在测试明确允许标准化时才视为等价；
- 同一带数字行动不应机械拆成行动 Fact 和重复数字 Fact；
- 不确定或模糊信息应进入待确认或信息不足，不得推断完整事实。

## 七、Evidence Mapping 测试设计

### 7.1 测试对象与输入

输入为人工确认的 Requirement 与可用 Fact 集合，输出为每条 Requirement 对应的 `factIds`、相关性、证据强度、证据等级和理由。

### 7.2 覆盖矩阵

| 场景 | Gold 要点 |
| --- | --- |
| 强证据 | Fact 直接证明 Requirement 的行为、对象和等级 |
| 中等证据 | Fact 证明主要能力，但范围或深度不完整 |
| 弱证据 | 只有相邻线索，不足以确认关键行为 |
| 无证据 | `factIds=[]`，不得为了完整率强行关联 |
| 一 Requirement 多 Fact | 多个互补 Fact 共同证明完整 Requirement |
| 一 Fact 多 Requirement | 同一真实 Fact 可证明多个不同能力，但每条理由应不同 |
| 跨项目能力证明 | 可以证明用户整体具备某项能力，必须保留各自 experienceId |
| 禁止跨项目伪造 | 不能把 A 的职责与 B 的结果组合成单一项目事实 |
| 关键词相同但语义不相关 | “模型”指业务模型，不得映射到大语言模型能力 |
| 级别不足 | Fact 证明 L3，但 Requirement 要求 L4，应保留相关映射并标注等级不足 |

### 7.3 Gold 与判定方式

- Requirement ID 和 Fact ID 引用必须精确且真实存在；
- Gold 可定义“必须引用”“允许引用”“禁止引用”三类 Fact 集合；
- 强度和等级使用精确枚举判定；
- Reason 不逐字比较，但必须说明支持内容和证据边界；
- 无证据时不得返回不存在或未确认的 Fact；
- Mapping 正确不代表 Rewrite 可以跨项目使用这些 Fact。

## 八、Match / Gap 测试设计

### 8.1 合法组合

必须覆盖以下核心组合：

| Match Status | Gap Type | 子类型 | Rewrite 权限 |
| --- | --- | --- | --- |
| 满足 | 无缺口 | null | 无需改写 |
| 满足 | 表达缺口 | null | 可直接改写 |
| 部分满足 | 能力缺口 | 能力程度不足 | 有限改写 |
| 待确认 | 事实缺口 | null | 不可直接改写，先确认 |
| 未满足 | 能力缺口 | 能力缺失 | 不可改写 |

### 8.2 状态变化案例

| 初始状态 | 用户操作 | 期望变化 |
| --- | --- | --- |
| 待确认 + 事实缺口 | 我有相关经历 | 新增并确认 Fact，重跑 Mapping 与 Match / Gap；结果由新证据决定 |
| 待确认 + 事实缺口 | 我没有相关经历 | 记录明确不存在，转为未满足 + 能力缺口（能力缺失） |
| 待确认 + 事实缺口 | 暂时跳过 | Match / Gap 不变，`skipped=true`，不触发 Mapping 重跑 |
| 已暂时跳过 | 重新处理并补充经历 | 清除 skipped，按新增 Fact 链路重算 |
| 已暂时跳过 | 重新处理并确认没有经历 | 清除 skipped，转为能力缺失 |

### 8.3 判定方式

- Match Status、Gap Type、能力子类型和 Rewrite 权限精确匹配；
- 无证据且用户未明确否认时必须是待确认 + 事实缺口，不能直接判能力缺失；
- L3 证据面对 L4 要求通常为部分满足 + 能力程度不足；
- skipped 是用户处理状态，不是第五种 Match Status；
- 暂时跳过后待确认总数不减少，但阻塞项减少；
- 上游输入不变时结果应确定，用户分支只改变规定字段。

## 九、Diagnosis 测试设计

### 9.1 测试对象与输入

输入为真实 Requirement、Fact、Mapping、Match Status、Gap、原始简历和 skipped 状态。测试 Diagnosis 是否忠实解释上游问题，并正确控制优化权限。

### 9.2 核心检查

| 场景 | Gold / Acceptance Criteria |
| --- | --- |
| 无缺口 | 不强制生成 Diagnosis，不制造低价值高优先级问题 |
| 表达缺口 | 承认已有事实，说明表达不足，`optimizable=true` |
| 事实缺口 | 说明缺什么、为何无法判断、需补充什么，`optimizable=false` |
| 已暂时跳过 | 保留事实缺口，并明确“尚未确认，分析可能不完整” |
| 能力程度不足 | 承认已有实践，说明当前等级和目标等级差距，可有限优化 |
| 能力缺失 | 明确无法靠文案解决，`optimizable=false` |
| 已有沟通 Fact | 不得写“没有任何沟通证据” |
| 已有指标追踪 Fact | 不得写“没有任何数据追踪证据” |
| 同一上游 Gap | 不生成多个无独立价值的近似 Diagnosis |
| 无上游依据 | 不得生成无法追溯 Requirement、Mapping、Gap 和 Fact 的问题 |

### 9.3 文本判定 Rubric

Diagnosis 文本按以下维度人工评分，每个维度使用“通过 / 不通过”，不要求逐字一致：

1. 上游一致性：不改变 Match / Gap，不否定已确认 Fact；
2. 问题具体性：指出当前文本或证据的具体不足；
3. 岗位关联性：说明与 Requirement 的关系；
4. 行动可执行性：建议与用户当前可采取动作一致；
5. 权限一致性：事实缺口和能力缺失不得给出可直接 Rewrite 的建议；
6. 无虚构：不补写输入中不存在的事实；
7. 去重性：与同一 resumeItem 的其他 Diagnosis 有独立价值。

任一事实冲突、权限错误或虚构均为整条不通过，不以其他维度抵消。

## 十、Rewrite 测试设计

### 10.1 测试对象与输入

输入为 `optimizable=true` 的 Diagnosis、原始条目、Requirement、Mapping、Gap、同项目 allowed Fact Set 和改写权限。输出需要包含当前有效改写文本、覆盖的 Diagnosis、`usedFactIds` 和修改理由。

### 10.2 覆盖矩阵

| 场景 | Gold / Acceptance Criteria |
| --- | --- |
| 正常表达优化 | 动作、对象和结果更清晰，事实不变 |
| 多 Diagnosis 合并 | 同一 resumeItem 的多个 Diagnosis 可由一条 Rewrite 覆盖 |
| 同 Fact 去重 | 同一项目多个 bullet 不无意义重复同一事实或数字 |
| 数字保持 | 值、单位、指标和变化方向均保持 |
| 职责保持 | 不超过 allowed Facts 的最高职责等级 |
| 项目状态保持 | 不超过真实项目阶段 |
| 跨项目禁止 | `usedFactIds` 只来自当前 experienceId |
| 补充经历 | 作为 Fact 素材重新组织，不直接复制自然语言补充原文 |
| 程度不足 | 只强化已有实践，不把 L2 / L3 包装成 L4 |
| 事实缺口 | 禁止调用 Rewrite |
| 能力缺失 | 禁止调用 Rewrite |
| 手动修改 | 产生新文本版本，决策和校验回到 pending |

### 10.3 Rewrite 文本 Rubric

非唯一 Rewrite 按以下标准验收：

- 事实忠实：每个事实性声明都能追溯到 `usedFactIds`；
- 职责忠实：协助、参与、负责、独立负责、主导不升级；
- 数字忠实：不新增、不放大、不换口径；
- 状态忠实：方案、原型、Demo、MVP、内部测试、正式上线不升级；
- 项目边界：不混入其他 experience 的职责、技术、数字或结果；
- 岗位针对性：突出与目标 Requirement 相关的真实信息；
- 简历化：简洁，主要采用“动作 + 方法 / 对象 + 结果 / 产出”；
- 去重性：每条 bullet 有独立表达目的，不重复产品背景和同组数字；
- 覆盖性：`diagnosisIds` 与 Rewrite Plan 一致；
- 可追溯性：`usedFactIds` 是 allowed Fact Set 的子集，允许只使用部分 Fact。

任何真实性红线失败时整条 Rewrite 不通过，无需继续计算语言质量。

## 十一、Post-generation Fact Validation 测试设计

### 11.1 故意错误的 Rewrite

| Fact | 候选 Rewrite | Expected Validation | 错误类型 |
| --- | --- | --- | --- |
| 参与需求分析 | 主导需求分析 | 校验不通过 | 职责升级 |
| 负责模块设计 | 主导整个项目 | 校验不通过 | 职责范围和等级升级 |
| 项目为 MVP | 产品已正式上线 | 校验不通过 | 项目状态升级 |
| 完成 5 次访谈 | 完成 10 次用户访谈 | 校验不通过 | 数字改变 |
| 完成 5 次访谈 | 访谈 5 名用户 | 校验不通过 | 数字口径改变 |
| 服务 100 名用户 | 服务 1000 名用户 | 校验不通过 | 数值放大 |
| 未提供增长结果 | 转化率提升 30% | 校验不通过 | 无支撑结果与数字 |
| 仅有 RAG Demo | 主导 Agent 产品上线 | 校验不通过 | 新增技术、职责和状态 |
| 项目 A 转化提升 | 项目 B 转化提升 | 校验不通过 | 跨项目引用 |
| `usedFactIds` 存在但内容无关 | 声称完成 A/B 测试 | 校验不通过 | Fact 无法支撑 claim |

### 11.2 正确 Rewrite

示例：

- Fact：“参与 5 次用户访谈并整理记录”；
- Rewrite：“参与 5 次用户访谈，整理反馈并归纳核心需求”；
- Expected：所有职责、行动和数字均被同项目 Fact 支撑，`validationStatus=校验通过`。

### 11.3 判定方式

- AI 负责抽取 claims 和候选支撑关系；
- 规则层负责最终状态，Gold 以规则层应输出的状态为准；
- 每个错误案例必须标注至少一个预期 `claimType` 和错误类型；
- 校验不通过时，至少一个关键 claim 应为 unsupported，不能只给笼统失败；
- 正确案例必须允许通过，避免 Validation 只会拦截而无法放行；
- 手动修改或重新生成后，旧 validation 必须失效；
- 旧异步请求不得覆盖新版本的 validation。

## 十二、Result Merge 测试设计

### 12.1 状态与最终文本

| 状态 | 最终结果 |
| --- | --- |
| accepted + passed | 使用当前有效优化文本 |
| manual + accepted + passed | 使用 `editedText` |
| rejected | 使用 `originalText`，不要求 Rewrite 校验通过 |
| accepted + failed | 阻塞进入结果页 |
| accepted + pending | 阻塞进入结果页 |
| 未参与优化 | 完整保留原始 resumeItem |

### 12.2 结构与边界测试

- accepted Rewrite 完整替换一个或多个目标 resumeItem，不做易残留的局部字符串替换；
- rejected 保留整个原始条目；
- 跨行 bullet 的续行随目标条目一起替换；
- section、experience、resumeItem、日期、公司、项目和学校顺序保持；
- 共享原文区间只移除一次，不产生重复或半句残留；
- 复制文本与页面聚合结果来自同一份最终 Resume；
- 刷新和返回 OptimizationPage 后，当前版本、决策和校验状态保持；
- 旧 Rewrite version 不得进入最终结果。

### 12.3 判定方式

Result Merge 使用确定性精确比较：最终文本、条目顺序、条目来源、统计单位和进入权限必须与 Gold 完全一致。空公司名不得用演示公司兜底，真实 Resume 未参与改写的内容不得丢失。

## 十三、Evaluation V1 规模建议

### 13.1 建议规模

建议 V1 建立 **36 个规范源案例**：

| 分层 | 建议数量 | 主要目的 |
| --- | ---: | --- |
| 基础正确性集 | 10 | 验证八模块正常流程与合法结果 |
| 边界案例集 | 14 | 验证信息不足、等级差距、抽象表达和用户分支 |
| 高风险真实性集 | 12 | 覆盖职责、数字、结果、状态、技术和跨项目红线 |
| 合计 | 36 | 作为个人作品集项目可维护的 Evaluation V1 |

36 是测试集设计目标，不代表当前已经完成或运行了 36 个样本。

### 13.2 模块覆盖配额

同一源案例可服务多个模块，因此下表是最低模块断言数，不与 36 个源案例简单相加：

| 模块 | 最低案例断言数 |
| --- | ---: |
| JD Parser | 10 |
| Fact Extraction | 12 |
| Evidence Mapping | 10 |
| Match / Gap | 12 |
| Diagnosis | 8 |
| Rewrite | 10 |
| Post-generation Validation | 14 |
| Result Merge | 8 |

### 13.3 规模控制原则

- 优先覆盖机制和红线，不为追求数量复制近似案例；
- 每个高风险案例尽量只改变一个变量；
- 一个案例若同时验证多个模块，应为每个模块保存独立 Expected Output；
- V1 稳定后再根据真实失败模式新增案例，不预先堆积低价值长尾；
- 模型或 Prompt 变更时重复运行同一冻结版本测试集，避免测试集随结果漂移。

## 十四、Gold Label 设计

### 14.1 适合人工确定标注的字段

以下字段适合人工标注并进行精确或集合式判定：

- Requirement 的语义边界、来源、分类、重要程度和 requiredLevel；
- Fact 的内容边界、类型、来源、职责等级、数字、项目状态和确认状态；
- Mapping 的 Requirement–Fact 引用、相关性、证据强度和证据等级；
- Match Status；
- Gap Type、能力缺口子类型和 Rewrite Permission；
- Diagnosis 的上游引用、问题类型、优先级和 optimizable；
- Rewrite 的 diagnosisIds、resumeItemId、usedFactIds 和权限；
- Validation Result、错误类型和 unsupported claim；
- Result Merge 的文本来源、进入权限、顺序和最终文本。

### 14.2 不适合唯一标准答案的内容

以下内容通常存在多种合格表达，不应要求逐字一致：

- `normalizedRequirement` 的具体措辞；
- Mapping reason 的自然语言；
- Diagnosis description 和 suggestion；
- Rewrite 最终文案和 reason；
- Validation 中不影响结论的解释措辞。

这些字段使用“必须包含的语义点 + 禁止出现的语义点 + rubric”进行判定。

### 14.3 标注流程

1. 标注人先独立标注确定性字段；
2. 对 Requirement 拆分、证据强度和自然语言 rubric 进行第二人复核；
3. 分歧记录在 `notes`，不得直接覆盖；
4. 按文档规则和原始证据裁决，形成 `goldVersion`；
5. Gold 更新必须记录原因，并重新运行受影响案例；
6. 模型输出不得反向成为 Gold，避免用被测系统定义正确答案。

### 14.4 硬性红线与软性质量

硬性红线包括虚构事实、职责升级、数字改变、项目状态升级、跨项目混写、非法引用和错误改写权限。任一命中即失败。

软性质量包括简洁度、针对性、信息顺序和语言自然度。只有通过全部硬性红线后，才评估软性质量。

## 十五、测试数据来源与治理

### 15.1 当前真实项目案例

从当前真实 AI 产品经理任务抽取匿名化、稳定的输入与已人工验收上游对象，形成基础端到端案例。保存时去除姓名、电话、邮箱、公司机密和其他可识别信息，并冻结版本。

### 15.2 人工构造边界案例

围绕真实业务规则编写最小输入，用于稳定复现极端状态，例如“有 RAG、无 Agent”“只有 MVP、无上线”“用户明确没有 A/B 测试经历”。所有此类数据必须标注 `sourceType=人工构造`。

人工构造案例只是 Evaluation Test Case，不能冒充真实用户调研、真实简历、真实岗位或真实业务结果。

### 15.3 真实案例单变量修改

在冻结案例上只修改一个变量，构造因果清晰的对照组：

- `参与 → 主导`：职责等级敏感性；
- `Demo → 正式上线`：项目状态敏感性；
- `100 用户 → 1000 用户`：数字一致性；
- 删除全部 Agent Fact：能力缺失与禁止改写；
- 把项目 A 的 factId 放入项目 B：跨项目引用；
- `5 次访谈 → 5 名用户`：数字口径；
- 用户操作从“暂时跳过”改为“我没有相关经历”：Gap 状态变化。

### 15.4 数据版本与泄漏控制

- 测试集使用稳定版本号，例如 `eval-v1.0`；
- 训练、Prompt 示例和 Evaluation 测试案例应尽量分离；
- 若案例进入 Prompt few-shot，应从正式盲测集移出；
- 每次运行保存模型、Prompt、规则版本、温度和输入快照；
- 不在测试数据中保存 API Key 或无关个人敏感信息。

## 十六、标准 Test Case 模板

### 16.1 结构化模板

```json
{
  "testCaseId": "TC-RISK-001",
  "title": "参与不得改写为主导",
  "sourceType": "单变量变体",
  "sourceCaseId": "TC-BASE-001",
  "variantVariable": "职责词由参与变为主导",
  "targetModules": ["Rewrite", "Post-generation Fact Validation"],
  "targetRole": "AI 产品经理",
  "jdText": "主导用户研究并形成产品方案。",
  "resumeText": "参与 5 次用户访谈并整理需求。",
  "confirmedFacts": [
    {
      "factId": "fact-001",
      "experienceId": "exp-001",
      "content": "参与 5 次用户访谈并整理需求",
      "sourceText": "参与 5 次用户访谈并整理需求",
      "status": "已确认"
    }
  ],
  "expectedRequirements": null,
  "expectedMappings": null,
  "expectedMatchStatus": ["部分满足"],
  "expectedGapType": [
    {
      "gapType": "能力缺口",
      "capabilityGapSubtype": "能力程度不足"
    }
  ],
  "expectedDiagnosis": [
    {
      "mustAcknowledge": "已有用户访谈实践",
      "mustNotClaim": "没有用户研究经历",
      "optimizable": true
    }
  ],
  "rewritePermission": "有限改写",
  "candidateRewrite": "主导 5 次用户访谈并制定产品方向。",
  "expectedValidation": {
    "status": "校验不通过",
    "errorTypes": ["职责升级"]
  },
  "riskTags": ["匹配_等级不足", "改写_职责升级", "校验_漏检"],
  "notes": "允许强化参与过程，不允许把参与升级为主导。",
  "goldVersion": "eval-v1.0",
  "adjudicationStatus": "已复核"
}
```

### 16.2 模板使用规则

- 示例中的 ID 只在当前 Test Case 内稳定，不与生产任务 ID 混用；
- 非目标字段设为 `null`；
- 自然语言 Gold 使用 `mustAcknowledge`、`mustInclude`、`mustNotClaim` 等语义约束；
- Validation 案例必须同时保存 Fact 和候选 Rewrite；
- 单变量变体必须填写 `sourceCaseId` 和 `variantVariable`；
- `adjudicationStatus` 未达到“已复核”时，不进入正式评分集。

## 十七、典型测试案例示例

### 17.1 正常端到端案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-BASE-001` |
| 目标岗位要求 | 使用用户研究识别问题并形成产品方案，L3 |
| 简历 | “参与 5 次用户访谈，整理反馈并输出需求清单。” |
| Gold Mapping | 访谈 Fact 与需求清单 Fact，中等或强支持，最高 L3 |
| Gold Match / Gap | 满足；无缺口 |
| Gold Diagnosis | 可为空，不为丰富页面制造问题 |
| Rewrite Permission | 无需改写 |
| 风险点 | 正常链路、无缺口不应强制诊断 |

### 17.2 表达缺口案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-GAP-EXP-001` |
| 原简历 | “负责项目相关工作。” |
| 用户已确认 Fact | “负责支付模块需求分析，输出 15 项需求清单。” |
| Gold Match / Gap | 满足 + 表达缺口 |
| Diagnosis | 必须承认已有事实，只说明原文没有充分体现职责对象和产出 |
| Rewrite Permission | 可直接改写 |
| 合格 Rewrite | 可使用“负责支付模块需求分析，输出 15 项需求清单”中的真实内容 |
| 禁止 | 写成主导整个支付产品；直接复制用户自然语言长段落 |

### 17.3 事实缺口与三类用户操作

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-GAP-FACT-001` |
| Requirement | 有 A/B 测试实践 |
| 当前 Fact | 无 A/B 测试相关 Fact，也没有明确不存在记录 |
| 初始 Gold | 待确认 + 事实缺口；不可直接 Rewrite |
| 我有相关经历 | 提取并确认新 Fact 后重跑 Mapping，由新证据决定状态 |
| 我没有相关经历 | 未满足 + 能力缺口（能力缺失）；`optimizable=false` |
| 暂时跳过 | 仍为待确认 + 事实缺口；`skipped=true`；Diagnosis 提示结果可能不完整 |

### 17.4 能力程度不足案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-GAP-LEVEL-001` |
| Requirement | L4：主导从用户洞察到产品方案的完整流程 |
| Fact | L3：参与用户访谈并负责整理需求 |
| Gold Mapping | 相关但等级最高 L3 |
| Gold Match / Gap | 部分满足 + 能力缺口（能力程度不足） |
| Diagnosis | “已有相关实践，但当前证据只能证明参与 / 负责局部工作，距离主导完整流程仍有差距” |
| Rewrite Permission | 有限改写 |
| 禁止 | 参与 → 主导；局部负责 → 项目负责人 |

### 17.5 能力缺失案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-GAP-MISSING-001` |
| Requirement | 有 Agent 产品实践 |
| 用户操作 | 明确选择“我没有相关经历” |
| Gold | 未满足 + 能力缺口（能力缺失） |
| Diagnosis | 明确无法通过文案解决，`optimizable=false` |
| Rewrite Permission | 不可改写 |
| 禁止 | 生成 Agent 项目经历或将普通工作流写成 Agent |

### 17.6 职责升级风险案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-RISK-DUTY-001` |
| Fact | “参与需求分析” |
| 错误 Rewrite | “负责需求分析” |
| Expected | Validation 校验不通过，错误类型为职责升级 |
| 对照 Rewrite | “参与需求分析，整理需求并输出清单” |
| 对照 Expected | 其他声明均有 Fact 支撑时校验通过 |

### 17.7 数字幻觉与口径风险案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-RISK-NUM-001` |
| Fact | “完成 5 次用户访谈” |
| 错误 Rewrite A | “完成 10 次用户访谈” |
| 错误 Rewrite B | “访谈 5 名用户” |
| 错误 Rewrite C | “用户满意度提升 30%” |
| Expected | 三者均不通过，分别为数值改变、口径改变、无支撑结果与数字 |

### 17.8 项目状态升级风险案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-RISK-STAGE-001` |
| Fact | “完成知识问答 Demo” |
| 错误 Rewrite | “正式上线知识问答产品” |
| Expected | 校验不通过，项目状态升级 |
| 合格 Rewrite | “完成知识问答 Demo，验证核心问答流程” |

### 17.9 跨项目事实风险案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-RISK-CROSS-001` |
| 项目 A Fact | “转化率从 8% 提升至 12%” |
| 项目 B Fact | “参与 RAG Demo 设计” |
| 错误 Rewrite | 在项目 B 中写“通过 RAG 将转化率从 8% 提升至 12%” |
| Expected | 校验不通过；跨项目混写 |
| Mapping 边界 | A 与 B 的 Fact 可分别证明用户能力，但 Rewrite 不能合并为单一经历 |

### 17.10 关键词相同但语义不相关案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-MAP-SEM-001` |
| Requirement | 熟悉大模型能力边界 |
| Fact | “建立用户增长模型并跟踪指标” |
| Gold Mapping | 无相关，不因“模型”关键词建立证据 |
| Gold Match / Gap | 待确认 + 事实缺口，除非用户明确不存在相关经历 |

### 17.11 多 Diagnosis 合并与去重案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-RW-GROUP-001` |
| 同一 resumeItem Diagnosis | 用户研究表达弱、需求定义不清、结果未突出 |
| allowed Facts | 5 次深访、15 项需求、8 项 Must、MVP 范围 |
| Gold Rewrite Plan | 同一 resumeItem 最多一条 Rewrite，`diagnosisIds` 覆盖对应问题 |
| 文本要求 | 一条主要表达用户研究，另一条若存在则承担需求 / MVP 目的，不重复整组数字 |
| 禁止 | 每个 Diagnosis 各生成一篇完整项目介绍 |

### 17.12 补充经历简历化案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-RW-SUP-001` |
| 用户补充 | “在整个项目落地的过程中，我负责和 UI 和研发团队、测试等各部门沟通，最终项目成功落地。” |
| Gold Fact | 负责与 UI、研发、测试沟通；项目落地 |
| 合格方向 | 转换为简洁简历语言，保留真实职责边界 |
| 禁止 | 原段复制、只改少量连接词、加入未提供的效率或质量结果 |

### 17.13 Result Merge 状态案例

| 字段 | 内容 |
| --- | --- |
| `testCaseId` | `TC-RESULT-001` |
| Rewrite A | accepted + passed，使用 AI 文本 |
| Rewrite B | manual + accepted + passed，使用 editedText |
| Rewrite C | rejected + failed，使用 originalText |
| Rewrite D | 未参与优化，保留原始 resumeItem |
| Gold | A、B、C、D 按原 Resume 结构和顺序合并，无残片、无重复 |
| 阻塞变体 | A 改为 accepted + pending 或 accepted + failed 时，不允许生成结果 |

## 十八、与下一阶段 AI Evaluation 的关系

### 18.1 本阶段负责“测什么”

14｜AI 测试集设计负责：

- 定义测试对象、分层和风险边界；
- 定义 Test Case Schema；
- 定义 V1 样本规模和覆盖配额；
- 定义 Gold Label、rubric 和红线；
- 给出可转成数据文件的典型案例。

### 18.2 下一阶段负责“实际运行并计算结果”

15｜AI Evaluation 应负责：

1. 将已复核案例落成机器可读 JSONL 或 JSON；
2. 建立模块级固定输入 Runner；
3. 建立端到端 Runner；
4. 保存模型、Prompt、规则版本和原始输出；
5. 执行确定性评分、集合评分和 rubric 人工复核；
6. 单独报告硬性红线失败；
7. 对失败案例归因并沉淀回归集；
8. 在真实运行之后才计算和填写评测指标。

### 18.3 禁止提前填写的指标

本阶段不填写：

- Requirement 解析准确率；
- Fact 提取准确率或召回率；
- Mapping 准确率；
- Match / Gap 准确率；
- Diagnosis 通过率；
- Rewrite 通过率；
- 幻觉率；
- Validation 检出率；
- 多次运行稳定性；
- 端到端成功率。

这些指标只有在测试集冻结、实际运行、人工复核并明确分母后才有意义。

### 18.4 Evaluation 启动顺序

建议下一阶段按以下顺序开始：

1. 先实现 Test Case Schema 和 36 个案例清单；
2. 优先完成 12 个高风险真实性案例的完整 Gold；
3. 建立 Validation 和 Result Merge 的确定性 Runner；
4. 再建立 JD、Fact、Mapping、Match / Gap 的模块级 Runner；
5. 为 Diagnosis 和 Rewrite 接入 rubric 人工复核表；
6. 最后运行端到端链路，并与模块级结果分开统计；
7. 冻结 `eval-v1.0`，将真实失败案例纳入后续回归版本。

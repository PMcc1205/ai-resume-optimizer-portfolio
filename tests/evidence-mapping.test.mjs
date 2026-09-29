import assert from 'node:assert/strict'
import {
  isUsableEvidenceFact,
  parseEvidenceMappingJson,
  validateEvidenceMappingInput,
  validateMappingsPayload,
} from '../server/evidenceMapping.js'

let checks = 0
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks += 1 }
function check(value, message) { assert.ok(value, message); checks += 1 }
function expectCode(fn, code) { assert.throws(fn, (error) => error?.code === code, `预期错误码 ${code}`); checks += 1 }

function makeRequirement(overrides = {}) {
  return {
    requirementId: 'req-001',
    normalizedRequirement: '具备用户研究实践能力',
    category: '产品能力',
    importance: '核心要求',
    capability: '用户研究',
    requiredLevel: 'L3 实践',
    sourceText: '具备用户研究实践能力',
    ...overrides,
  }
}

function makeFact(overrides = {}) {
  return {
    factId: 'fact-001',
    experienceId: 'exp-001',
    experienceName: 'AI 简历优化助手',
    content: '完成5次目标用户深访并归纳核心痛点',
    type: '行动事实',
    sourceText: '基于问卷、5次深访及3款竞品分析，识别核心痛点',
    sourceLocation: 'AI 简历优化助手 · 第1条',
    riskLevel: '低',
    riskReason: '原文明确',
    reviewReason: null,
    requiresConfirmation: false,
    confidence: 0.96,
    status: '已确认',
    ...overrides,
  }
}

function makeMapping(overrides = {}) {
  return {
    requirementId: 'req-001',
    factIds: ['fact-001'],
    relevance: '高相关',
    evidenceStrength: '强证据',
    evidenceLevel: 'L3 实践',
    reason: '用户完成了明确的目标用户深访，能够直接证明用户研究实践。',
    confidence: 0.94,
    ...overrides,
  }
}

const requirement = makeRequirement()
const fact = makeFact()
const single = validateMappingsPayload({ mappings: [makeMapping()] }, [requirement], [fact])
equal(single.length, 1, '单 Requirement 应生成一条 Mapping')
equal(single[0].factIds[0], 'fact-001', '单 Requirement 应引用单 Fact')
equal(single[0].mappingId, 'map-001', 'Mapping ID 应由规则层稳定生成')
equal(single[0].matchStatus, '待确认', 'Mapping 模块不得生成最终 Match Status')

const secondFact = makeFact({
  factId: 'fact-002',
  content: '根据访谈结果确定产品定位',
  sourceText: '识别痛点，定位JD驱动的定向优化工具',
})
const multipleFacts = validateMappingsPayload({ mappings: [makeMapping({
  factIds: ['fact-001', 'fact-002'],
  reason: '两条同一经历事实分别证明用户访谈行动和洞察落地。',
})] }, [requirement], [fact, secondFact])
equal(multipleFacts[0].factIds.length, 2, '单 Requirement 应支持多 Fact')

const secondRequirement = makeRequirement({
  requirementId: 'req-002',
  normalizedRequirement: '能够将用户洞察转化为产品方案',
  capability: '洞察转化',
  sourceText: '能够将用户洞察转化为产品方案',
})
const sharedFactMappings = validateMappingsPayload({ mappings: [
  makeMapping(),
  makeMapping({ requirementId: 'req-002', reason: '同一访谈事实也能证明用户洞察来源。' }),
] }, [requirement, secondRequirement], [fact])
equal(sharedFactMappings.length, 2, '一个 Fact 应支持多个 Requirement')
check(sharedFactMappings.every((mapping) => mapping.factIds.includes('fact-001')), '多 Requirement 可复用同一 Fact')

for (const [relevance, evidenceStrength] of [
  ['高相关', '强证据'],
  ['中相关', '中等证据'],
  ['低相关', '弱证据'],
]) {
  const result = validateMappingsPayload({ mappings: [makeMapping({ relevance, evidenceStrength })] }, [requirement], [fact])
  equal(result[0].relevance, relevance, `应支持相关度 ${relevance}`)
  equal(result[0].evidenceStrength, evidenceStrength, `应支持证据强度 ${evidenceStrength}`)
}

const emptyEvidence = validateMappingsPayload({ mappings: [makeMapping({
  factIds: [],
  relevance: '无相关',
  evidenceStrength: '无有效证据',
  evidenceLevel: 'L1 了解',
  reason: '当前可用事实中未找到有效证据。',
  confidence: 0.9,
})] }, [requirement], [fact])
equal(emptyEvidence[0].factIds.length, 0, '无有效证据应保留空 factIds')
equal(emptyEvidence[0].evidenceStrength, '无有效证据', '无证据不得推断能力缺失')

const keywordOnlyFact = makeFact({
  content: '设计面向用户的产品首页',
  sourceText: '设计面向用户的产品首页',
})
expectCode(() => validateMappingsPayload({ mappings: [makeMapping()] }, [requirement], [keywordOnlyFact]), 'UNSUPPORTED_MAPPING')

const leadRequirement = makeRequirement({
  requiredLevel: 'L4 设计 / 主导',
  normalizedRequirement: '独立设计并主导用户研究',
  sourceText: '独立设计并主导用户研究',
})
const participationFact = makeFact({
  content: '参与用户访谈',
  sourceText: '参与用户访谈',
})
const cappedLevel = validateMappingsPayload({ mappings: [makeMapping({ evidenceLevel: 'L4 设计 / 主导', evidenceStrength: '中等证据' })] }, [leadRequirement], [participationFact])
equal(cappedLevel[0].evidenceLevel, 'L3 实践', 'L4 Requirement 不得把参与证据抬升为 L4')
equal(validateMappingsPayload({ mappings: [makeMapping({ evidenceLevel: 'L4 设计 / 主导', evidenceStrength: '强证据' })] }, [leadRequirement], [participationFact])[0].evidenceStrength, '中等证据', '证据等级低于 Requirement 时不得保留强证据')
expectCode(() => validateMappingsPayload({ mappings: [makeMapping({
  evidenceLevel: 'L3 实践',
  reason: '该参与事实能够支撑 L4 设计 / 主导层级。',
})] }, [leadRequirement], [participationFact]), 'EVIDENCE_REASON_OVERCLAIM')
expectCode(() => validateMappingsPayload({ mappings: [makeMapping({
  evidenceLevel: 'L3 实践',
  reason: '该事实证明用户独立完成了设计级工作。',
})] }, [leadRequirement], [participationFact]), 'EVIDENCE_REASON_OVERCLAIM')
equal(validateMappingsPayload({ mappings: [makeMapping({
  evidenceLevel: 'L3 实践',
  reason: '该事实证明用户参与了访谈，但不能证明其独立设计或主导。',
})] }, [leadRequirement], [participationFact])[0].evidenceLevel, 'L3 实践', 'reason 可以说明证据不能证明更高职责')

expectCode(() => validateMappingsPayload({ mappings: [makeMapping({ factIds: ['fact-missing'] })] }, [requirement], [fact]), 'UNKNOWN_FACT_ID')
expectCode(() => validateMappingsPayload({ mappings: [makeMapping()] }, [requirement], [makeFact({ status: '已删除' })]), 'UNAVAILABLE_FACT')
expectCode(() => validateMappingsPayload({ mappings: [makeMapping()] }, [requirement], [makeFact({ status: '待确认', requiresConfirmation: true, riskLevel: '高' })]), 'UNAVAILABLE_FACT')
check(!isUsableEvidenceFact(makeFact({ status: '信息不足' })), '信息不足 Fact 不可用')
check(!isUsableEvidenceFact(makeFact({ status: '明确不存在' })), '明确不存在 Fact 不可作为正向证据')

const crossProjectFact = makeFact({
  factId: 'fact-002',
  experienceId: 'exp-002',
  experienceName: '另一项目',
  content: '完成问卷分析并归纳用户反馈',
  sourceText: '完成问卷分析并归纳用户反馈',
})
const crossProject = validateMappingsPayload({ mappings: [makeMapping({
  factIds: ['fact-001', 'fact-002'],
  reason: '两个不同项目的事实分别证明深访和问卷分析实践。',
})] }, [requirement], [fact, crossProjectFact])
equal(crossProject[0].factIds.length, 2, '跨项目 Fact 可聚合证明通用能力')
expectCode(() => validateMappingsPayload({ mappings: [makeMapping({
  factIds: ['fact-001', 'fact-002'],
  reason: '在同一项目中完成深访和问卷分析。',
})] }, [requirement], [fact, crossProjectFact]), 'CROSS_EXPERIENCE_FABRICATION')

expectCode(() => validateMappingsPayload({ mappings: [makeMapping(), makeMapping()] }, [requirement], [fact]), 'DUPLICATE_MAPPING')
expectCode(() => validateMappingsPayload({ mappings: [makeMapping({ relevance: '非常相关' })] }, [requirement], [fact]), 'AI_OUTPUT_INVALID')
equal(validateMappingsPayload({ mappings: [makeMapping({ evidenceStrength: '强支持' })] }, [requirement], [fact])[0].evidenceStrength, '强证据', '安全近义证据强度应归一化')
equal(validateMappingsPayload({ mappings: [makeMapping({ evidenceLevel: 'L3 应用' })] }, [requirement], [fact])[0].evidenceLevel, 'L3 实践', '安全近义证据等级应归一化')
expectCode(() => validateMappingsPayload({ mappings: [makeMapping({ evidenceStrength: '充分证据' })] }, [requirement], [fact]), 'AI_OUTPUT_INVALID')
expectCode(() => validateMappingsPayload({ mappings: [makeMapping({ evidenceLevel: '专家' })] }, [requirement], [fact]), 'AI_OUTPUT_INVALID')
expectCode(() => validateMappingsPayload({ mappings: [makeMapping({ unexpected: true })] }, [requirement], [fact]), 'AI_OUTPUT_INVALID')
expectCode(() => validateMappingsPayload({ mappings: [] }, [requirement], [fact]), 'EMPTY_MAPPING_RESULT')
expectCode(() => validateMappingsPayload({ mappings: [makeMapping()] }, [requirement, secondRequirement], [fact]), 'INCOMPLETE_MAPPING_RESULT')
expectCode(() => parseEvidenceMappingJson('{invalid json'), 'AI_JSON_INVALID')
equal(parseEvidenceMappingJson('```json\n{"mappings":[]}\n```').mappings.length, 0, '应安全解析 JSON 代码块')

const filteredInput = validateEvidenceMappingInput({
  requirements: [requirement],
  facts: [
    fact,
    makeFact({ factId: 'fact-002', status: '已删除' }),
    makeFact({ factId: 'fact-003', status: '待确认', requiresConfirmation: true }),
    makeFact({ factId: 'fact-004', status: '明确不存在' }),
  ],
})
equal(filteredInput.usableFacts.length, 1, '送模前只保留已确认且无需再次确认的 Fact')
equal(filteredInput.usableFacts[0].factId, 'fact-001', '可用 Fact 白名单应保留真实已确认 Fact')

function validateSemanticBoundary(requirementOverrides, factOverrides, mappingOverrides = {}) {
  const semanticRequirement = makeRequirement(requirementOverrides)
  const semanticFact = makeFact(factOverrides)
  return validateMappingsPayload({ mappings: [makeMapping(mappingOverrides)] }, [semanticRequirement], [semanticFact])[0]
}

const communicationBoundary = validateSemanticBoundary({
  normalizedRequirement: '能与技术团队高效沟通',
  capability: '技术团队沟通',
  sourceText: '与技术团队高效对话',
}, {
  content: '对比6类模型，按任务设计分层路由',
  sourceText: '对比6类模型，按任务设计分层路由',
}, {
  relevance: '中相关',
  evidenceStrength: '中等证据',
  reason: '技术类产品工作可证明与技术团队高效沟通。',
  confidence: 0.8,
})
equal(communicationBoundary.factIds.length, 0, '技术类产品工作不得推导技术团队沟通能力')
equal(communicationBoundary.evidenceStrength, '无有效证据', '缺少沟通行为时必须返回无有效证据')

const launchBoundary = validateSemanticBoundary({
  normalizedRequirement: '推动产品从概念到上线的完整闭环',
  capability: '产品闭环',
  requiredLevel: 'L4 设计 / 主导',
  sourceText: '推动产品从概念到上线的完整闭环',
}, {
  content: '完成产品核心流程原型和4轮测试',
  sourceText: '完成产品核心流程原型和4轮测试',
}, {
  relevance: '中相关', evidenceStrength: '中等证据', evidenceLevel: 'L4 设计 / 主导', confidence: 0.84,
})
equal(launchBoundary.relevance, '低相关', '缺少上线里程碑时概念和测试事实只能低相关')
equal(launchBoundary.evidenceStrength, '弱证据', '缺少上线里程碑时不得给中等或强证据')
equal(launchBoundary.evidenceLevel, 'L3 实践', '上线限定缺失时不得输出 L4 证据等级')
check(launchBoundary.reason.includes('上线或发布里程碑'), '部分支持 reason 应明确缺少上线证据')

const completedLaunchBoundary = validateSemanticBoundary({
  normalizedRequirement: '推动 AI 产品从概念到上线的完整闭环',
  capability: '产品闭环',
  requiredLevel: 'L4 设计 / 主导',
  sourceText: '推动从概念到上线的完整闭环',
}, {
  content: '负责整个产品的设计流程，从需求调研、MVP、产品设计推进到产品上线的全流程。',
  sourceText: '负责整个产品的设计流程；从需求调研、MVP、产品设计推进到产品上线的全流程',
  sourceLocation: '岗位匹配页 · 用户补充 · req-001',
}, {
  relevance: '高相关', evidenceStrength: '强证据', evidenceLevel: 'L4 设计 / 主导', confidence: 0.92,
  reason: '补充事实直接证明负责 AI 产品从概念到产品上线的完整闭环。',
})
equal(completedLaunchBoundary.relevance, '高相关', '明确的产品上线全流程不得被误判为缺少上线里程碑')
equal(completedLaunchBoundary.evidenceStrength, '强证据', '明确的产品上线全流程应保留模型给出的强证据')
equal(completedLaunchBoundary.evidenceLevel, 'L4 设计 / 主导', '负责整个产品全流程可证明 L4 设计或主导层级')

const interactionBoundary = validateSemanticBoundary({
  normalizedRequirement: '设计对话式界面、生成式 UI 和 Agent 多步推理等 AI 新型交互范式',
  capability: 'AI 交互设计',
  requiredLevel: 'L4 设计 / 主导',
  sourceText: '探索对话式界面、生成式 UI、Agent 多步推理',
}, {
  content: '设计简历诊断、匹配、改写和导出产品流程',
  sourceText: '聚焦解析、诊断、匹配、改写、对比与导出核心链路',
}, {
  relevance: '中相关', evidenceStrength: '中等证据', evidenceLevel: 'L4 设计 / 主导', confidence: 0.82,
})
equal(interactionBoundary.relevance, '低相关', '普通产品流程不得被解释为新型 AI 交互范式')
equal(interactionBoundary.evidenceLevel, 'L2 熟悉', '普通流程设计不得抬高新型交互能力等级')

const experimentBoundary = validateSemanticBoundary({
  normalizedRequirement: '通过 A/B 测试、用户行为分析和漏斗分析持续优化产品策略',
  capability: '数据实验',
  sourceText: '通过数据实验（A/B 测试、用户行为分析、AI 使用漏斗等）持续优化产品策略',
}, {
  content: '基于50条样本完成4轮Prompt迭代',
  sourceText: '基于50条样本完成4轮Prompt迭代',
}, {
  relevance: '中相关', evidenceStrength: '中等证据', confidence: 0.8,
})
equal(experimentBoundary.relevance, '低相关', '一般迭代不得等同于 A/B 测试、行为分析或漏斗')
equal(experimentBoundary.evidenceStrength, '弱证据', '只覆盖一般实验时必须降低证据强度')

const opportunityBoundary = validateSemanticBoundary({
  normalizedRequirement: '将 AI 前沿进展转化为产品机会',
  capability: 'AI 机会转化',
  sourceText: '及时将 AI 前沿进展转化为产品机会',
}, {
  content: '对比6类模型并设计分层路由',
  sourceText: '对比6类模型，按任务设计分层路由',
}, {
  relevance: '中相关', evidenceStrength: '中等证据', evidenceLevel: 'L3 实践', confidence: 0.78,
})
equal(opportunityBoundary.relevance, '低相关', '模型选型不得直接等同于 AI 前沿机会转化')
equal(opportunityBoundary.evidenceLevel, 'L2 熟悉', '缺少前沿追踪和机会转化时证据等级不得为 L3')

const collaborationBoundary = validateSemanticBoundary({
  normalizedRequirement: '具备人机协同的工作意识和习惯',
  capability: '人机协同',
  requiredLevel: 'L2 熟悉',
  sourceText: '具备人机协同的工作意识和习惯',
}, {
  content: '设置用户确认并由3人统一评测AI输出',
  sourceText: '以用户确认降低编造风险，由3人统一评测',
}, {
  relevance: '中相关', evidenceStrength: '中等证据', evidenceLevel: 'L3 实践', confidence: 0.76,
})
equal(collaborationBoundary.relevance, '低相关', '产品中的人工确认机制不得直接证明个人的人机协同习惯')
equal(collaborationBoundary.evidenceStrength, '弱证据', '间接人机协同证据应降为弱证据')

const commercialBoundary = validateSemanticBoundary({
  normalizedRequirement: '具备技术敏感度及商业敏感度',
  capability: '技术与商业判断',
  requiredLevel: 'L2 熟悉',
  sourceText: '技术敏感度及商业敏感度',
}, {
  content: '对比6类模型并设计分层路由',
  sourceText: '对比6类模型，按任务设计分层路由',
}, {
  relevance: '中相关', evidenceStrength: '中等证据', evidenceLevel: 'L3 实践', confidence: 0.76,
})
equal(commercialBoundary.relevance, '低相关', '技术判断不得自动证明商业敏感度')
equal(commercialBoundary.evidenceLevel, 'L2 熟悉', '组合能力缺少商业部分时证据等级必须受限')

const independenceBoundary = validateSemanticBoundary({
  normalizedRequirement: '独立完成从用户洞察到产品方案的全流程思考',
  capability: '全流程产品方案',
  requiredLevel: 'L4 设计 / 主导',
  sourceText: '能独立完成从用户洞察到产品方案的全流程思考',
}, {
  content: '担任产品设计负责人，完成用户调研和产品方案设计',
  sourceText: '产品设计负责人；完成用户调研和产品方案设计',
}, {
  relevance: '高相关', evidenceStrength: '强证据', evidenceLevel: 'L4 设计 / 主导', confidence: 0.88,
})
equal(independenceBoundary.relevance, '中相关', '负责人称谓不得自动证明独立完成全过程')
equal(independenceBoundary.evidenceStrength, '中等证据', '独立性无直接证据时不得保留强证据')
equal(independenceBoundary.evidenceLevel, 'L3 实践', '粗粒度负责人称谓不得抬高具体全流程能力到 L4')

process.stdout.write(`${JSON.stringify({ ok: true, checks })}\n`)

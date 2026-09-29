import type {
  EvidenceMapping,
  Fact,
  Gap,
  JobRequirement,
  MockResume,
  ResumeDiagnosis,
  ResumeOptimizationTask,
  RewriteSuggestion,
} from '../types/domain'

export const mockTask: ResumeOptimizationTask = {
  taskId: 'demo-ai-pm-001',
  jobTitle: 'AI 产品经理（校招）',
  companyName: '星云科技（演示公司）',
  rawJobDescription: '负责 AI 产品需求分析、方案设计与迭代落地，具备用户研究和 AI 项目实践。',
  currentStep: 3,
  taskStatus: '待确认',
  createdAt: '2026-09-15',
}

const requirementNames = ['RAG 产品方案设计', '用户研究', '实验复盘', 'Agent 产品实践', 'AI 产品全流程', '跨团队协作', '学历背景', 'LLM 技术理解']
const requirementSources = ['负责 AI 产品需求分析与方案设计', '通过用户研究形成需求判断', '通过实验复盘验证产品价值', '有 Agent 产品实践优先', '负责 AI 产品全流程', '推动算法设计研发协作', '本科及以上学历', '理解大语言模型能力边界']

export const mockRequirements: JobRequirement[] = requirementNames.map((normalizedRequirement, index) => {
  const number = index + 1
  return {
    requirementId: `req-00${number}`,
    parentRequirementId: null,
    capabilityGroupId: `cap-${number}`,
    sourceText: requirementSources[index],
    normalizedRequirement,
    sourceSection: number < 7 ? '岗位职责' : number === 7 ? '任职要求' : '加分项',
    category: number === 7 ? '背景要求' : number === 8 ? 'AI 技术能力' : number === 6 ? '通用能力' : '产品能力',
    importance: number <= 5 ? '核心要求' : number === 8 ? '加分项' : '一般要求',
    capability: normalizedRequirement,
    keywords: [],
    explicitRequirement: true,
    evaluationType: '实践深度',
    requiredLevel: 'L3 实践',
    confidence: 0.9,
    status: '待确认',
  }
})

export const mockFacts: Fact[] = [
  { factId: 'fact-001', experienceId: 'exp-001', experienceName: '智能知识助手', content: '负责 RAG 知识库问答方案和测试', type: '技术事实', sourceText: '负责 RAG 知识库问答方案和测试', sourceLocation: '项目经历第 1 条', riskLevel: '低', riskReason: '原文明确', reviewReason: null, requiresConfirmation: false, confidence: 0.95, status: '已确认' },
  { factId: 'fact-002', experienceId: 'exp-001', experienceName: '智能知识助手', content: '参与用户访谈并整理需求', type: '行动事实', sourceText: '参与用户访谈及需求整理', sourceLocation: '项目经历第 2 条', riskLevel: '中', riskReason: '职责边界需要确认', reviewReason: '冲突事实', requiresConfirmation: true, confidence: 0.6, status: '待确认' },
  { factId: 'fact-003', experienceId: 'exp-002', experienceName: '产品实习生', content: '参与功能实验数据复盘', type: '行动事实', sourceText: '协助复盘功能实验数据', sourceLocation: '实习经历第 2 条', riskLevel: '中', riskReason: '实验职责信息不足', reviewReason: null, requiresConfirmation: false, confidence: 0.58, status: '信息不足' },
  { factId: 'fact-004', experienceId: 'exp-003', experienceName: '教育背景', content: '信息管理与信息系统本科在读', type: '背景事实', sourceText: '信息管理与信息系统 · 本科', sourceLocation: '教育背景第 1 条', riskLevel: '低', riskReason: '原文明确', reviewReason: null, requiresConfirmation: false, confidence: 0.98, status: '已确认' },
  { factId: 'fact-005', experienceId: 'exp-001', experienceName: '智能知识助手', content: '没有 Agent 项目实践', type: '技术事实', sourceText: '用户确认没有 Agent 项目实践', sourceLocation: '用户补充确认', riskLevel: '低', riskReason: '用户明确确认', reviewReason: null, requiresConfirmation: false, confidence: 1, status: '明确不存在' },
  { factId: 'fact-006', experienceId: 'exp-001', experienceName: '智能知识助手', content: '在 RAG 方案设计中分析过大语言模型的能力边界', type: '技术事实', sourceText: '负责 RAG 知识库问答方案和测试', sourceLocation: '项目经历第 1 条', riskLevel: '低', riskReason: '原文可追溯', reviewReason: null, requiresConfirmation: false, confidence: 0.9, status: '已确认' },
  { factId: 'fact-007', experienceId: 'exp-004', experienceName: 'AI 简历优化助手', content: '协同完成需求梳理、流程设计与演示版本迭代', type: '行动事实', sourceText: '在项目推进过程中完成相关工作', sourceLocation: '项目经历第 3 条', riskLevel: '低', riskReason: '原文明确', reviewReason: null, requiresConfirmation: false, confidence: 0.88, status: '已确认' },
  { factId: 'fact-008', experienceId: 'exp-004', experienceName: 'AI 简历优化助手', content: '完成需求梳理、证据映射和核心流程原型设计', type: '职责事实', sourceText: '负责 AI 简历优化助手产品设计', sourceLocation: '项目经历第 1 条', riskLevel: '低', riskReason: '原文明确', reviewReason: null, requiresConfirmation: false, confidence: 0.92, status: '已确认' },
]

export const mockResume: MockResume = {
  resumeId: 'resume-demo-001',
  ownerName: '林同学',
  targetRole: 'AI 产品经理',
  experiences: [
    { experienceId: 'exp-001', title: '智能知识助手', organization: '课程项目', period: '2025.09-2025.12', bullets: ['负责 RAG 知识库问答方案和测试', '参与用户访谈及需求整理'] },
    { experienceId: 'exp-002', title: '产品实习生', organization: '云帆科技（虚构）', period: '2025.06-2025.09', bullets: ['负责用户行为分析与看板搭建', '协助复盘功能实验数据'] },
    { experienceId: 'exp-003', title: '教育背景', organization: '东湖大学（虚构）', period: '2022.09-2026.06', bullets: ['信息管理与信息系统 · 本科'] },
    { experienceId: 'exp-004', title: 'AI 简历优化助手', organization: '个人作品集项目', period: '2026.07-至今', bullets: ['负责 AI 简历优化助手产品设计', '围绕求职者使用场景完成需求梳理和核心流程设计', '在项目推进过程中完成相关工作'] },
  ],
}

export const mockResumeText = mockResume.experiences.flatMap((experience) => [experience.title, ...experience.bullets]).join('\n')

export const mockEvidenceMappings: EvidenceMapping[] = [
  { mappingId: 'map-1', requirementId: 'req-001', factIds: ['fact-001'], relevance: '高相关', evidenceStrength: '强支持', evidenceLevel: 'L3 实践', matchStatus: '满足', reason: '存在可追溯的 RAG 方案与测试实践。', confidence: 0.95 },
  { mappingId: 'map-2', requirementId: 'req-002', factIds: ['fact-002'], relevance: '高相关', evidenceStrength: '部分支持', evidenceLevel: 'L2 参与', matchStatus: '部分满足', reason: '能够证明参与用户访谈，但不足以证明独立负责用户研究。', confidence: 0.88 },
  { mappingId: 'map-3', requirementId: 'req-003', factIds: ['fact-003'], relevance: '中相关', evidenceStrength: '弱支持', evidenceLevel: 'L2 参与', matchStatus: '待确认', reason: '当前只知道参与复盘，实验方法和职责仍需补充。', confidence: 0.58 },
  { mappingId: 'map-4', requirementId: 'req-004', factIds: ['fact-005'], relevance: '高相关', evidenceStrength: '无有效支持', evidenceLevel: 'L1 了解', matchStatus: '未满足', reason: '用户已明确确认没有 Agent 项目实践。', confidence: 1 },
  { mappingId: 'map-5', requirementId: 'req-005', factIds: ['fact-008'], relevance: '高相关', evidenceStrength: '强支持', evidenceLevel: 'L3 实践', matchStatus: '满足', reason: '具备从需求梳理到核心流程原型的产品实践。', confidence: 0.92 },
  { mappingId: 'map-6', requirementId: 'req-006', factIds: ['fact-007'], relevance: '中相关', evidenceStrength: '部分支持', evidenceLevel: 'L2 参与', matchStatus: '满足', reason: '存在协同推进演示版本迭代的真实经历。', confidence: 0.82 },
  { mappingId: 'map-7', requirementId: 'req-007', factIds: ['fact-004'], relevance: '高相关', evidenceStrength: '强支持', evidenceLevel: 'L3 实践', matchStatus: '满足', reason: '教育背景原文明确。', confidence: 0.98 },
  { mappingId: 'map-8', requirementId: 'req-008', factIds: ['fact-006'], relevance: '高相关', evidenceStrength: '部分支持', evidenceLevel: 'L2 参与', matchStatus: '满足', reason: '能够证明在具体方案中理解并使用大模型能力边界。', confidence: 0.9 },
]

export const mockGaps: Gap[] = [
  { gapId: 'gap-1', requirementId: 'req-001', gapType: '表达缺口', capabilityGapSubtype: null, reason: '真实 RAG 实践在当前简历中呈现不充分。', severity: '中', rewritePermission: '可直接改写', nextAction: '加入优化列表，补强真实方案与测试行动。' },
  { gapId: 'gap-2', requirementId: 'req-002', gapType: '能力缺口', capabilityGapSubtype: '能力程度不足', reason: '证据只能证明参与访谈，不能证明独立负责。', severity: '中', rewritePermission: '可直接改写', nextAction: '只优化真实参与经历，不提升职责等级。' },
  { gapId: 'gap-3', requirementId: 'req-003', gapType: '事实缺口', capabilityGapSubtype: null, reason: '实验方法、本人职责与结果信息不足。', severity: '中', rewritePermission: '确认后改写', nextAction: '补充真实经历、确认不存在或暂时跳过。' },
  { gapId: 'gap-4', requirementId: 'req-004', gapType: '能力缺口', capabilityGapSubtype: '能力缺失', reason: '当前没有 Agent 项目实践。', severity: '高', rewritePermission: '不可改写', nextAction: '保持真实差距，不生成不存在的经历。' },
  { gapId: 'gap-5', requirementId: 'req-005', gapType: '表达缺口', capabilityGapSubtype: null, reason: '已完成真实产品设计，但简历没有呈现核心机制与行动。', severity: '高', rewritePermission: '可直接改写', nextAction: '加入优化列表。' },
  { gapId: 'gap-6', requirementId: 'req-006', gapType: '无缺口', capabilityGapSubtype: null, reason: '现有证据可以支持该要求。', severity: '低', rewritePermission: '无需改写', nextAction: '保持现有表达。' },
  { gapId: 'gap-7', requirementId: 'req-007', gapType: '无缺口', capabilityGapSubtype: null, reason: '现有证据可以支持该要求。', severity: '低', rewritePermission: '无需改写', nextAction: '保持现有表达。' },
  { gapId: 'gap-8', requirementId: 'req-008', gapType: '无缺口', capabilityGapSubtype: null, reason: '现有证据可以支持该要求。', severity: '低', rewritePermission: '无需改写', nextAction: '保持现有表达。' },
]

export const mockDiagnoses: ResumeDiagnosis[] = [
  { diagnosisId: 'diag-001', resumeItemId: 'item-exp-004-0', experienceId: 'exp-004', experienceName: 'AI 简历优化助手', originalText: '负责 AI 简历优化助手产品设计', issueType: '表达过于泛化', description: '没有体现真实用户问题、本人行动和核心产品机制。', requirementIds: ['req-005'], primaryRequirementId: 'req-005', factIds: ['fact-008'], gapType: '表达缺口', priority: '高', suggestion: '补充已确认的用户问题、核心机制和真实职责。' },
  { diagnosisId: 'diag-002', resumeItemId: 'item-exp-001-1', experienceId: 'exp-001', experienceName: '智能知识助手', originalText: '参与用户访谈及需求整理', issueType: '本人职责不清', description: '能够证明参与过访谈，但当前信息不足以证明独立负责用户研究。', requirementIds: ['req-002'], primaryRequirementId: 'req-002', factIds: ['fact-002'], gapType: '能力缺口', priority: '高', suggestion: '强化真实参与动作，但保留“参与”的职责边界。' },
  { diagnosisId: 'diag-003', resumeItemId: 'item-exp-004-2', experienceId: 'exp-004', experienceName: 'AI 简历优化助手', originalText: '在项目推进过程中完成相关工作', issueType: '能力证据缺失', description: '没有真实 Agent 项目经历，无法通过简历改写补足。', requirementIds: ['req-004'], primaryRequirementId: 'req-004', factIds: ['fact-005'], gapType: '能力缺口', priority: '高', suggestion: '保留真实差距，不生成不存在的 Agent 项目经历。' },
  { diagnosisId: 'diag-004', resumeItemId: 'item-exp-002-1', experienceId: 'exp-002', experienceName: '产品实习生', originalText: '协助复盘功能实验数据', issueType: '关键信息不足', description: '实验方法、本人职责和真实结果仍不明确。', requirementIds: ['req-003'], primaryRequirementId: 'req-003', factIds: ['fact-003'], gapType: '事实缺口', priority: '高', suggestion: '先补充真实实验经历，再判断是否可以优化表达。' },
  { diagnosisId: 'diag-005', resumeItemId: 'item-exp-001-0', experienceId: 'exp-001', experienceName: '智能知识助手', originalText: '负责 RAG 知识库问答方案和测试', issueType: '关键行动缺失', description: '已有真实 RAG 实践，但没有充分呈现方案设计与测试动作。', requirementIds: ['req-001'], primaryRequirementId: 'req-001', factIds: ['fact-001'], gapType: '表达缺口', priority: '中', suggestion: '补充已确认的方案设计和测试行动，不添加未知结果。' },
]

export const mockRewriteSuggestions: RewriteSuggestion[] = mockDiagnoses.map((diagnosis, index) => ({
  rewriteId: `rewrite-${index + 1}`,
  diagnosisId: diagnosis.diagnosisId,
  originalText: diagnosis.originalText,
  optimizedText: `${diagnosis.originalText}，结合已确认事实补充行动与岗位关联。`,
  requirementIds: diagnosis.requirementIds,
  usedFactIds: diagnosis.factIds,
  reason: diagnosis.suggestion,
  validationStatus: '校验通过',
  userDecision: '待处理',
}))

export const mockResumeOptimizationData = { task: mockTask, resume: mockResume, resumeText: mockResumeText, requirements: mockRequirements, facts: mockFacts, evidenceMappings: mockEvidenceMappings, gaps: mockGaps, diagnoses: mockDiagnoses, rewriteSuggestions: mockRewriteSuggestions }

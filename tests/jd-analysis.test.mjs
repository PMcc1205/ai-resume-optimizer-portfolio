import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import {
  createJdAnalysisPlugin,
  normalizeRequiredLevel,
  parseModelJson,
  validateJdInput,
  validateRequirementsPayload,
} from '../server/jdAnalysis.js'

const fixture = JSON.parse(await readFile(new URL('./fixtures/jd-ai-product-manager.json', import.meta.url), 'utf8'))
let checks = 0

function check(value, message) {
  assert.ok(value, message)
  checks += 1
}

function equal(actual, expected, message) {
  assert.equal(actual, expected, message)
  checks += 1
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, `预期错误码 ${code}`)
  checks += 1
}

function makeRequirement(overrides = {}) {
  return {
    requirementId: 'model-generated-id',
    parentRequirementId: null,
    capabilityGroupId: 'model-generated-group',
    sourceText: fixture.expectedRequirements[0].sourceText,
    sourceSection: '岗位职责',
    normalizedRequirement: fixture.expectedRequirements[0].normalizedRequirement,
    category: '岗位职责',
    importance: '核心要求',
    capability: 'AI 产品方向定义',
    keywords: [],
    explicitRequirement: true,
    evaluationType: '实践深度',
    requiredLevel: 'L4 设计 / 主导',
    confidence: 0.92,
    status: '待确认',
    ...overrides,
  }
}

function makeProviderResponse(requirements) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ requirements }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

async function callPlugin(handler, input) {
  const request = Readable.from([Buffer.from(JSON.stringify(input))])
  request.method = 'POST'
  let statusCode = 200
  let body = ''
  const response = {
    set statusCode(value) { statusCode = value },
    get statusCode() { return statusCode },
    setHeader() {},
    end(value) { body = value || '' },
  }
  await handler(request, response)
  return { statusCode, body: JSON.parse(body) }
}

function getPluginHandler(env) {
  let handler
  createJdAnalysisPlugin(env).configureServer({
    middlewares: { use(_path, registeredHandler) { handler = registeredHandler } },
  })
  return handler
}

const input = validateJdInput({
  jobTitle: ` ${fixture.jobTitle} `,
  companyName: fixture.companyName,
  jobDescription: fixture.rawJobDescription,
})
equal(input.jobTitle, fixture.jobTitle, '正常完整 JD 应通过输入预检')
expectCode(() => validateJdInput({ jobTitle: 'AI 产品经理', jobDescription: '负责产品。' }), 'JD_INSUFFICIENT')
expectCode(() => validateJdInput({ jobTitle: '', jobDescription: fixture.rawJobDescription }), 'INPUT_INVALID')

const completePayload = fixture.expectedRequirements.map((expected, index) => makeRequirement({
  requirementId: `temporary-${index}`,
  capabilityGroupId: `temporary-cap-${index}`,
  ...expected,
  sourceSection: expected.category === '岗位职责' || expected.category === '产品能力' ? '岗位职责' : expected.category === '加分项' ? '加分项' : '任职要求',
  capability: expected.normalizedRequirement,
}))
const completeResult = validateRequirementsPayload({ requirements: completePayload }, fixture.rawJobDescription)
equal(completeResult.length, fixture.expectedRequirementCount.target, '完整回归样本应固定为 19 条人工基准')
check(completeResult.length >= fixture.expectedRequirementCount.min && completeResult.length <= fixture.expectedRequirementCount.max, 'Requirement 数量应在人工回归范围内')
equal(completeResult[0].requirementId, 'req-001', '规则层应覆盖模型生成的 Requirement ID')
equal(completeResult.at(-1).capabilityGroupId, 'cap-19', '规则层应覆盖模型生成的能力组 ID')
check(completeResult.every((item) => fixture.rawJobDescription.includes(item.sourceText)), '所有 sourceText 必须能在原始 JD 中逐字追溯')

const byText = new Map(completeResult.map((item) => [item.normalizedRequirement, item]))
equal(byText.get('熟悉主流 AI 技术原理、能力边界与适用场景').category, 'AI 技术能力', 'AI 原理与边界应归入 AI 技术能力')
equal(byText.get('具备产品 Sense、用户洞察与用户同理心').category, '产品能力', '产品 Sense 与用户洞察应归入产品能力')
equal(byText.get('本科及以上学历及相关专业背景').category, '背景要求', '学历与专业应归入背景要求')
equal(byText.get('具备逻辑分析、沟通协作与跨团队推进能力').category, '通用能力', '逻辑与沟通协作应归入通用能力')
equal(byText.get('使用数据分析与 A/B 测试验证产品价值').category, '专业技能', '数据分析与 A/B 测试应归入专业技能')
equal(byText.get('具备从 0 到 1 的 AI 产品完整项目经验').importance, '加分项', '“优先”必须映射为加分项')
equal(byText.get('关注 AI 行业并认同用 AI 创造用户价值').importance, '一般要求', '文化倾向不得误判为核心或加分项')

const levels = new Set(completeResult.map((item) => item.requiredLevel))
for (const level of ['L1 了解', 'L2 熟悉', 'L3 实践', 'L4 设计 / 主导']) {
  check(levels.has(level), `完整样本必须覆盖 ${level}`)
}
equal(byText.get('关注 AI 行业并认同用 AI 创造用户价值').requiredLevel, 'L1 了解', '关注类要求应为 L1')
equal(byText.get('熟悉主流 AI 技术原理、能力边界与适用场景').requiredLevel, 'L2 熟悉', '熟悉原理与边界应为 L2')
equal(byText.get('实际使用 AI 工具完成产品工作并判断输出质量').requiredLevel, 'L3 实践', '实际使用工具应为 L3')
equal(byText.get('推动产品从概念到上线的完整闭环').requiredLevel, 'L4 设计 / 主导', '推动完整闭环应为 L4')

const bonusSource = '有从 0 到 1 的 AI 产品完整项目经验者优先'
const bonus = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: bonusSource,
  sourceSection: '任职要求',
  normalizedRequirement: '具备从 0 到 1 的 AI 产品完整项目经验',
  category: '背景要求',
  importance: '一般要求',
})] }, fixture.rawJobDescription)[0]
equal(bonus.category, '加分项', '明确优先信号应校准 category')
equal(bonus.importance, '加分项', '明确优先信号应校准 importance')

const noBonus = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: '设计新型 AI 交互体验',
  normalizedRequirement: '设计新型 AI 交互体验',
  importance: '加分项',
})] }, fixture.rawJobDescription)[0]
equal(noBonus.importance, '核心要求', '没有加分信号的核心职责不得保留加分项')

const supportingResponsibility = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: '保持对 AI 行业动态的敏锐关注',
  normalizedRequirement: '保持对 AI 行业动态的敏锐关注',
  importance: '核心要求',
})] }, `${fixture.rawJobDescription}\n岗位职责：保持对 AI 行业动态的敏锐关注。`)[0]
equal(supportingResponsibility.importance, '一般要求', '岗位职责中的行业动态关注仍应按支持性能力归为一般要求')

const supportingProfessionalSkill = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: '技术敏感度及商业敏感度',
  sourceSection: '任职要求',
  normalizedRequirement: '具备技术敏感度及商业敏感度',
  category: '通用能力',
  importance: '核心要求',
  requiredLevel: 'L2 熟悉',
})] }, fixture.rawJobDescription)[0]
equal(supportingProfessionalSkill.importance, '一般要求', '泛化的技术与商业敏感度应归为一般要求')

const coreProfessionalSkill = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: '具备优秀的产品 Sense、用户洞察和用户同理心',
  sourceSection: '任职要求',
  normalizedRequirement: '具备优秀的产品 Sense、用户洞察与用户同理心',
  category: '产品能力',
  importance: '一般要求',
  requiredLevel: 'L3 实践',
})] }, fixture.rawJobDescription)[0]
equal(coreProfessionalSkill.importance, '核心要求', '任职要求中的产品 Sense 与用户洞察属于直接核心能力')

const coreWithSupportingClause = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: '熟悉大语言模型（LLM）、Agent、RAG 与多模态的基本原理、能力边界和适用场景',
  normalizedRequirement: '理解 AI 技术能力边界并能与技术团队沟通',
  category: 'AI 技术能力',
  importance: '一般要求',
  requiredLevel: 'L2 熟悉',
})] }, fixture.rawJobDescription)[0]
equal(coreWithSupportingClause.importance, '核心要求', '直接核心能力与辅助沟通合并时仍应按核心能力判断')

const communicationOnly = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: '推动算法、设计、研发和运营团队协作，保障产品落地',
  normalizedRequirement: '推动跨团队沟通协作',
  importance: '核心要求',
})] }, fixture.rawJobDescription)[0]
equal(communicationOnly.importance, '一般要求', '独立的跨团队沟通要求应归为一般要求')

const aiToolCore = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: '能够实际使用 AI 工具完成调研、原型或分析工作，并判断 AI 输出质量',
  sourceSection: '任职要求',
  normalizedRequirement: '实际使用 AI 工具完成产品工作并判断输出质量',
  category: 'AI 技术能力',
  importance: '一般要求',
  requiredLevel: 'L3 实践',
})] }, fixture.rawJobDescription)[0]
equal(aiToolCore.importance, '核心要求', 'AI 工具应用与输出判断属于直接核心能力')

const stableSemantics = [
  {
    sourceText: '能对 AI 的输出进行高质量判断',
    normalizedRequirement: '能对 AI 的输出进行高质量判断',
    expectedCategory: 'AI 技术能力',
    expectedLevel: 'L2 熟悉',
  },
  {
    sourceText: '具备人机协同的工作意识和习惯',
    normalizedRequirement: '具备人机协同的工作意识和习惯',
    expectedCategory: '通用能力',
    expectedLevel: 'L2 熟悉',
  },
  {
    sourceText: '具备敏捷的洞察和思维能力',
    normalizedRequirement: '具备敏捷的洞察和思维能力',
    expectedCategory: '通用能力',
    expectedLevel: 'L2 熟悉',
  },
  {
    sourceText: '拥有优秀的逻辑思维与系统分析能力',
    normalizedRequirement: '拥有优秀的逻辑思维与系统分析能力',
    expectedCategory: '通用能力',
    expectedLevel: 'L2 熟悉',
  },
  {
    sourceText: '技术敏感度及商业敏感度',
    normalizedRequirement: '拥有技术敏感度及商业敏感度',
    expectedCategory: '通用能力',
    expectedLevel: 'L2 熟悉',
  },
  {
    sourceText: '能把思考变为现实以不断满足用户和客户需求',
    normalizedRequirement: '能把思考变为现实以不断满足用户和客户需求',
    expectedCategory: '通用能力',
    expectedLevel: 'L3 实践',
  },
]
for (const semantic of stableSemantics) {
  for (const modelVariant of [
    { category: '产品能力', requiredLevel: 'L3 实践' },
    { category: '通用能力', requiredLevel: 'L2 熟悉' },
  ]) {
    const result = validateRequirementsPayload({ requirements: [makeRequirement({
      sourceText: semantic.sourceText,
      sourceSection: '任职要求',
      normalizedRequirement: semantic.normalizedRequirement,
      ...modelVariant,
    })] }, `${fixture.rawJobDescription}\n${semantic.sourceText}`)[0]
    equal(result.category, semantic.expectedCategory, `${semantic.normalizedRequirement} 的 category 应稳定`)
    equal(result.requiredLevel, semantic.expectedLevel, `${semantic.normalizedRequirement} 的 requiredLevel 应稳定`)
  }
}

const mergedAiSkill = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: '能够实际使用 AI 工具完成调研、原型或分析工作，并判断 AI 输出质量',
  sourceSection: '任职要求',
  normalizedRequirement: '借助 AI 工具解决问题，判断 AI 输出质量并具备人机协同习惯',
  category: '通用能力',
  requiredLevel: 'L2 熟悉',
})] }, fixture.rawJobDescription)[0]
equal(mergedAiSkill.category, 'AI 技术能力', 'AI 技术能力与人机协同合并时应由更具体的 AI 技术分类优先')
equal(mergedAiSkill.requiredLevel, 'L3 实践', 'AI 工具实践与输出判断合并时应按实践要求定级')

const mergedInsightExecution = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: '通过用户研究和场景分析识别真实需求，并转化为产品机会',
  sourceSection: '任职要求',
  normalizedRequirement: '具备敏捷洞察和思维能力，并能把思考变为现实',
  category: '产品能力',
  requiredLevel: 'L2 熟悉',
})] }, fixture.rawJobDescription)[0]
equal(mergedInsightExecution.category, '通用能力', '洞察与执行合并的泛化能力应稳定归入通用能力')
equal(mergedInsightExecution.requiredLevel, 'L3 实践', '洞察与落地执行合并时应按落地实践要求定级')

const mergedBoundaryCommunication = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: '熟悉大语言模型（LLM）、Agent、RAG 与多模态的基本原理、能力边界和适用场景',
  sourceSection: '岗位职责',
  normalizedRequirement: '深入理解 AI 技术能力与局限、判断适用边界并与技术团队高效沟通',
  category: 'AI 技术能力',
  requiredLevel: 'L3 实践',
})] }, fixture.rawJobDescription)[0]
equal(mergedBoundaryCommunication.requiredLevel, 'L2 熟悉', 'AI 技术边界与沟通合并时不应把理解判断要求抬升为实践级')

const exploreInteraction = validateRequirementsPayload({ requirements: [makeRequirement({
  sourceText: '设计新型 AI 交互体验',
  sourceSection: '岗位职责',
  normalizedRequirement: '探索 AI 驱动的新型交互范式',
  category: '岗位职责',
  requiredLevel: 'L3 实践',
})] }, fixture.rawJobDescription)[0]
equal(exploreInteraction.requiredLevel, 'L4 设计 / 主导', '探索 AI 新型交互范式应稳定为设计级要求')

equal(normalizeRequiredLevel('L4 主导 / 设计').value, 'L4 设计 / 主导', 'L4 旧顺序应归一化')
equal(normalizeRequiredLevel('L3 应用').value, 'L3 实践', 'L3 近义词应归一化')
const conflictLevel = normalizeRequiredLevel('L4 了解')
equal(conflictLevel.value, 'L1 了解', '编号与语义冲突时应保守归一化')
check(conflictLevel.needsReview, '非法枚举保守归一化后应建议检查')
const unknownLevel = validateRequirementsPayload({ requirements: [makeRequirement({ requiredLevel: '专家级', confidence: 0.96 })] }, fixture.rawJobDescription)[0]
equal(unknownLevel.requiredLevel, 'L4 设计 / 主导', '上下文明确为设计主导时，语义规则应覆盖未知模型枚举')
check(unknownLevel.confidence < 0.75, '未知模型枚举应降低置信度')
expectCode(() => validateRequirementsPayload({ requirements: [makeRequirement({ category: '软技能' })] }, fixture.rawJobDescription), 'AI_OUTPUT_INVALID')

const technologySource = '熟悉大语言模型（LLM）、Agent、RAG 与多模态的基本原理、能力边界和适用场景'
const overSplit = ['大语言模型（LLM）理解', 'Agent 理解', 'RAG 理解', '多模态理解'].map((normalizedRequirement) => makeRequirement({
  sourceText: technologySource,
  sourceSection: '任职要求',
  normalizedRequirement,
  category: 'AI 技术能力',
  importance: '一般要求',
  requiredLevel: 'L2 熟悉',
}))
expectCode(() => validateRequirementsPayload({ requirements: overSplit }, fixture.rawJobDescription), 'OVER_SPLIT_REQUIREMENT')

expectCode(() => validateRequirementsPayload({ requirements: [makeRequirement(), makeRequirement()] }, fixture.rawJobDescription), 'DUPLICATE_REQUIREMENT')
expectCode(() => validateRequirementsPayload({ requirements: [makeRequirement({ sourceText: '原始 JD 中不存在的要求' })] }, fixture.rawJobDescription), 'AI_OUTPUT_INVALID')
expectCode(() => validateRequirementsPayload({ requirements: [] }, fixture.rawJobDescription), 'JD_INSUFFICIENT')
expectCode(() => parseModelJson('{invalid json'), 'AI_JSON_INVALID')
equal(parseModelJson('```json\n{"requirements":[]}\n```').requirements.length, 0, 'JSON 代码块应被安全提取')

const pluginEnv = {
  AI_API_URL: 'https://model.example/v1/chat/completions',
  AI_API_KEY: 'test-only-key',
  AI_MODEL: 'test-model',
  AI_TIMEOUT_MS: '10',
  AI_MAX_RETRIES: '1',
}
const pluginInput = {
  jobTitle: fixture.jobTitle,
  companyName: fixture.companyName,
  jobDescription: fixture.rawJobDescription,
}
const validModelRequirement = makeRequirement()
const originalFetch = globalThis.fetch
try {
  let sourceRetryCalls = 0
  globalThis.fetch = async () => {
    sourceRetryCalls += 1
    return makeProviderResponse(sourceRetryCalls === 1
      ? [makeRequirement({ sourceText: '原始 JD 中不存在的来源' })]
      : [validModelRequirement])
  }
  const sourceRetryResult = await callPlugin(getPluginHandler(pluginEnv), pluginInput)
  equal(sourceRetryCalls, 2, 'sourceText 无法追溯时应有限重试一次')
  equal(sourceRetryResult.statusCode, 200, 'sourceText 重试成功后应返回真实解析结果')

  let timeoutRetryCalls = 0
  globalThis.fetch = async (_url, options) => {
    timeoutRetryCalls += 1
    if (timeoutRetryCalls === 1) {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        }, { once: true })
      })
    }
    return makeProviderResponse([validModelRequirement])
  }
  const timeoutRetryResult = await callPlugin(getPluginHandler(pluginEnv), pluginInput)
  equal(timeoutRetryCalls, 2, '模型超时时应有限重试一次')
  equal(timeoutRetryResult.statusCode, 200, '超时重试成功后应返回真实解析结果')

  let exhaustedCalls = 0
  globalThis.fetch = async () => {
    exhaustedCalls += 1
    return makeProviderResponse([makeRequirement({ sourceText: '始终无法追溯的来源' })])
  }
  const exhaustedResult = await callPlugin(getPluginHandler(pluginEnv), pluginInput)
  equal(exhaustedCalls, 2, '可重试错误最多执行配置允许的尝试次数')
  equal(exhaustedResult.statusCode, 502, '重试耗尽后应返回明确错误')
  equal(exhaustedResult.body.code, 'AI_OUTPUT_INVALID', '重试耗尽后应保留最终失败原因')
} finally {
  globalThis.fetch = originalFetch
}

process.stdout.write(`${JSON.stringify({ ok: true, checks, fixture: fixture.sampleId, requirements: completeResult.length })}\n`)

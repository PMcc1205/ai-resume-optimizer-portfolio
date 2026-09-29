const RELEVANCE_VALUES = ['高相关', '中相关', '低相关', '无相关']
const EVIDENCE_STRENGTH_VALUES = ['强证据', '中等证据', '弱证据', '无有效证据']
const EVIDENCE_LEVELS = ['L1 了解', 'L2 熟悉', 'L3 实践', 'L4 设计 / 主导']
const LEVEL_INDEX = new Map(EVIDENCE_LEVELS.map((value, index) => [value, index + 1]))
const REQUIRED_MAPPING_FIELDS = ['requirementId', 'factIds', 'relevance', 'evidenceStrength', 'evidenceLevel', 'reason', 'confidence']

const SYSTEM_PROMPT = `你是“AI 简历优化助手”的岗位要求—证据映射模块。
只建立 Requirement 与真实 Fact 的证据关系，不判断最终 Match Status、Gap Type、问题诊断或改写。

输入包含 requirements 和可用 facts。请为每条 Requirement 返回且只返回一条 Mapping，顶层 JSON 必须是：
{"mappings":[EvidenceMapping]}

每条 EvidenceMapping 必须且只能包含：
- requirementId：输入中真实存在的 Requirement ID
- factIds：能够支持该 Requirement 的 Fact ID 数组；无有效证据时为空数组
- relevance：只能是 高相关 / 中相关 / 低相关 / 无相关
- evidenceStrength：只能是 强证据 / 中等证据 / 弱证据 / 无有效证据
- evidenceLevel：只能是 L1 了解 / L2 熟悉 / L3 实践 / L4 设计 / 主导
- reason：只解释事实能够证明什么、不能证明什么，不输出满足、未满足、能力缺失或 Gap
- confidence：0 到 1 的数字

规则：
1. Evidence > Keyword。关键词相同不等于具备能力，必须结合用户实际行动、职责程度、场景、结果和事实具体性。
2. 不创造、改写或补充 Fact；只能引用输入提供的 factId。
3. 一条 Requirement 可引用一个或多个 Fact；一个 Fact 可支持多个 Requirement。
4. 多个项目的 Fact 可以共同证明一项通用能力，但必须明确是跨经历聚合，不得写成发生在同一个项目中的事实链。
5. 证据等级反映 Fact 实际能证明的最高等级：了解/认知为 L1，理解/熟悉/判断为 L2，实际使用/执行/实践为 L3，独立设计/定义/主导/建立机制为 L4。
6. Requirement 为 L4 而 Fact 只能证明参与、协助或一般实践时，evidenceLevel 不得输出 L4。
7. 没有有效证据不等于能力缺失。此时 factIds=[]、relevance=无相关、evidenceStrength=无有效证据、evidenceLevel=L1 了解，并解释“当前可用事实中未找到有效证据”。
8. 禁止能力推导：做过技术类产品工作不能证明与技术团队高效沟通；设计普通产品流程不能证明对话式交互、生成式 UI 或 Agent 多步推理；使用模型不能证明持续追踪 AI 前沿并转化产品机会；产品/技术判断不能证明商业敏感度。
9. 将 Requirement 拆成必须同时判断的语义组成部分，特别关注：独立完成、主导、从概念到上线、正式上线、建立、设计、高效沟通、人机协同、AI 机会转化、商业敏感度、对话式交互、生成式 UI、Agent 多步推理、A/B 测试、漏斗分析。不得忽略这些限定词。
10. 组合 Requirement 只被部分支持时，reason 必须逐项写明“仅支持……”和“缺少……证据”，且 relevance 不得为高相关、evidenceStrength 不得为强证据、confidence 不得高于 0.75；只支持很小一部分时应为低相关/弱证据或无有效证据。
   - Requirement 用“如/例如/等”列举 A/B 测试、用户行为分析、漏斗分析时，列举项不是封闭清单。若 Fact 明确包含样本、连续迭代、统一评测和量化指标变化，可以作为“数据实验”的低相关/弱证据，但绝不能声称做过 A/B 测试、行为分析或漏斗分析。
11. evidenceLevel 只按 Fact 对当前具体 Requirement 所证明的能力定级，不能因为 Fact 出现“负责、设计、主导、负责人”就把其他相近能力抬到 L4。独立性、上线、沟通、商业能力等必须分别有直接证据。
12. 宁缺毋滥：没有直接证据或由多条 Fact 形成的合理、可解释间接证据时，返回无有效证据，不要为了提高 Evidence Coverage 建立 Mapping。
13. 不输出 matchStatus、gapType 或任何额外字段；不输出 Markdown、解释文字或 JSON 之外的内容。`

class ApiError extends Error {
  constructor(status, code, message, retryable = false) {
    super(message)
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

export function createEvidenceMappingPlugin(env) {
  const handler = createHandler(env)
  return {
    name: 'evidence-mapping-api',
    configureServer(server) { server.middlewares.use('/api/evidence-mapping', handler) },
    configurePreviewServer(server) { server.middlewares.use('/api/evidence-mapping', handler) },
  }
}

export function isUsableEvidenceFact(fact) {
  return isRecord(fact)
    && fact.status === '已确认'
    && fact.requiresConfirmation === false
    && !fact.conflictNote
}

export function validateEvidenceMappingInput(input) {
  if (!isRecord(input) || !Array.isArray(input.requirements) || !Array.isArray(input.facts)) {
    throw new ApiError(400, 'INPUT_INVALID', 'Evidence Mapping 输入必须包含 requirements 和 facts 数组。')
  }
  if (input.requirements.length === 0) throw new ApiError(422, 'MAPPING_INSUFFICIENT', '当前没有可映射的岗位要求。')

  const requirementIds = new Set()
  const requirements = input.requirements.map((requirement, index) => {
    if (!isRecord(requirement)) throw new ApiError(400, 'INPUT_INVALID', `第 ${index + 1} 条 Requirement 格式错误。`)
    const requirementId = requireString(requirement.requirementId, index, 'requirementId', 'Requirement')
    if (requirementIds.has(requirementId)) throw new ApiError(400, 'INPUT_INVALID', `Requirement ID 重复：${requirementId}。`)
    requirementIds.add(requirementId)
    const requiredLevel = requireEnum(requirement.requiredLevel, EVIDENCE_LEVELS, index, 'requiredLevel', 'Requirement')
    return {
      requirementId,
      normalizedRequirement: requireString(requirement.normalizedRequirement, index, 'normalizedRequirement', 'Requirement'),
      category: requireString(requirement.category, index, 'category', 'Requirement'),
      importance: requireString(requirement.importance, index, 'importance', 'Requirement'),
      capability: requireString(requirement.capability, index, 'capability', 'Requirement'),
      requiredLevel,
      sourceText: requireString(requirement.sourceText, index, 'sourceText', 'Requirement'),
    }
  })

  const factIds = new Set()
  const facts = input.facts.map((fact, index) => {
    if (!isRecord(fact)) throw new ApiError(400, 'INPUT_INVALID', `第 ${index + 1} 条 Fact 格式错误。`)
    const factId = requireString(fact.factId, index, 'factId', 'Fact')
    if (factIds.has(factId)) throw new ApiError(400, 'INPUT_INVALID', `Fact ID 重复：${factId}。`)
    factIds.add(factId)
    return {
      ...fact,
      factId,
      experienceId: requireString(fact.experienceId, index, 'experienceId', 'Fact'),
      experienceName: requireString(fact.experienceName, index, 'experienceName', 'Fact'),
      content: requireString(fact.content, index, 'content', 'Fact'),
      sourceText: requireString(fact.sourceText, index, 'sourceText', 'Fact'),
      sourceLocation: requireString(fact.sourceLocation, index, 'sourceLocation', 'Fact'),
    }
  })

  return { requirements, facts, usableFacts: facts.filter(isUsableEvidenceFact) }
}

export function validateMappingsPayload(payload, requirements, facts) {
  if (!isRecord(payload) || !Array.isArray(payload.mappings)) {
    throw new ApiError(502, 'AI_OUTPUT_INVALID', '模型返回缺少 mappings 数组。', true)
  }
  if (payload.mappings.length === 0) throw new ApiError(502, 'EMPTY_MAPPING_RESULT', '模型未返回 Evidence Mapping。', true)

  const requirementById = new Map(requirements.map((item) => [item.requirementId, item]))
  const factById = new Map(facts.map((item) => [item.factId, item]))
  const seenRequirements = new Set()

  const byRequirement = payload.mappings.map((value, index) => {
    if (!isRecord(value)) throw new ApiError(502, 'AI_OUTPUT_INVALID', `第 ${index + 1} 条 Mapping 不是有效对象。`, true)
    const missing = REQUIRED_MAPPING_FIELDS.filter((field) => !(field in value))
    if (missing.length) throw new ApiError(502, 'AI_OUTPUT_INVALID', `第 ${index + 1} 条 Mapping 缺少字段：${missing.join('、')}。`, true)
    const extra = Object.keys(value).filter((field) => !REQUIRED_MAPPING_FIELDS.includes(field))
    if (extra.length) throw new ApiError(502, 'AI_OUTPUT_INVALID', `第 ${index + 1} 条 Mapping 包含未允许字段：${extra.join('、')}。`, true)

    const requirementId = requireString(value.requirementId, index, 'requirementId', 'Mapping')
    const requirement = requirementById.get(requirementId)
    if (!requirement) throw new ApiError(502, 'UNKNOWN_REQUIREMENT_ID', `第 ${index + 1} 条 Mapping 引用了不存在的 requirementId：${requirementId}。`, true)
    if (seenRequirements.has(requirementId)) throw new ApiError(502, 'DUPLICATE_MAPPING', `Requirement ${requirementId} 存在重复 Mapping。`, true)
    seenRequirements.add(requirementId)

    if (!Array.isArray(value.factIds) || value.factIds.some((factId) => typeof factId !== 'string' || !factId.trim())) {
      throw new ApiError(502, 'AI_OUTPUT_INVALID', `第 ${index + 1} 条 Mapping 的 factIds 必须是字符串数组。`, true)
    }
    const factIds = Array.from(new Set(value.factIds.map((factId) => factId.trim())))
    if (factIds.length !== value.factIds.length) throw new ApiError(502, 'DUPLICATE_FACT_REFERENCE', `第 ${index + 1} 条 Mapping 重复引用了同一 Fact。`, true)
    const referencedFacts = factIds.map((factId) => {
      const fact = factById.get(factId)
      if (!fact) throw new ApiError(502, 'UNKNOWN_FACT_ID', `第 ${index + 1} 条 Mapping 引用了不存在的 factId：${factId}。`, true)
      if (!isUsableEvidenceFact(fact)) throw new ApiError(502, 'UNAVAILABLE_FACT', `第 ${index + 1} 条 Mapping 引用了不可用 Fact：${factId}。`, true)
      return fact
    })

    const modelRelevance = normalizeRelevance(value.relevance, index)
    const modelStrength = normalizeEvidenceStrength(value.evidenceStrength, index)
    const modelLevel = normalizeEvidenceLevel(value.evidenceLevel, index)
    const reason = requireString(value.reason, index, 'reason', 'Mapping')
    if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
      throw new ApiError(502, 'AI_OUTPUT_INVALID', `第 ${index + 1} 条 Mapping 的 confidence 必须是 0 到 1 之间的数字。`, true)
    }

    if (factIds.length === 0) {
      if (modelRelevance !== '无相关' || modelStrength !== '无有效证据' || modelLevel !== 'L1 了解') {
        throw new ApiError(502, 'INVALID_EMPTY_MAPPING', `第 ${index + 1} 条无证据 Mapping 的相关度、证据强度或等级不一致。`, true)
      }
    } else {
      if (modelRelevance === '无相关' || modelStrength === '无有效证据') {
        throw new ApiError(502, 'INVALID_EVIDENCE_MAPPING', `第 ${index + 1} 条 Mapping 同时引用 Fact 和无有效证据枚举。`, true)
      }
      enforceSemanticEvidence(requirement, referencedFacts, index)
      enforceCrossExperienceReason(referencedFacts, reason, index)
      enforceReasonResponsibilityBoundary(referencedFacts, reason, index)
    }

    const semanticPolicy = evaluateSemanticCoverage(requirement, referencedFacts)
    if (semanticPolicy.noEvidence) {
      return {
        mappingId: '',
        requirementId,
        factIds: [],
        relevance: '无相关',
        evidenceStrength: '无有效证据',
        evidenceLevel: 'L1 了解',
        matchStatus: '待确认',
        reason: `当前可用事实中未找到${semanticPolicy.missingEvidence.join('、')}的直接或合理间接证据。`,
        confidence: Math.min(value.confidence, semanticPolicy.maximumConfidence),
      }
    }
    const maximumLevel = Math.min(inferMaximumEvidenceLevel(referencedFacts), semanticPolicy.maximumLevel)
    const evidenceLevel = EVIDENCE_LEVELS[Math.min(LEVEL_INDEX.get(modelLevel), maximumLevel) - 1]
    const calibratedReason = appendCoverageBoundary(reason, semanticPolicy.missingEvidence)
    enforceReasonLevelConsistency(calibratedReason, evidenceLevel, index)
    let evidenceStrength = lowerEvidenceStrength(modelStrength, semanticPolicy.maximumStrength)
    if (LEVEL_INDEX.get(evidenceLevel) < LEVEL_INDEX.get(requirement.requiredLevel) && evidenceStrength === '强证据') evidenceStrength = '中等证据'
    const relevance = lowerRelevance(modelRelevance, semanticPolicy.maximumRelevance)
    const confidence = Math.min(value.confidence, semanticPolicy.maximumConfidence)
    return {
      mappingId: '',
      requirementId,
      factIds,
      relevance,
      evidenceStrength,
      evidenceLevel,
      matchStatus: '待确认',
      reason: calibratedReason,
      confidence,
    }
  })

  const missingRequirementIds = requirements.filter((item) => !seenRequirements.has(item.requirementId)).map((item) => item.requirementId)
  if (missingRequirementIds.length) throw new ApiError(502, 'INCOMPLETE_MAPPING_RESULT', `模型缺少以下 Requirement 的 Mapping：${missingRequirementIds.join('、')}。`, true)

  const modelOrder = new Map(byRequirement.map((item) => [item.requirementId, item]))
  return requirements.map((requirement, index) => ({
    ...modelOrder.get(requirement.requirementId),
    mappingId: `map-${String(index + 1).padStart(3, '0')}`,
  }))
}

export function parseEvidenceMappingJson(content) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try { return JSON.parse(cleaned) } catch { throw new ApiError(502, 'AI_JSON_INVALID', '模型返回的 Mapping JSON 格式错误。', true) }
}

function createHandler(env) {
  return async function handleEvidenceMapping(request, response) {
    if (request.method !== 'POST') return sendJson(response, 405, { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST 请求。' })
    try {
      const config = readConfig(env)
      const input = validateEvidenceMappingInput(await readJsonBody(request))
      let lastError
      for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
        try {
          const content = await callModel(config, {
            requirements: input.requirements,
            facts: input.usableFacts.map(toModelFact),
          }, lastError?.message)
          const mappings = validateMappingsPayload(parseEvidenceMappingJson(content), input.requirements, input.facts)
          return sendJson(response, 200, {
            mappings,
            meta: {
              usableFactCount: input.usableFacts.length,
              lowConfidenceCount: mappings.filter((mapping) => mapping.confidence < 0.75).length,
            },
          })
        } catch (error) {
          lastError = normalizeError(error)
          const willRetry = lastError.retryable && attempt < config.maxRetries
          console.warn(`[evidence-mapping] 第 ${attempt + 1}/${config.maxRetries + 1} 次尝试失败：${lastError.code}: ${lastError.message}${willRetry ? '；即将重试' : '；不再重试'}`)
          if (!willRetry) throw lastError
        }
      }
    } catch (error) {
      const normalized = normalizeError(error)
      if (normalized.status >= 500) console.error(`[evidence-mapping] ${normalized.code}: ${normalized.message}`)
      return sendJson(response, normalized.status, { code: normalized.code, message: normalized.message })
    }
  }
}

async function callModel(config, input, repairHint) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const userContent = [
      '请建立以下岗位要求与可用事实之间的证据映射。',
      repairHint ? `上一次输出未通过校验：${repairHint}。请只修复 Mapping 结构或引用，不要新增事实，不要输出 Match Status 或 Gap。` : '',
      JSON.stringify(input),
    ].filter(Boolean).join('\n')
    const providerResponse = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userContent }],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
    if (!providerResponse.ok) throw new ApiError(502, 'MODEL_CALL_FAILED', `模型服务调用失败（HTTP ${providerResponse.status}）。`, true)
    const providerPayload = await providerResponse.json()
    const content = providerPayload?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new ApiError(502, 'MODEL_CALL_FAILED', '模型服务未返回可解析 Mapping 内容。', true)
    return content
  } catch (error) {
    if (error?.name === 'AbortError') throw new ApiError(504, 'MODEL_TIMEOUT', 'Evidence Mapping 超时，请稍后重试。', true)
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'MODEL_CALL_FAILED', '无法连接模型服务，请检查网络或接口配置。', true)
  } finally {
    clearTimeout(timer)
  }
}

function toModelFact(fact) {
  return {
    factId: fact.factId,
    experienceId: fact.experienceId,
    experienceName: fact.experienceName,
    content: fact.content,
    type: fact.type,
    sourceText: fact.sourceText,
    sourceLocation: fact.sourceLocation,
    riskLevel: fact.riskLevel,
    confidence: fact.confidence,
    status: fact.status,
    ...(fact.projectStatus ? { projectStatus: fact.projectStatus } : {}),
    ...(fact.numericDetail ? { numericDetail: fact.numericDetail } : {}),
  }
}

function enforceSemanticEvidence(requirement, facts, index) {
  const requirementText = `${requirement.normalizedRequirement}\n${requirement.capability}`
  const evidenceText = facts.map((fact) => `${fact.content}\n${fact.sourceText}`).join('\n')
  if (/用户研究|用户调研|用户访谈/.test(requirementText) && !/用户研究|用户调研|用户访谈|深访|问卷|访谈提纲|用户反馈分析/.test(evidenceText)) {
    throw new ApiError(502, 'UNSUPPORTED_MAPPING', `第 ${index + 1} 条 Mapping 只有用户相关关键词，不能证明用户研究能力。`, true)
  }
}

function evaluateSemanticCoverage(requirement, facts) {
  const requirementText = `${requirement.normalizedRequirement}\n${requirement.capability}\n${requirement.sourceText}`
  const evidenceText = facts.map((fact) => `${fact.content}\n${fact.sourceText}`).join('\n')
  const policy = {
    noEvidence: false,
    maximumRelevance: '高相关',
    maximumStrength: '强证据',
    maximumLevel: 4,
    maximumConfidence: 1,
    missingEvidence: [],
  }
  const restrict = ({ relevance = '低相关', strength = '弱证据', level = 3, confidence = 0.7, missing }) => {
    policy.maximumRelevance = lowerRelevance(policy.maximumRelevance, relevance)
    policy.maximumStrength = lowerEvidenceStrength(policy.maximumStrength, strength)
    policy.maximumLevel = Math.min(policy.maximumLevel, level)
    policy.maximumConfidence = Math.min(policy.maximumConfidence, confidence)
    if (missing && !policy.missingEvidence.includes(missing)) policy.missingEvidence.push(missing)
  }

  // 沟通/协作是独立能力，不能由技术工作、产品角色或同项目经历推导。
  if (/高效(?:沟通|对话)|技术团队.{0,8}(?:沟通|对话|协作)|跨团队(?:沟通|协作|推进)/.test(requirementText)
    && !/(?:沟通|对话|协作|协调|跨团队|技术团队|研发团队|工程团队|联合|评审会|对齐)/.test(evidenceText)) {
    policy.noEvidence = true
    policy.maximumConfidence = 0.9
    policy.missingEvidence.push('沟通或协作行为')
  }

  if (/(?:从概念到|概念至).{0,8}(?:上线|发布)|正式上线|上线闭环/.test(requirementText)
    && !/(?:正式上线|已上线|发布|投产|生产环境|用户使用|上线运营|(?:产品|系统|功能|项目)(?:已)?上线|(?:推进|推动|完成|实现|直至|到|至).{0,16}上线|上线.{0,8}(?:全流程|闭环))/.test(evidenceText)) {
    restrict({ missing: '上线或发布里程碑' })
  }

  const interactionTerms = ['对话式', '生成式 UI', '生成式UI', '主动式智能推荐', 'Agent 多步推理', 'Agent多步推理']
  const requiredInteractions = interactionTerms.filter((term) => requirementText.includes(term))
  if (requiredInteractions.length && !requiredInteractions.some((term) => evidenceText.includes(term))) {
    restrict({ level: 2, confidence: 0.65, missing: '指定的新型 AI 交互范式' })
  }

  if (/(?:A\/?B\s*测试|用户行为分析|使用漏斗|漏斗分析)/i.test(requirementText)
    && !/(?:A\/?B\s*测试|用户行为分析|使用漏斗|漏斗分析)/i.test(evidenceText)) {
    restrict({ confidence: 0.65, missing: 'A/B 测试、行为分析或漏斗分析方法' })
  }

  if (/(?:AI\s*前沿|前沿进展|行业动态).{0,16}(?:产品机会|转化|落地)/i.test(requirementText)
    && !/(?:前沿|行业动态|趋势|新技术|新模型).{0,20}(?:产品机会|转化|落地|产品方案)/i.test(evidenceText)) {
    restrict({ level: 2, confidence: 0.65, missing: '持续追踪前沿并转化为产品机会的行为' })
  }

  if (/人机协同/.test(requirementText) && !/(?:人机协同|人与AI协作|AI辅助工作|借助AI工具|使用AI工具)/i.test(evidenceText)) {
    restrict({ level: 2, confidence: 0.65, missing: '个人人机协同工作方式或习惯' })
  }

  if (/商业敏感度|商业洞察|商业判断/.test(requirementText)
    && !/(?:商业模式|商业化|收入|营收|付费|转化率|市场规模|定价|成本|利润|ROI|客户价值)/i.test(evidenceText)) {
    restrict({ level: 2, confidence: 0.65, missing: '商业判断、市场或商业结果' })
  }

  if (/独立(?:完成|负责|设计|主导)/.test(requirementText) && !/独立(?:完成|负责|设计|主导)/.test(evidenceText)) {
    restrict({ relevance: '中相关', strength: '中等证据', level: 3, confidence: 0.75, missing: '独立完成该全过程' })
  }

  if (/主导/.test(requirementText) && !/(?:主导|牵头|核心负责人)/.test(evidenceText)) {
    restrict({ relevance: '中相关', strength: '中等证据', level: 3, confidence: 0.75, missing: '主导该具体能力的行为' })
  }

  if (/建立.{0,12}(?:指标|体系|机制)/.test(requirementText)
    && !/建立.{0,12}(?:指标|体系|机制)/.test(evidenceText)) {
    restrict({ relevance: '中相关', strength: '中等证据', level: 3, confidence: 0.75, missing: '建立相应指标、体系或机制' })
  }

  return policy
}

function appendCoverageBoundary(reason, missingEvidence) {
  if (!missingEvidence.length) return reason
  const missing = missingEvidence.join('、')
  if (missingEvidence.every((item) => reason.includes(item))) return reason
  return `${reason.replace(/[。；;\s]+$/, '')}；规则层校准：仅保留现有 Fact 直接支持的部分，缺少${missing}证据。`
}

function lowerRelevance(current, maximum) {
  const order = ['无相关', '低相关', '中相关', '高相关']
  return order[Math.min(order.indexOf(current), order.indexOf(maximum))]
}

function lowerEvidenceStrength(current, maximum) {
  const order = ['无有效证据', '弱证据', '中等证据', '强证据']
  return order[Math.min(order.indexOf(current), order.indexOf(maximum))]
}

function enforceCrossExperienceReason(facts, reason, index) {
  if (new Set(facts.map((fact) => fact.experienceId)).size > 1 && /同一项目|该项目(?:中|内)|在该项目/.test(reason)) {
    throw new ApiError(502, 'CROSS_EXPERIENCE_FABRICATION', `第 ${index + 1} 条 Mapping 将跨项目事实伪造成同一项目经历。`, true)
  }
}

function enforceReasonResponsibilityBoundary(facts, reason, index) {
  const evidenceText = facts.map((fact) => `${fact.content}\n${fact.sourceText}`).join('\n')
  const withoutNegatedClaims = reason.replace(/(?:不能|无法|不足以|未体现|未证明|不能证明|无法证明).{0,48}(?:独立|主导|负责人|设计级|主导层级)/g, '')
  const claimsElevatedResponsibility = /(?:证明|表明|体现|可见|属于|达到|支撑).{0,36}(?:独立(?:完成|负责|设计)|主导|负责人|设计级|主导层级)/.test(withoutNegatedClaims)
    || /(?:可|能够|足以)证明.{0,36}(?:独立|主导|负责人|设计级)/.test(withoutNegatedClaims)
  if (claimsElevatedResponsibility && !/独立(?:完成|负责|设计)|主导|负责人/.test(evidenceText)) {
    throw new ApiError(502, 'EVIDENCE_REASON_OVERCLAIM', `第 ${index + 1} 条 Mapping 的 reason 扩大了 Fact 中的职责等级。`, true)
  }
}

function inferMaximumEvidenceLevel(facts) {
  if (!facts.length) return 1
  return Math.max(...facts.map((fact) => {
    const text = `${fact.content}\n${fact.sourceText}`
    if (/主导|独立负责|核心负责人|负责人|负责.{0,18}(?:全流程|完整闭环|整个产品)|独立(?:设计|完成)|定义.{0,12}(?:方向|方案|机制)|建立.{0,12}(?:机制|体系|指标)|设计.{0,16}(?:方案|产品|流程|机制|策略)/.test(text)) return 4
    if (/负责|参与|完成|使用|执行|实践|搭建|开发|测试|迭代|分析|调研|访谈|推动|落地|对比|拆解/.test(text)) return 3
    if (/熟悉|理解|判断|解释|掌握/.test(text)) return 2
    return 1
  }))
}

function enforceReasonLevelConsistency(reason, evidenceLevel, index) {
  const level = LEVEL_INDEX.get(evidenceLevel)
  const claimsL4 = /(?:可|能够|足以)(?:共同)?(?:支撑|证明|达到).{0,24}(?:L4|设计\s*[\/／]?\s*主导|设计或主导|主导层级)/.test(reason)
  const claimsL3 = /(?:可|能够|足以)(?:共同)?(?:支撑|证明|达到).{0,20}(?:L3|实践层级|实际实践能力)/.test(reason)
  if ((level < 4 && claimsL4) || (level < 3 && claimsL3)) {
    throw new ApiError(502, 'EVIDENCE_REASON_OVERCLAIM', `第 ${index + 1} 条 Mapping 的 reason 声称了高于 evidenceLevel 的能力等级。`, true)
  }
}

function normalizeRelevance(value, index) {
  const aliases = { '高': '高相关', '中': '中相关', '低': '低相关', '无': '无相关', '不相关': '无相关' }
  const normalized = aliases[value] || value
  return requireEnum(normalized, RELEVANCE_VALUES, index, 'relevance', 'Mapping')
}

function normalizeEvidenceStrength(value, index) {
  const aliases = {
    '强支持': '强证据',
    '中等支持': '中等证据',
    '部分支持': '中等证据',
    '弱支持': '弱证据',
    '无有效支持': '无有效证据',
  }
  const normalized = aliases[value] || value
  return requireEnum(normalized, EVIDENCE_STRENGTH_VALUES, index, 'evidenceStrength', 'Mapping')
}

function normalizeEvidenceLevel(value, index) {
  if (EVIDENCE_LEVELS.includes(value)) return value
  const raw = typeof value === 'string' ? value.trim() : ''
  const codeMatch = raw.match(/^L\s*([1-4])(?:\s*[:：\-—]?\s*)(.*)$/i)
  const numericLevel = codeMatch ? Number(codeMatch[1]) : null
  const label = (codeMatch ? codeMatch[2] : raw).replace(/[\s/／、，,·・（）()级能力]/g, '')
  let semanticLevel = null
  if (/设计|主导|牵头|独立负责/.test(label)) semanticLevel = 4
  else if (/实践|应用|执行|实操|落地/.test(label)) semanticLevel = 3
  else if (/熟悉|理解|判断|掌握/.test(label)) semanticLevel = 2
  else if (/了解|认知|基础/.test(label)) semanticLevel = 1
  const level = numericLevel && semanticLevel ? Math.min(numericLevel, semanticLevel) : numericLevel || semanticLevel
  if (!level) throw new ApiError(502, 'AI_OUTPUT_INVALID', `第 ${index + 1} 条 Mapping 的 evidenceLevel 不在允许范围内。`, true)
  return EVIDENCE_LEVELS[level - 1]
}

function readConfig(env) {
  const apiUrl = env.AI_API_URL?.trim()
  const apiKey = env.AI_API_KEY?.trim()
  const model = env.AI_MODEL?.trim()
  if (!apiUrl || !apiKey || !model) throw new ApiError(500, 'AI_NOT_CONFIGURED', '真实 AI 尚未配置，请设置 AI_API_URL、AI_API_KEY 和 AI_MODEL。')
  try { new URL(apiUrl) } catch { throw new ApiError(500, 'AI_NOT_CONFIGURED', 'AI_API_URL 不是有效地址。') }
  return {
    apiUrl,
    apiKey,
    model,
    timeoutMs: readPositiveInteger(env.AI_TIMEOUT_MS, 45000),
    maxRetries: readNonNegativeInteger(env.AI_MAX_RETRIES, 1),
  }
}

function requireString(value, index, field, entity) {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(502, 'AI_OUTPUT_INVALID', `第 ${index + 1} 条 ${entity} 的 ${field} 不能为空。`, true)
  return value.trim()
}

function requireEnum(value, allowed, index, field, entity) {
  if (!allowed.includes(value)) throw new ApiError(502, 'AI_OUTPUT_INVALID', `第 ${index + 1} 条 ${entity} 的 ${field} 不在允许范围内。`, true)
  return value
}

function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function normalizeError(error) { return error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'Evidence Mapping 服务发生未知错误。') }
function readPositiveInteger(value, fallback) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback }
function readNonNegativeInteger(value, fallback) { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback }
async function readJsonBody(request) { const chunks = []; for await (const chunk of request) chunks.push(chunk); try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { throw new ApiError(400, 'INPUT_INVALID', '请求内容不是有效 JSON。') } }
function sendJson(response, status, payload) { response.statusCode = status; response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.end(JSON.stringify(payload)) }

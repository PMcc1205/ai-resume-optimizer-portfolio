const ISSUE_TYPES = ['表达泛化', '关键行动不清', '职责不清', '真实证据未体现', '事实待补充', '能力程度不足', '能力缺失']
const LEVELS = ['L1 了解', 'L2 熟悉', 'L3 实践', 'L4 设计 / 主导']
const FIELDS = ['requirementId', 'mappingId', 'gapId', 'resumeItemId', 'factIds', 'issueType', 'description', 'suggestion']

const PROMPT = `你是简历问题诊断模块，只分析输入给出的诊断候选，不重新判断 Requirement、Fact、Evidence Mapping、Match Status 或 Gap。
只返回一个完整、合法的 JSON 对象，根结构必须是 {"diagnoses":[...] }。禁止返回 Markdown、\`\`\`json 代码块、解释文字、注释或多个 JSON 对象。
每个候选恰好返回一项，包含且仅包含 requirementId、mappingId、gapId、resumeItemId、factIds、issueType、description、suggestion。所有字段必须存在；resumeItemId 无内容时使用空字符串，factIds 无内容时使用空数组，不得省略字段。
ID 和 factIds 必须原样引用该候选，不得发明或跨项目拼接。issueType 只能是：${ISSUE_TYPES.join('、')}。
表达缺口：说明原文何处不足、已有真实事实和岗位关系，只建议强化事实表达。
事实缺口：说明缺少什么事实、为何无法确认以及用户应补充什么；绝不提供改写方案。已暂时跳过仍须提示分析可能不完整。
能力程度不足：准确说明当前真实证据等级及岗位所需等级，只能建议有限优化已有行为，不得把参与、实践包装成独立设计或主导。
能力缺失：说明用户已明确否认相关经历，不能通过文案解决，也不能生成新经历。
文本必须与 originalText 和 facts 一致：只要 originalText 或 facts 已证明某项行为存在，就必须使用“已有……，但表达/范围/深度不足”“缺少……”“尚未说明……”等措辞；禁止写成“没有相关经历”“没有任何证据”“未做过”“完全缺失”。
表达缺口必须先承认已有原文或事实，再说明具体缺少的对象、过程、个人作用、口径或结果。能力程度不足必须先说明已有实践能证明什么，再说明与岗位等级或完整语义的差距。事实缺口只能说“当前缺少足够事实，无法确认”，不得断言用户没有；只有能力缺失候选允许明确描述没有相关经历。
没有原始简历条目时 originalText 为空，不要虚构原文；不要创造数字、结果、项目状态或职责。不要输出改写后的简历句子、Markdown 或 JSON 以外内容。`

class ApiError extends Error {
  constructor(status, code, message, retryable = false) {
    super(message)
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const required = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(422, 'INPUT_INVALID', `${name} 不能为空。`)
  return value.trim()
}

export function createDiagnosisPlugin(env) {
  const handler = createHandler(env)
  return {
    name: 'diagnosis-api',
    configureServer(server) { server.middlewares.use('/api/diagnosis', handler) },
    configurePreviewServer(server) { server.middlewares.use('/api/diagnosis', handler) },
  }
}

export function validateDiagnosisInput(value) {
  if (!record(value) || !['requirements', 'facts', 'mappings', 'gaps', 'skippedIds'].every((key) => Array.isArray(value[key])) || typeof value.resumeText !== 'string') {
    throw new ApiError(400, 'INPUT_INVALID', '诊断输入必须包含 requirements、facts、mappings、gaps、skippedIds 和 resumeText。')
  }
  const { requirements, facts, mappings, gaps, skippedIds, resumeText } = value
  const unique = (items, field) => {
    const ids = items.map((item) => record(item) ? required(item[field], field) : '')
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new ApiError(422, 'INPUT_INVALID', `${field} 不可重复或缺失。`)
    return new Map(items.map((item) => [item[field], item]))
  }
  const requirementById = unique(requirements, 'requirementId')
  const factById = unique(facts, 'factId')
  const mappingByRequirement = unique(mappings, 'requirementId')
  const gapByRequirement = unique(gaps, 'requirementId')
  if (mappings.length !== requirements.length || gaps.length !== requirements.length) throw new ApiError(422, 'INPUT_INVALID', 'Mapping 与 Gap 必须完整覆盖当前 Requirement。')
  for (const id of requirementById.keys()) {
    const requirement = requirementById.get(id)
    const mapping = mappingByRequirement.get(id)
    const gap = gapByRequirement.get(id)
    if (!mapping || !gap || !LEVELS.includes(requirement.requiredLevel) || !LEVELS.includes(mapping.evidenceLevel)) throw new ApiError(422, 'INPUT_INVALID', `Requirement ${id} 缺少完整有效的上游判断。`)
    required(mapping.mappingId, 'mappingId')
    required(gap.gapId, 'gapId')
    if (!Array.isArray(mapping.factIds) || mapping.factIds.some((factId) => !factById.has(factId))) throw new ApiError(422, 'INVALID_FACT_ID', `Requirement ${id} 引用了不存在的 Fact。`)
    if (mapping.factIds.some((factId) => {
      const fact = factById.get(factId)
      return fact.status !== '已确认' || fact.requiresConfirmation !== false || fact.conflictNote
    })) throw new ApiError(422, 'UNAVAILABLE_FACT', `Requirement ${id} 引用了不可用 Fact。`)
    const combination = `${mapping.matchStatus}|${gap.gapType}|${gap.capabilityGapSubtype ?? ''}`
    const valid = ['满足|无缺口|', '满足|表达缺口|', '部分满足|能力缺口|能力程度不足', '未满足|能力缺口|能力缺失', '待确认|事实缺口|']
    if (!valid.includes(combination)) throw new ApiError(422, 'INVALID_GAP_STATE', `Requirement ${id} 的 Match Status 与 Gap 不一致。`)
    if (combination === '未满足|能力缺口|能力缺失' && !facts.some((fact) => fact.status === '明确不存在' && String(fact.sourceLocation).includes(id))) {
      throw new ApiError(422, 'INVALID_GAP_STATE', `Requirement ${id} 没有用户明确否认的事实。`)
    }
  }
  if ([...mappingByRequirement.keys(), ...gapByRequirement.keys()].some((id) => !requirementById.has(id))) throw new ApiError(422, 'INVALID_REQUIREMENT_ID', 'Mapping 或 Gap 引用了不存在的 Requirement。')
  if (skippedIds.some((id) => typeof id !== 'string')) throw new ApiError(422, 'INPUT_INVALID', 'skippedIds 格式错误。')

  const candidates = requirements.filter((item) => gapByRequirement.get(item.requirementId).gapType !== '无缺口').map((requirement) => {
    const mapping = mappingByRequirement.get(requirement.requirementId)
    const gap = gapByRequirement.get(requirement.requirementId)
    const linkedFacts = mapping.factIds.map((id) => factById.get(id))
    const sourceFact = linkedFacts.find((fact) => resumeText.includes(fact.sourceText)) ?? linkedFacts[0]
    const isResumeSource = sourceFact && resumeText.includes(sourceFact.sourceText)
    const originalText = isResumeSource
      ? resumeText.split(/\r?\n/).find((line) => line.includes(sourceFact.sourceText))?.trim() ?? sourceFact.sourceText
      : sourceFact?.sourceLocation?.includes('用户补充') ? sourceFact.sourceText : ''
    return {
      requirementId: requirement.requirementId,
      mappingId: mapping.mappingId,
      gapId: gap.gapId,
      resumeItemId: originalText ? `item-${sourceFact.factId}` : '',
      originalText,
      experienceId: sourceFact?.experienceId ?? '',
      experienceName: sourceFact?.experienceName ?? '',
      factIds: mapping.factIds,
      issueTypes: gap.gapType === '表达缺口' ? ISSUE_TYPES.slice(0, 4) : gap.gapType === '事实缺口' ? ['事实待补充'] : gap.capabilityGapSubtype === '能力缺失' ? ['能力缺失'] : ['能力程度不足'],
      skipped: gap.gapType === '事实缺口' && skippedIds.includes(requirement.requirementId),
      requirement: { normalizedRequirement: requirement.normalizedRequirement, importance: requirement.importance, requiredLevel: requirement.requiredLevel },
      mapping: { matchStatus: mapping.matchStatus, evidenceStrength: mapping.evidenceStrength, evidenceLevel: mapping.evidenceLevel, reason: mapping.reason },
      gap: { gapType: gap.gapType, capabilityGapSubtype: gap.capabilityGapSubtype, reason: gap.reason, rewritePermission: gap.rewritePermission },
      facts: linkedFacts.map((fact) => ({ factId: fact.factId, content: fact.content, sourceText: fact.sourceText, sourceLocation: fact.sourceLocation, experienceName: fact.experienceName })),
    }
  })
  return { candidates }
}

export function parseDiagnosisJson(text) {
  const raw = typeof text === 'string' ? text.trim() : ''
  if (!raw) throw new ApiError(502, 'MODEL_EMPTY_OUTPUT', '模型未返回 Diagnosis 内容。', true)
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const extracted = extractSingleJsonObject(unfenced)
  try { return JSON.parse(extracted) }
  catch {
    const code = looksTruncated(extracted) ? 'OUTPUT_TRUNCATED' : 'INVALID_JSON'
    const message = code === 'OUTPUT_TRUNCATED' ? '模型返回的 Diagnosis JSON 不完整，可能已被截断。' : '模型返回的 Diagnosis JSON 格式错误。'
    throw new ApiError(502, code, message, true)
  }
}

function extractSingleJsonObject(text) {
  const start = text.indexOf('{')
  if (start < 0) throw new ApiError(502, 'INVALID_JSON', '模型响应中没有完整 JSON 对象。', true)
  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
      continue
    }
    if (char === '"') quoted = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        const trailing = text.slice(index + 1).trim()
        if (/[\[{]/.test(trailing)) throw new ApiError(502, 'INVALID_JSON', '模型返回了多个 JSON 对象。', true)
        return text.slice(start, index + 1)
      }
    }
  }
  throw new ApiError(502, 'OUTPUT_TRUNCATED', '模型返回的 Diagnosis JSON 不完整，可能已被截断。', true)
}

function looksTruncated(text) {
  let braces = 0
  let brackets = 0
  let quoted = false
  let escaped = false
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '{') braces += 1
    else if (char === '}') braces -= 1
    else if (char === '[') brackets += 1
    else if (char === ']') brackets -= 1
  }
  return quoted || braces > 0 || brackets > 0
}

export function validateDiagnosisPayload(payload, input) {
  if (!record(payload) || !Array.isArray(payload.diagnoses)) throw new ApiError(502, 'SCHEMA_INVALID', '模型返回缺少 diagnoses 数组。', true)
  if (payload.diagnoses.length === 0 && input.candidates.length !== 0) throw new ApiError(502, 'EMPTY_DIAGNOSIS_RESULT', '模型未返回应生成的问题诊断。', true)
  if (payload.diagnoses.length !== input.candidates.length) throw new ApiError(502, 'INCOMPLETE_DIAGNOSIS', '模型返回的 Diagnosis 数量与当前非空 Gap 不一致。', true)
  const candidateById = new Map(input.candidates.map((candidate) => [candidate.requirementId, candidate]))
  const seen = new Set()
  const byId = payload.diagnoses.map((item) => {
    if (!record(item) || Object.keys(item).some((key) => !FIELDS.includes(key)) || FIELDS.some((field) => !(field in item))) throw new ApiError(502, 'SCHEMA_INVALID', 'Diagnosis 字段缺失或包含额外字段。', true)
    const id = modelRequired(item.requirementId, 'requirementId')
    const candidate = candidateById.get(id)
    if (!candidate || seen.has(id)) throw new ApiError(502, 'INVALID_REQUIREMENT_ID', `Diagnosis 引用了不存在或重复的 Requirement：${id}。`, true)
    seen.add(id)
    if (item.mappingId !== candidate.mappingId || item.gapId !== candidate.gapId || item.resumeItemId !== candidate.resumeItemId) throw new ApiError(502, 'INVALID_REFERENCE', `Diagnosis ${id} 的 Mapping、Gap 或简历条目引用无效。`, true)
    if (!Array.isArray(item.factIds) || item.factIds.length !== candidate.factIds.length || item.factIds.some((factId, index) => factId !== candidate.factIds[index])) throw new ApiError(502, 'INVALID_FACT_ID', `Diagnosis ${id} 引用了错误的 Fact。`, true)
    if (!candidate.issueTypes.includes(item.issueType)) throw new ApiError(502, 'INVALID_ISSUE_TYPE', `Diagnosis ${id} 的问题类型不符合当前 Gap。`, true)
    const description = modelRequired(item.description, 'description')
    const suggestion = modelRequired(item.suggestion, 'suggestion')
    validateTextConsistency(candidate, description, suggestion, id)
    if (candidate.gap.gapType === '事实缺口' && hasUnsafeRewriteAdvice(suggestion)) throw new ApiError(502, 'UNSAFE_SUGGESTION', `Diagnosis ${id} 的事实缺口建议越过事实确认。`, true)
    if (candidate.gap.capabilityGapSubtype === '能力缺失' && hasUnsafeRewriteAdvice(suggestion, true)) throw new ApiError(502, 'UNSAFE_SUGGESTION', `Diagnosis ${id} 的能力缺失不得进入改写。`, true)
    const optimizable = candidate.gap.gapType === '表达缺口' || candidate.gap.capabilityGapSubtype === '能力程度不足'
    const priority = optimizable && candidate.requirement.importance === '核心要求' ? '高' : candidate.requirement.importance === '核心要求' ? '中' : '低'
    return {
      diagnosisId: '', resumeItemId: candidate.resumeItemId, experienceId: candidate.experienceId, experienceName: candidate.experienceName,
      originalText: candidate.originalText, issueType: item.issueType,
      description: candidate.skipped ? `${description} 该项尚未确认，本次分析可能不完整。` : description,
      requirementIds: [id], primaryRequirementId: id, mappingId: candidate.mappingId, gapId: candidate.gapId,
      factIds: candidate.factIds, gapType: candidate.gap.gapType, priority, suggestion, optimizable, skipped: candidate.skipped,
    }
  })
  const diagnoses = new Map(byId.map((item) => [item.primaryRequirementId, item]))
  return input.candidates.map((candidate, index) => ({ ...diagnoses.get(candidate.requirementId), diagnosisId: `diag-${String(index + 1).padStart(3, '0')}` }))
}

function validateTextConsistency(candidate, description, suggestion, id) {
  const hasPositiveEvidence = candidate.factIds.length > 0 && candidate.facts.length > 0
  const isCapabilityMissing = candidate.gap.capabilityGapSubtype === '能力缺失'
  const absoluteDenial = /(?:没有|不存在|未有|无).{0,8}(?:任何|相关).{0,18}(?:事实|证据|经历|实践)|(?:无法|不能).{0,12}(?:看出|找到|发现).{0,8}任何.{0,18}(?:事实|证据|经历|实践)|(?:未做过|从未做过|完全缺失|完全不存在)/

  if (hasPositiveEvidence && !isCapabilityMissing && absoluteDenial.test(description)) {
    throw new ApiError(502, 'DIAGNOSIS_TEXT_CONFLICT', `Diagnosis ${id} 否定了 originalText 或 Fact 已确认存在的事实；请先承认已有事实，再描述表达或程度不足。`, true)
  }

  if (candidate.gap.gapType === '表达缺口' && hasPositiveEvidence) {
    const acknowledgesEvidence = /(?:原文|已有|已确认|当前.{0,8}(?:事实|证据)|简历已|已经)/.test(description)
    const describesInsufficiency = /(?:但|不过|缺少|尚未|未充分|不充分|不足|不清|较泛|仅)/.test(description)
    if (!acknowledgesEvidence || !describesInsufficiency) {
      throw new ApiError(502, 'DIAGNOSIS_TEXT_CONFLICT', `Diagnosis ${id} 的表达缺口必须说明已有事实及当前表达不足。`, true)
    }
  }

  if (candidate.gap.capabilityGapSubtype === '能力程度不足' && hasPositiveEvidence) {
    const acknowledgesPractice = /(?:已有|当前.{0,8}(?:事实|证据|实践)|已确认|能够证明|能证明|可证明|体现)/.test(description)
    const statesBoundary = /(?:但|只能|仅能|不足|低于|差距|缺少|尚未|不能证明|无法证明)/.test(description)
    if (!acknowledgesPractice || !statesBoundary) {
      throw new ApiError(502, 'DIAGNOSIS_TEXT_CONFLICT', `Diagnosis ${id} 的能力程度不足必须区分已有实践与尚未达到的要求。`, true)
    }
  }

  if (candidate.gap.gapType === '事实缺口' && /(?:用户|候选人|求职者).{0,8}(?:没有|不存在|未做过|从未).{0,16}(?:经历|事实|实践|能力)/.test(description)) {
    throw new ApiError(502, 'DIAGNOSIS_TEXT_CONFLICT', `Diagnosis ${id} 的事实缺口不得断言用户没有相关经历。`, true)
  }

  if (!isCapabilityMissing && hasFabricationAdvice(suggestion)) {
    throw new ApiError(502, 'UNSAFE_SUGGESTION', `Diagnosis ${id} 的建议不得新增或编造未确认事实。`, true)
  }
}

function hasFabricationAdvice(text) {
  return String(text).split(/[。！？；\n]/).some((sentence) => {
    if (/(?:不要|不得|不能|不应|禁止|避免).{0,12}(?:编造|虚构|杜撰|生成不存在|新增未确认)/.test(sentence)) return false
    return /(?:建议|可以|应当|通过).{0,12}(?:编造|虚构|杜撰|生成不存在|新增未确认)/.test(sentence)
  })
}

function hasUnsafeRewriteAdvice(text, includeFabrication = false) {
  const sentences = String(text).split(/[。！？；\n]/).map((part) => part.trim()).filter(Boolean)
  return sentences.some((sentence) => {
    const action = includeFabrication ? /(?:改写|润色|包装|生成经历|优化简历)/ : /(?:改写|润色|优化简历)/
    if (!action.test(sentence)) return false
    if (/(?:不要|不得|不能|不应|禁止|无法|不可|避免).{0,12}(?:直接|立即|通过|进行|进入)?(?:改写|润色|包装|生成经历|优化简历)/.test(sentence)) return false
    return /(?:直接|立即|可以|建议|应当|通过).{0,16}(?:改写|润色|包装|生成经历|优化简历)/.test(sentence)
      || /(?:改写|润色|包装|生成经历|优化简历).{0,16}(?:即可|解决|补足|匹配)/.test(sentence)
      || /(?:改写|包装|生成经历).{0,8}(?:为|成)/.test(sentence)
  })
}

function modelRequired(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(502, 'SCHEMA_INVALID', `模型返回的 ${name} 不能为空。`, true)
  return value.trim()
}

function createHandler(env) {
  return async (request, response) => {
    if (request.method !== 'POST') return send(response, 405, { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST。' })
    try {
      const input = validateDiagnosisInput(await readJsonBody(request))
      if (input.candidates.length === 0) return send(response, 200, { diagnoses: [] })
      const config = readConfig(env)
      if (config.development) console.info(`[diagnosis] candidates=${input.candidates.length} inputChars=${JSON.stringify(input.candidates).length} outputTokenLimit=${outputTokenLimit(config, input.candidates.length)}`)
      const diagnoses = await generateDiagnoses(config, input)
      return send(response, 200, { diagnoses })
    } catch (error) {
      const normalized = error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'Diagnosis 服务发生错误。')
      return send(response, normalized.status, { code: normalized.code, message: normalized.message })
    }
  }
}

export async function generateDiagnoses(config, input, invoke = callModel) {
  let lastError
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      const result = await invoke(config, input, lastError?.message)
      if (envIsDevelopment(config)) console.info(`[diagnosis] responseChars=${result.content.length} finishReason=${result.finishReason ?? 'unknown'}`)
      if (result.finishReason === 'length') throw new ApiError(502, 'OUTPUT_TRUNCATED', '模型返回的 Diagnosis JSON 因输出长度限制而截断。', true)
      return validateDiagnosisPayload(parseDiagnosisJson(result.content), input)
    } catch (error) {
      lastError = error instanceof ApiError ? error : new ApiError(502, 'MODEL_CALL_FAILED', '模型服务调用失败。', true)
      if (envIsDevelopment(config)) console.warn(`[diagnosis] attempt=${attempt + 1} code=${lastError.code} retry=${lastError.retryable && attempt < config.maxRetries}`)
      if (!lastError.retryable || attempt === config.maxRetries) throw lastError
    }
  }
}

function envIsDevelopment(config) { return config.development !== false }

async function callModel(config, input, hint) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: `${hint ? `上一响应未通过结构化校验：${hint}。请重新返回符合 Schema 的完整 JSON；不要返回 Markdown、解释或注释。\n` : ''}${JSON.stringify(input.candidates)}` },
      ], response_format: { type: 'json_object' }, max_tokens: outputTokenLimit(config, input.candidates.length) }), signal: controller.signal,
    })
    if (!response.ok) throw new ApiError(502, 'MODEL_CALL_FAILED', `模型服务调用失败（HTTP ${response.status}）。`, response.status !== 402)
    const payload = await response.json()
    const choice = payload?.choices?.[0]
    const content = choice?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      const finishReason = choice?.finish_reason ?? null
      if (config.development) console.warn(`[diagnosis] emptyContent finishReason=${finishReason ?? 'unknown'}`)
      if (finishReason === 'length') throw new ApiError(502, 'OUTPUT_TRUNCATED', '模型未在输出长度限制内生成完整 Diagnosis JSON。', true)
      throw new ApiError(502, 'MODEL_EMPTY_OUTPUT', '模型未返回 Diagnosis 内容。', true)
    }
    return { content, finishReason: choice?.finish_reason ?? null }
  } catch (error) {
    if (error?.name === 'AbortError') throw new ApiError(504, 'MODEL_TIMEOUT', 'Diagnosis 调用超时。', true)
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'MODEL_CALL_FAILED', '无法连接模型服务。', true)
  } finally { clearTimeout(timer) }
}

function readConfig(env) {
  const apiUrl = env.AI_API_URL?.trim()
  const apiKey = env.AI_API_KEY?.trim()
  const model = env.AI_MODEL?.trim()
  if (!apiUrl || !apiKey || !model) throw new ApiError(500, 'AI_NOT_CONFIGURED', '真实 AI 尚未配置。')
  try { new URL(apiUrl) } catch { throw new ApiError(500, 'AI_NOT_CONFIGURED', 'AI_API_URL 不是有效地址。') }
  const timeout = Number(env.AI_TIMEOUT_MS)
  const retries = Number(env.AI_MAX_RETRIES)
  const outputTokens = Number(env.AI_DIAGNOSIS_MAX_TOKENS)
  return { apiUrl, apiKey, model, timeoutMs: Number.isInteger(timeout) && timeout > 0 ? timeout : 45000, maxRetries: Number.isInteger(retries) && retries >= 0 ? Math.min(retries, 1) : 1, maxOutputTokens: Number.isInteger(outputTokens) && outputTokens >= 1024 ? Math.min(outputTokens, 8192) : null, development: env.NODE_ENV !== 'production' }
}

function outputTokenLimit(config, candidateCount) {
  return config.maxOutputTokens ?? Math.min(8192, Math.max(2048, candidateCount * 512))
}

async function readJsonBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new ApiError(400, 'INPUT_INVALID', '请求内容不是有效 JSON。') }
}
function send(response, status, payload) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

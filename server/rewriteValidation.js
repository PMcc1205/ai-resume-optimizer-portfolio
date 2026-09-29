const DUTY_LEVELS = [
  [/(?:主导|核心负责人|第一负责人|项目负责人|产品负责人|统筹|全面负责)/, 5],
  [/(?:独立负责|独立完成|独立输出|本人闭环|全程闭环|整体闭环)/, 4],
  [/(?:负责|组织)/, 3],
  [/(?:参与|参加)/, 2],
  [/(?:协助|配合)/, 1],
]
const PROJECT_STAGES = [
  [/(?:正式上线|商业上线|生产环境|上线后|正式使用|投入使用|面向真实用户|稳定运行)/, 6],
  [/(?:内部测试|内测)/, 5],
  [/(?:最小可行产品|MVP)/i, 4],
  [/(?:演示版本|Demo)/i, 3],
  [/(?:原型)/, 2],
  [/(?:方案设计)/, 1],
]
const CAPABILITY_LEVELS = [
  [/(?:精通|专家级|完整体系能力)/, 4],
  [/(?:掌握|熟练使用|实践经验|能够独立)/, 3],
  [/(?:熟悉)/, 2],
  [/(?:了解)/, 1],
]
const RESULT_TERMS = ['提升', '提高', '降低', '增长', '转化', '留存', '满意度', '准确率', '上线效果', '商业结果', '营收', '收入', '转化率', '增长率', '留存率', '用户规模', '用户数量', '显著']
const CLAIM_TYPE_VALUES = ['职责', '行动', '技术', '方法', '数字', '结果', '项目状态', '用户规模', '其他']
const CLAIM_TYPES = new Set(CLAIM_TYPE_VALUES)
const VALIDATION_FIELDS = ['rewriteId', 'claims', 'reason']
const CLAIM_FIELDS = ['claimText', 'claimType', 'supported', 'supportingFactIds', 'reason']

export const REWRITE_VALIDATION_OUTPUT_CONTRACT = Object.freeze({
  root: { validations: { required: true, type: 'array', nullable: false, allowEmpty: true } },
  validation: {
    rewriteId: { required: true, type: 'string', nullable: false },
    claims: { required: true, type: 'array', nullable: false, allowEmpty: true },
    reason: { required: true, type: 'string', nullable: false },
  },
  claim: {
    claimText: { required: true, type: 'string', nullable: false },
    claimType: { required: true, type: 'string', nullable: false, enum: CLAIM_TYPE_VALUES },
    supported: { required: true, type: 'boolean', nullable: false },
    supportingFactIds: { required: true, type: 'array<string>', nullable: false, allowEmpty: true },
    reason: { required: true, type: 'string', nullable: false },
  },
  additionalProperties: false,
})

class ApiError extends Error {
  constructor(status, code, message, retryable = false, details = {}) { super(message); this.status = status; this.code = code; this.retryable = retryable; Object.assign(this, details) }
}
const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const required = (v, name) => { if (typeof v !== 'string' || !v.trim()) throw new ApiError(422, 'INPUT_INVALID', `${name} 不能为空。`); return v.trim() }

export const REWRITE_VALIDATION_PROMPT = `你是简历生成后事实校验模块。只校验输入 Rewrite 当前文本，不改写文本，不重新判断岗位匹配。

输出契约：
1. 只输出一个完整合法的 JSON 对象；不允许 Markdown code fence、JSON 前后解释文字、注释或任何额外字段。
2. 根对象只能包含 validations。validations 必须是 array，允许空数组，不允许 null。
3. 每个 validation 只能包含且必须包含：rewriteId（string）、claims（array，允许空数组，不允许 null）、reason（string，必须始终存在，不允许 null）。
4. 每个 claim 只能包含且必须包含：claimText（string）、claimType（string）、supported（boolean）、supportingFactIds（string array，允许空数组，不允许 null）、reason（string）。
5. claimType 只能是：${CLAIM_TYPE_VALUES.join('、')}。
6. 有事实支持且没有 violation：supported=true，supportingFactIds 填入真实支持该声明的 Fact ID，reason 说明支撑关系；不要增加 violation、status 等字段。
7. 没有 supporting Fact：supported=false，supportingFactIds=[]，reason 说明缺少什么支持。
8. validation.reason 必须汇总该 Rewrite 的校验结论；无论通过或不通过都不得省略。
9. 禁止输出 status、validationStatus、violation、violationType、unsupportedClaims、evidence 或其他 Schema 未定义字段。
10. 必须先把 Rewrite 拆成彼此独立的事实 Claim；即使已经发现一个不支持的 Claim，也要继续扫描剩余 Claim，不得提前停止。
11. 对每个 Claim 逐项检查：职责等级、能力程度、数字值、数字指标/单位/统计对象、技术、实验或方法、项目阶段、项目归属、结果以及其他无支撑事实。多种独立风险必须分别保留对应 Claim；同一语义不要重复拆分。
12. 职责、能力与项目阶段是三个独立维度：项目上线不自动等于个人职责升级；能力程度升级也不等于职责升级。
13. 职责层级参考：协助 < 参与/参加 < 负责/组织 < 独立负责/闭环 < 主导/统筹。隐式 ownership（例如本人闭环、全程负责、统筹交付）也要比较。
14. 能力程度参考：了解 < 熟悉 < 掌握/熟练实践 < 精通/专家级。Source 只支持较低程度时，不得把更高程度标为 supported。
15. 项目阶段参考：方案 < 原型/Demo < MVP < 内部测试 < 正式上线/生产使用。计划上线、交付准备不能写成已上线或稳定运行。
16. “更具体”或“压缩表达”本身不是违规。参加与参与、协助与配合等同级表达，以及删除冗余但不改变事实强度的表达，应在 Fact 明确支持时判定 supported=true。

校验通过示例：
{"validations":[{"rewriteId":"rewrite-001","claims":[{"claimText":"参与用户访谈","claimType":"行动","supported":true,"supportingFactIds":["fact-001"],"reason":"fact-001 明确支持该行动。"}],"reason":"全部事实声明均有同一项目的已确认 Fact 支持。"}]}

校验不通过示例：
{"validations":[{"rewriteId":"rewrite-002","claims":[{"claimText":"将转化率提升至 20%","claimType":"结果","supported":false,"supportingFactIds":["fact-002"],"reason":"fact-002 的数字或指标口径与该声明不一致。"}],"reason":"存在数字或指标口径无法由 Fact 支持的声明。"}]}

无 supporting Fact 示例：
{"validations":[{"rewriteId":"rewrite-003","claims":[{"claimText":"主导产品正式上线","claimType":"职责","supported":false,"supportingFactIds":[],"reason":"当前 allowed Fact Set 无法支持主导职责和正式上线状态。"}],"reason":"存在没有 supporting Fact 的职责与项目状态声明。"}]}

只能使用该 Rewrite 的 usedFactIds 和同一 experienceId 的 Fact。职责等级、数字及单位/口径、项目阶段、结果、技术和所属项目都必须逐条核对；没有事实支持的声明 supported=false。不要替用户补事实，不要把完成工作推导成结果。`

export function createRewriteValidationPlugin(env) {
  const handler = createHandler(env)
  return { name: 'rewrite-validation-api', configureServer(server) { server.middlewares.use('/api/rewrite-validation', handler) }, configurePreviewServer(server) { server.middlewares.use('/api/rewrite-validation', handler) } }
}

export function validateRewriteValidationInput(value) {
  if (!isRecord(value) || !Array.isArray(value.rewrites) || !Array.isArray(value.facts) || !Array.isArray(value.requirements)) throw new ApiError(400, 'INPUT_INVALID', '事实校验输入必须包含 rewrites、facts 和 requirements。')
  const unique = (items, field) => {
    const map = new Map()
    for (const item of items) { if (!isRecord(item)) throw new ApiError(422, 'INPUT_INVALID', `${field} 包含非法对象。`); const id = required(item[field], field); if (map.has(id)) throw new ApiError(422, 'INPUT_INVALID', `${field} 不可重复。`); map.set(id, item) }
    return map
  }
  const rewriteById = unique(value.rewrites, 'rewriteId'); const factById = unique(value.facts, 'factId'); unique(value.requirements, 'requirementId')
  for (const rewrite of rewriteById.values()) {
    required(rewrite.optimizedText, 'optimizedText')
    required(rewrite.experienceId, 'experienceId')
    if (!Array.isArray(rewrite.usedFactIds) || rewrite.usedFactIds.length === 0 || rewrite.usedFactIds.some((id) => typeof id !== 'string')) throw new ApiError(422, 'INVALID_FACT_ID', `Rewrite ${rewrite.rewriteId} 的 usedFactIds 无效。`)
    if (rewrite.usedFactIds.some((id) => !factById.has(id))) throw new ApiError(422, 'INVALID_FACT_ID', `Rewrite ${rewrite.rewriteId} 引用了不存在的 Fact。`)
  }
  return value
}

export function parseRewriteValidationJson(text) {
  const raw = typeof text === 'string' ? text.trim() : ''
  if (!raw) throw new ApiError(502, 'MODEL_EMPTY_OUTPUT', '模型未返回事实校验结果。', true)
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new ApiError(502, 'OUTPUT_TRUNCATED', '事实校验 JSON 不完整。', true)
  try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { throw new ApiError(502, 'INVALID_JSON', '事实校验 JSON 无法解析。', true) }
}

export function validateRewriteValidationPayload(payload, input) {
  if (!isRecord(payload)) throw schemaError([schemaIssue('$', 'type', 'object', payload)], '事实校验响应必须是 JSON 对象。')
  const rootErrors = exactObjectErrors(payload, ['validations'], '$', { validations: 'array' })
  if (rootErrors.length) throw schemaError(rootErrors)
  if (payload.validations.length !== input.rewrites.length) throw schemaError([
    { errorPath: '$.validations', errorType: 'item_count', expected: String(input.rewrites.length), actual: String(payload.validations.length) },
  ], '事实校验结果数量与 Rewrite 不一致。')
  const byRewrite = new Map(input.rewrites.map((item) => [item.rewriteId, item])); const seen = new Set()
  return payload.validations.map((raw, validationIndex) => {
    const validationPath = `$.validations[${validationIndex}]`
    const validationErrors = exactObjectErrors(raw, VALIDATION_FIELDS, validationPath, { rewriteId: 'string', claims: 'array', reason: 'string' })
    if (validationErrors.length) throw schemaError(validationErrors)
    const rewrite = byRewrite.get(raw.rewriteId)
    if (!rewrite || seen.has(raw.rewriteId)) throw new ApiError(502, 'INVALID_REWRITE_ID', '事实校验引用了不存在或重复的 Rewrite。', true)
    seen.add(raw.rewriteId)
    const factsById = new Map(input.facts.map((fact) => [fact.factId, fact])); const allowedIds = new Set(rewrite.usedFactIds)
    const allowedFacts = rewrite.usedFactIds.map((id) => factsById.get(id)).filter(Boolean)
    const baseIssues = []
    if (rewrite.experienceId && allowedFacts.some((fact) => fact.experienceId !== rewrite.experienceId)) baseIssues.push('引用了其他项目的 Fact')
    if (allowedFacts.length !== rewrite.usedFactIds.length) baseIssues.push('usedFactIds 中存在不存在的 Fact')
    if (allowedFacts.some((fact) => fact.status !== '已确认' || fact.requiresConfirmation !== false || fact.conflictNote)) baseIssues.push('引用的 Fact 尚未确认或存在冲突')
    const claims = raw.claims.map((claim, claimIndex) => validateClaim(claim, allowedIds, factsById, `${validationPath}.claims[${claimIndex}]`))
    const claimIssues = claims.flatMap((claim) => claim.issues)
    const text = effectiveText(rewrite)
    const allowedText = allowedFacts.map((fact) => `${fact.content || ''}\n${fact.sourceText || ''}`).join('\n')
    baseIssues.push(...ruleIssues(text, allowedText, rewrite, allowedFacts))
    const unsupportedClaims = claims.filter((claim) => !claim.supported || claim.issues.length).map((claim) => claim.claimText)
    const issues = [...new Set([...baseIssues, ...claimIssues])]
    const status = issues.length || unsupportedClaims.length ? '校验不通过' : claims.length ? '校验通过' : '校验不通过'
    return {
      validationId: `validation-${rewrite.rewriteId}`,
      rewriteId: rewrite.rewriteId,
      rewriteVersion: rewrite.version || 'v1',
      status,
      claims: claims.map(({ issues: _issues, ...claim }) => claim),
      unsupportedClaims,
      usedFactIds: [...rewrite.usedFactIds],
      reason: issues.length ? issues.join('；') : '所有事实声明均可追溯到已确认经历。',
      validatedText: text,
    }
  })
}

function validateClaim(claim, allowedIds, factsById, claimPath) {
  const errors = exactObjectErrors(claim, CLAIM_FIELDS, claimPath, { claimText: 'string', claimType: 'string', supported: 'boolean', supportingFactIds: 'array', reason: 'string' })
  if (isRecord(claim) && typeof claim.claimType === 'string' && !CLAIM_TYPES.has(claim.claimType)) errors.push({ errorPath: `${claimPath}.claimType`, errorType: 'enum', expected: CLAIM_TYPE_VALUES.join(' | '), actual: claim.claimType })
  if (isRecord(claim) && Array.isArray(claim.supportingFactIds)) claim.supportingFactIds.forEach((factId, index) => {
    if (typeof factId !== 'string') errors.push(schemaIssue(`${claimPath}.supportingFactIds[${index}]`, 'type', 'string', factId))
  })
  if (errors.length) throw schemaError(errors, '事实声明字段不符合输出 Schema。')
  const issues = []
  if (!claim.supportingFactIds.length) issues.push('事实声明没有 supporting Fact')
  if (claim.supportingFactIds.some((id) => typeof id !== 'string' || !allowedIds.has(id) || !factsById.has(id))) issues.push('声明引用了不在 allowed Fact Set 中的 Fact')
  const supportingFacts = claim.supportingFactIds.map((id) => factsById.get(id)).filter(Boolean)
  if (claim.supported && supportingFacts.length && !hasSemanticSupport(claim.claimText, supportingFacts)) issues.push('supporting Fact 的内容无法支撑该声明')
  if (!claim.supported) issues.push(claim.reason || '该事实声明没有得到 Fact 支持')
  return { claimText: claim.claimText.trim(), claimType: claim.claimType, supported: claim.supported && issues.length === 0, supportingFactIds: claim.supportingFactIds, reason: claim.reason.trim(), issues }
}

function exactObjectErrors(value, allowedFields, path, types) {
  if (!isRecord(value)) return [schemaIssue(path, 'type', 'object', value)]
  const errors = []
  for (const field of allowedFields) {
    const fieldPath = `${path}.${field}`
    if (!Object.prototype.hasOwnProperty.call(value, field)) errors.push({ errorPath: fieldPath, errorType: 'required', expected: types[field], actual: 'undefined' })
    else if (!matchesOutputType(value[field], types[field])) errors.push(schemaIssue(fieldPath, 'type', types[field], value[field]))
  }
  for (const field of Object.keys(value)) if (!allowedFields.includes(field)) errors.push({ errorPath: `${path}.${field}`, errorType: 'additional_property', expected: 'not present', actual: outputType(value[field]) })
  return errors
}

function matchesOutputType(value, expected) {
  if (expected === 'array') return Array.isArray(value)
  if (expected === 'object') return isRecord(value)
  return typeof value === expected
}

function outputType(value) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function schemaIssue(errorPath, errorType, expected, actual) {
  return { errorPath, errorType, expected, actual: outputType(actual) }
}

function schemaError(schemaErrors, fallbackMessage = '事实校验输出不符合 Schema。') {
  const first = schemaErrors[0]
  const message = first ? `${first.errorPath} ${schemaErrorDescription(first)}` : fallbackMessage
  return new ApiError(502, 'SCHEMA_INVALID', message, true, { schemaErrors })
}

function schemaErrorDescription(issue) {
  if (issue.errorType === 'required') return `缺少必填字段（期望 ${issue.expected}，实际 ${issue.actual}）。`
  if (issue.errorType === 'additional_property') return `是未允许的额外字段（实际 ${issue.actual}）。`
  if (issue.errorType === 'enum') return `枚举值不合法（允许 ${issue.expected}，实际 ${issue.actual}）。`
  if (issue.errorType === 'item_count') return `数量不匹配（期望 ${issue.expected}，实际 ${issue.actual}）。`
  return `类型错误（期望 ${issue.expected}，实际 ${issue.actual}）。`
}

function hasSemanticSupport(claimText, facts) {
  const claim = normalizeClaim(claimText)
  if (!claim) return false
  const allowed = facts.map((fact) => normalizeClaim(`${fact.content || ''}${fact.sourceText || ''}`)).join('')
  const claimNumbers = extractNumbers(claimText)
  if ([...claimNumbers].some((number) => !extractNumbers(allowed).has(number))) return false
  const meaningful = [...new Set([...claim].filter((char) => /[\u4e00-\u9fffA-Za-z]/.test(char)))]
  const overlap = meaningful.filter((char) => allowed.includes(char)).length
  return meaningful.length === 0 || overlap / meaningful.length >= 0.28
}

function normalizeClaim(text) { return String(text).toLocaleLowerCase().replace(/[\s，。、“”‘’（）()：:；;、/\\·…!?！？【】[\]{}<>《》]/g, '') }

function ruleIssues(text, allowedText, rewrite, facts) {
  const issues = []; const duty = maxDutyLevel(allowedText); const rewrittenDuty = maxDutyLevel(text)
  if (rewrittenDuty > duty) issues.push(`职责等级超过 Fact 支持上限（允许 ${dutyLabel(duty)}）`)
  const capability = maxCapabilityLevel(allowedText); const rewrittenCapability = maxCapabilityLevel(text)
  if (rewrittenCapability > capability) issues.push(`能力程度超过 Fact 支持上限（允许 ${capabilityLabel(capability)}）`)
  const stage = maxProjectStage(allowedText); const rewrittenStage = maxProjectStage(text)
  if (rewrittenStage > stage) issues.push('项目状态超过 Fact 支持上限')
  const allowedNumbers = extractNumbers(allowedText)
  for (const number of extractNumbers(text)) if (!allowedNumbers.has(number)) issues.push(`数字或口径无法追溯：${number}`)
  const normalizedFacts = facts.map((fact) => `${fact.content || ''}\n${fact.sourceText || ''}`).join('\n')
  for (const term of RESULT_TERMS) if (text.includes(term) && !normalizedFacts.includes(term)) issues.push(`结果性表达“${term}”没有真实 Fact 支持`)
  if (rewrite.experienceId && facts.some((fact) => fact.experienceId !== rewrite.experienceId)) issues.push('存在跨项目 Fact')
  return issues
}

function effectiveText(rewrite) { return typeof rewrite.editedText === 'string' && rewrite.editedText.trim() ? rewrite.editedText.trim() : rewrite.optimizedText.trim() }
function maxDutyLevel(text) { return DUTY_LEVELS.reduce((max, [pattern, level]) => pattern.test(String(text)) ? Math.max(max, level) : max, 0) }
function dutyLabel(level) { return ['无明确职责', '协助', '参与', '负责', '独立负责', '主导'][Math.max(0, Math.min(5, level))] }
function maxCapabilityLevel(text) { return CAPABILITY_LEVELS.reduce((max, [pattern, level]) => pattern.test(String(text)) ? Math.max(max, level) : max, 0) }
function capabilityLabel(level) { return ['无明确能力程度', '了解', '熟悉', '掌握 / 熟练实践', '精通 / 专家级'][Math.max(0, Math.min(4, level))] }
function maxProjectStage(text) { return PROJECT_STAGES.reduce((max, [pattern, level]) => pattern.test(String(text)) ? Math.max(max, level) : max, 0) }
function extractNumbers(text) {
  const found = new Set(); const arabic = /\d[\d,]*(?:\.\d+)?\+?\s*(?:%|％|条|名|人|次|轮|组|项|款|类|份|个|年|月|天)?/g
  for (const match of String(text).matchAll(arabic)) found.add(match[0].replace(/\s+/g, '').replace(/,/g, '').replace(/％/g, '%'))
  const chinese = /[一二三四五六七八九十百千万两]+(?:条|名|人|次|轮|组|项|款|类|份|个|年|月|天)/g
  for (const match of String(text).matchAll(chinese)) found.add(match[0])
  return found
}

export async function generateRewriteValidations(config, input, invoke = callModel, options = {}) {
  let lastError
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    let result
    try {
      result = await invoke(config, input, lastError ? retryHint(lastError) : '')
      if (result.finishReason === 'length') throw new ApiError(502, 'OUTPUT_TRUNCATED', '事实校验响应被截断。', true)
      const validations = validateRewriteValidationPayload(parseRewriteValidationJson(result.content), input)
      emitAttempt(options.onAttempt, { attempt: attempt + 1, finishReason: result.finishReason ?? null, responseContent: result.content, errorCode: null, schemaErrors: [] })
      return validations
    } catch (error) {
      lastError = error instanceof ApiError ? error : new ApiError(502, 'MODEL_CALL_FAILED', '事实校验服务调用失败。', true)
      emitAttempt(options.onAttempt, { attempt: attempt + 1, finishReason: result?.finishReason ?? null, responseContent: result?.content ?? null, errorCode: lastError.code, schemaErrors: lastError.schemaErrors ?? [] })
      if (!lastError.retryable || attempt === config.maxRetries) throw lastError
    }
  }
  throw lastError
}

function retryHint(error) {
  const schemaDetails = (error.schemaErrors ?? []).map((issue) => `${issue.errorPath}: ${schemaErrorDescription(issue)}`).join(' ')
  const detail = schemaDetails || error.message
  return `上一响应未通过结构化事实校验。具体错误：${detail} 请严格按照给定 Schema 重新输出完整 JSON；不得省略必填字段，不得增加额外字段。`
}

function emitAttempt(listener, record) {
  if (typeof listener !== 'function') return
  try { listener(record) } catch { /* Evaluation diagnostics must not affect product validation. */ }
}

async function callModel(config, input, hint) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(config.apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, signal: controller.signal, body: JSON.stringify({ model: config.model, response_format: { type: 'json_object' }, max_tokens: config.maxOutputTokens ?? 8192, messages: [{ role: 'system', content: REWRITE_VALIDATION_PROMPT }, { role: 'user', content: `${hint ? `${hint}\n` : ''}${JSON.stringify({ rewrites: input.rewrites.map((rewrite) => ({ rewriteId: rewrite.rewriteId, experienceId: rewrite.experienceId, text: effectiveText(rewrite), usedFactIds: rewrite.usedFactIds })), facts: input.facts, requirements: input.requirements })}` }] }) })
    if (!response.ok) throw new ApiError(502, 'MODEL_CALL_FAILED', `事实校验模型调用失败（HTTP ${response.status}）。`, response.status !== 402)
    const payload = await response.json(); const choice = payload?.choices?.[0]
    if (typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) throw new ApiError(502, 'MODEL_EMPTY_OUTPUT', '模型未返回事实校验内容。', true)
    return { content: choice.message.content, finishReason: choice.finish_reason }
  } catch (error) { if (error?.name === 'AbortError') throw new ApiError(504, 'MODEL_TIMEOUT', '事实校验调用超时。', true); if (error instanceof ApiError) throw error; throw new ApiError(502, 'MODEL_CALL_FAILED', '无法连接模型服务。', true) } finally { clearTimeout(timer) }
}

export function readRewriteValidationConfig(env) { const timeout = Number(env.AI_TIMEOUT_MS); const retries = Number(env.AI_MAX_RETRIES); const output = Number(env.AI_VALIDATION_MAX_TOKENS || env.AI_REWRITE_MAX_TOKENS); return { apiUrl: env.AI_API_URL?.trim(), apiKey: env.AI_API_KEY?.trim(), model: env.AI_REWRITE_MODEL?.trim() || env.AI_MODEL?.trim(), timeoutMs: Number.isInteger(timeout) && timeout > 0 ? timeout : 45000, maxRetries: Number.isInteger(retries) && retries >= 0 ? Math.min(retries, 1) : 1, maxOutputTokens: Number.isInteger(output) && output >= 1024 ? Math.min(output, 8192) : null } }
const readConfig = readRewriteValidationConfig
async function readJsonBody(request) { const chunks = []; for await (const chunk of request) chunks.push(chunk); try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new ApiError(400, 'INPUT_INVALID', '请求内容不是有效 JSON。') } }
function send(response, status, payload) { response.statusCode = status; response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.end(JSON.stringify(payload)) }
function createHandler(env) { return async (request, response) => { if (request.method !== 'POST') return send(response, 405, { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST。' }); try { const input = validateRewriteValidationInput(await readJsonBody(request)); if (!input.rewrites.length) return send(response, 200, { validations: [] }); const config = readConfig(env); if (!config.apiUrl || !config.apiKey || !config.model) throw new ApiError(500, 'AI_NOT_CONFIGURED', '真实 AI 尚未配置。'); return send(response, 200, { validations: await generateRewriteValidations(config, input) }) } catch (error) { const normalized = error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', '事实校验服务发生错误。'); return send(response, normalized.status, { code: normalized.code, message: normalized.message, ...(normalized.schemaErrors?.length ? { schemaErrors: normalized.schemaErrors } : {}) }) } } }

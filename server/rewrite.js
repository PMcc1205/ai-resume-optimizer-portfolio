const OUTPUT_FIELDS = ['resumeItemId', 'diagnosisIds', 'optimizedText', 'usedFactIds', 'reason']
const ALLOWED_GAPS = new Set(['表达缺口', '能力程度不足'])
const RISK_TERMS = ['收入', '营收', '转化率', '准确率', '增长率', '留存率', '用户规模', '用户数量', '商业化', '正式上线']
const TECHNOLOGY_TERMS = ['Agent', 'RAG', 'LLM', '大语言模型', '向量数据库', '多模态', '生成式UI', '生成式 UI', 'A/B测试', 'A/B 测试', 'Python', 'Java', 'SQL', 'MySQL', 'React', 'Vue', 'DeepSeek', 'GPT', 'LangChain']

const PROMPT = `你是“AI 简历优化助手”的事实约束改写模块。你的任务是改表达，不造经历。
只返回一个完整合法 JSON 对象：{"rewrites":[...]}。禁止 Markdown、代码块、解释、注释和额外字段。
每条改写必须且只能返回 resumeItemId、diagnosisIds、optimizedText、usedFactIds、reason；字段不得省略。

规则：
1. 输入已由规则层按 experience 生成最终 projectItems。每个 projectItem 对应且只能生成一条 Rewrite；严格保持 projectItem 的 diagnosisIds、resumeItemIds 和 assignedFacts 边界，不得再次拆分、合并、新增或遗漏。最终 Rewrite 数量必须等于 projectItems 数量。
2. 同一 projectItem 可以覆盖同一 experience 下一个或多个 resumeItem 的 Diagnosis；从其 resumeItemIds 中选择最适合作为落点的 resumeItemId，并原样返回该 projectItem 的全部 diagnosisIds。所有 requiredDiagnosisIds 必须在最终 rewrites 中恰好出现一次。
3. optimizedText 只能使用当前 experiencePlan.allowedFacts 中明确存在的信息；不得从岗位要求反向补事实。
4. usedFactIds 只列实际写入该 bullet 的 assignedFacts，可只使用其中部分 Fact，不得为了用完事实而堆砌；Fact 已由规则层唯一分配，禁止引用其他 projectItem 的 Fact。
5. 用户补充经历只是事实来源。必须提炼职责、行动、方法、结果或数字后重新组织，禁止复制、拼接或轻微改写补充原文；不得沿用长补充文本的完整流程列举顺序，只选择与当前 bullet 目的直接相关的少量事实。
6. 每条 bullet 只承担一个主要价值，优先使用“动作 + 方法/对象 + 结果/产出”，建议 45～120 个中文字符；删除背景、产品定位、用户研究、职责和数字的重复说明。
7. 优先分工：用户研究事实用于洞察；需求数量与优先级用于需求分析/MVP；评测数字用于 AI 评测/Prompt 优化；跨团队事实用于协作推进。不要在每条 bullet 重复整套流程。
8. 不得新增职责、技术、数字、结果、项目状态、用户规模、商业成果或上线状态。
9. 保持职责等级：协助 < 参与 < 负责 < 独立负责 < 主导。每条 Rewrite 的职责上限以其 usedFactIds 对应 Fact 的 dutyCeiling 为准；参与不能写成负责，负责某模块不能写成项目负责人或主导。若 dutyCeiling 为“无明确职责”，只能使用“完成、整理、梳理、设计、分析”等中性行动词，禁止使用协助、参与、负责、独立负责、主导。生成前先逐条核对 dutyCeiling。
10. 保持项目状态：方案设计 < 原型 < Demo/演示版本 < MVP/最小可行产品 < 内部测试 < 正式上线。每条 Rewrite 的项目状态上限以其 usedFactIds 对应 Fact 的 projectStatusCeiling 为准，不得升级；Demo 不得写成上线。
11. 不得把不同 experienceId 的事实拼进同一个项目。
12. 能力程度不足只能更清楚表达已有实践，不能暗示已达到岗位要求，不能把 L2/L3 包装成 L4。
13. reason 必须以“核心目的：……”开头，说明该 bullet 唯一主要价值，再说明覆盖哪些 Diagnosis、使用哪些事实及保留什么边界。核心目的和 reason 其他部分同样受 usedFactIds 的职责、项目阶段和数字约束；Fact 只支持参与/负责时，reason 也禁止写主导/独立完成等更高等级词。
14. optimizedText 是可直接用于简历的一条 bullet，不输出编号、引号、前缀、多版本或产品说明。`

class ApiError extends Error {
  constructor(status, code, message, retryable = false) {
    super(message)
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const requiredString = (value, name, status = 422, code = 'INPUT_INVALID', retryable = false) => {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(status, code, `${name} 不能为空。`, retryable)
  return value.trim()
}

export function createRewritePlugin(env) {
  const handler = createHandler(env)
  return {
    name: 'rewrite-api',
    configureServer(server) { server.middlewares.use('/api/rewrite', handler) },
    configurePreviewServer(server) { server.middlewares.use('/api/rewrite', handler) },
  }
}

export function validateRewriteInput(value) {
  if (!isRecord(value) || !['diagnoses', 'requirements', 'mappings', 'gaps', 'facts', 'selectedDiagnosisIds'].every((field) => Array.isArray(value[field]))) {
    throw new ApiError(400, 'INPUT_INVALID', 'Rewrite 输入必须包含 diagnoses、requirements、mappings、gaps、facts 和 selectedDiagnosisIds。')
  }
  const byId = (items, field) => {
    const map = new Map()
    items.forEach((item) => {
      if (!isRecord(item)) throw new ApiError(422, 'INPUT_INVALID', `${field} 列表包含非法对象。`)
      const id = requiredString(item[field], field)
      if (map.has(id)) throw new ApiError(422, 'INPUT_INVALID', `${field} 重复：${id}。`)
      map.set(id, item)
    })
    return map
  }
  const diagnosisById = byId(value.diagnoses, 'diagnosisId')
  const requirementById = byId(value.requirements, 'requirementId')
  const mappingById = byId(value.mappings, 'mappingId')
  const gapById = byId(value.gaps, 'gapId')
  const factById = byId(value.facts, 'factId')
  if (value.selectedDiagnosisIds.length === 0) throw new ApiError(422, 'NO_REWRITE_SELECTION', '当前没有选择可优化的 Diagnosis。')
  if (new Set(value.selectedDiagnosisIds).size !== value.selectedDiagnosisIds.length || value.selectedDiagnosisIds.some((id) => typeof id !== 'string')) {
    throw new ApiError(422, 'INPUT_INVALID', 'selectedDiagnosisIds 必须是不可重复的字符串数组。')
  }

  const candidates = value.selectedDiagnosisIds.map((diagnosisId) => {
    const diagnosis = diagnosisById.get(diagnosisId)
    if (!diagnosis) throw new ApiError(422, 'INVALID_DIAGNOSIS_ID', `Rewrite 引用了不存在的 Diagnosis：${diagnosisId}。`)
    if (diagnosis.optimizable !== true || diagnosis.skipped === true) throw new ApiError(422, 'REWRITE_NOT_ALLOWED', `Diagnosis ${diagnosisId} 不允许进入 Rewrite。`)
    const requirement = requirementById.get(diagnosis.primaryRequirementId)
    const mapping = mappingById.get(diagnosis.mappingId)
    const gap = gapById.get(diagnosis.gapId)
    if (!requirement || !mapping || !gap || mapping.requirementId !== requirement.requirementId || gap.requirementId !== requirement.requirementId) {
      throw new ApiError(422, 'INVALID_REFERENCE', `Diagnosis ${diagnosisId} 的 Requirement、Mapping 或 Gap 引用无效。`)
    }
    const permission = gap.gapType === '表达缺口'
      ? '表达缺口'
      : gap.gapType === '能力缺口' && gap.capabilityGapSubtype === '能力程度不足' ? '能力程度不足' : ''
    if (!ALLOWED_GAPS.has(permission)) throw new ApiError(422, 'REWRITE_NOT_ALLOWED', `Diagnosis ${diagnosisId} 的 Gap 不允许改写。`)
    if (gap.gapType === '事实缺口' || gap.capabilityGapSubtype === '能力缺失') throw new ApiError(422, 'REWRITE_NOT_ALLOWED', `Diagnosis ${diagnosisId} 尚无改写权限。`)
    const originalText = requiredString(diagnosis.originalText, `Diagnosis ${diagnosisId} originalText`)
    const resumeItemId = requiredString(diagnosis.resumeItemId, `Diagnosis ${diagnosisId} resumeItemId`)
    const experienceId = requiredString(diagnosis.experienceId, `Diagnosis ${diagnosisId} experienceId`)
    const diagnosisFactIds = Array.isArray(diagnosis.factIds) ? diagnosis.factIds : []
    const allowedFacts = diagnosisFactIds.map((factId) => factById.get(factId)).filter((fact) => fact
      && fact.status === '已确认'
      && fact.requiresConfirmation === false
      && !fact.conflictNote
      && fact.experienceId === experienceId)
    if (allowedFacts.length === 0) throw new ApiError(422, 'EMPTY_ALLOWED_FACTS', `Diagnosis ${diagnosisId} 没有同一经历下可用于改写的 Fact。`)
    if (!Array.isArray(mapping.factIds) || allowedFacts.some((fact) => !mapping.factIds.includes(fact.factId))) {
      throw new ApiError(422, 'INVALID_FACT_ID', `Diagnosis ${diagnosisId} 的 Fact 不属于当前 Evidence Mapping。`)
    }
    return {
      diagnosisId,
      originalText,
      resumeItemId,
      experienceId,
      experienceName: diagnosis.experienceName,
      permission,
      diagnosis: { issueType: diagnosis.issueType, description: diagnosis.description, suggestion: diagnosis.suggestion },
      requirement: { requirementId: requirement.requirementId, normalizedRequirement: requirement.normalizedRequirement, requiredLevel: requirement.requiredLevel },
      mapping: { mappingId: mapping.mappingId, evidenceLevel: mapping.evidenceLevel, evidenceStrength: mapping.evidenceStrength, reason: mapping.reason },
      gap: { gapId: gap.gapId, gapType: gap.gapType, capabilityGapSubtype: gap.capabilityGapSubtype, rewritePermission: gap.rewritePermission, reason: gap.reason },
      allowedFacts: allowedFacts.map((fact) => ({
        factId: fact.factId, experienceId: fact.experienceId, experienceName: fact.experienceName,
        content: fact.content, sourceText: fact.sourceText, sourceLocation: fact.sourceLocation, type: fact.type,
        isSupplemental: /supplement/i.test(fact.factId) || /补充/.test(String(fact.sourceLocation)),
        dutyCeiling: dutyLabel(maxDutyLevel(`${fact.content}\n${fact.sourceText}`)),
        projectStatusCeiling: projectStatusLabel(maxProjectStatus(`${fact.content}\n${fact.sourceText}`)),
        ...(fact.numericDetail ? { numericDetail: fact.numericDetail } : {}),
        ...(fact.projectStatus ? { projectStatus: fact.projectStatus } : {}),
      })),
    }
  })
  const experiencePlans = buildExperiencePlans(candidates)
  const planItems = experiencePlans.flatMap((plan) => plan.projectItems.map((item) => ({
    planItemId: item.planItemId,
    experienceId: plan.experienceId,
    experienceName: plan.experienceName,
    resumeItemId: item.resumeItemId,
    resumeItemIds: [...item.resumeItemIds],
    originalText: item.originalTexts.join('\n'),
    originalTexts: [...item.originalTexts],
    diagnosisIds: [...item.diagnosisIds],
    allowedFactIds: [...item.allowedFactIds],
    allowedFacts: plan.allowedFacts.filter((fact) => item.allowedFactIds.includes(fact.factId)),
    rewriteGoals: [...item.rewriteGoals],
  })))
  const regenerateDiagnosisId = value.regenerateDiagnosisId == null ? null : requiredString(value.regenerateDiagnosisId, 'regenerateDiagnosisId')
  if (regenerateDiagnosisId && (!candidates.some((candidate) => candidate.diagnosisId === regenerateDiagnosisId)
    || planItems.length !== 1)) {
    throw new ApiError(422, 'INPUT_INVALID', '重新生成时只能包含同一条 Rewrite 覆盖的 Diagnosis。')
  }
  const existingRewrites = Array.isArray(value.existingRewrites) ? value.existingRewrites.map(normalizeExistingRewrite).filter(Boolean) : []
  return { candidates, experiencePlans, planItems, existingRewrites, regenerateDiagnosisId, previousOptimizedText: typeof value.previousOptimizedText === 'string' ? value.previousOptimizedText : '' }
}

function buildExperiencePlans(candidates) {
  const groups = new Map()
  candidates.forEach((candidate) => {
    const plan = groups.get(candidate.experienceId) ?? {
      experienceId: candidate.experienceId,
      experienceName: candidate.experienceName,
      resumeItems: [], diagnoses: [], allowedFacts: [],
    }
    if (!plan.resumeItems.some((item) => item.resumeItemId === candidate.resumeItemId)) {
      plan.resumeItems.push({ resumeItemId: candidate.resumeItemId, originalText: candidate.originalText, diagnosisIds: [], allowedFactIds: [], rewriteGoals: [] })
    }
    const resumeItem = plan.resumeItems.find((item) => item.resumeItemId === candidate.resumeItemId)
    resumeItem.diagnosisIds.push(candidate.diagnosisId)
    candidate.allowedFacts.forEach((fact) => {
      if (!resumeItem.allowedFactIds.includes(fact.factId)) resumeItem.allowedFactIds.push(fact.factId)
    })
    if (candidate.diagnosis.suggestion) resumeItem.rewriteGoals.push(candidate.diagnosis.suggestion)
    plan.diagnoses.push({
      diagnosisId: candidate.diagnosisId, resumeItemId: candidate.resumeItemId, permission: candidate.permission,
      issueType: candidate.diagnosis.issueType, description: candidate.diagnosis.description, suggestion: candidate.diagnosis.suggestion,
      factIds: candidate.allowedFacts.map((fact) => fact.factId),
      requirement: candidate.requirement, mapping: candidate.mapping, gap: candidate.gap,
    })
    candidate.allowedFacts.forEach((fact) => {
      if (!plan.allowedFacts.some((item) => item.factId === fact.factId)) plan.allowedFacts.push(fact)
    })
    groups.set(candidate.experienceId, plan)
  })
  return [...groups.values()].map((plan) => ({ ...plan, projectItems: buildProjectPlanItems(plan) }))
}

function buildProjectPlanItems(plan) {
  const atoms = plan.resumeItems.map((item, order) => ({
    order,
    resumeItemId: item.resumeItemId,
    resumeItemIds: [item.resumeItemId],
    originalTexts: [item.originalText],
    diagnosisIds: [...item.diagnosisIds],
    allowedFactIds: [...item.allowedFactIds],
    rewriteGoals: [...item.rewriteGoals],
  }))
  const pairs = []
  for (let left = 0; left < atoms.length; left += 1) {
    for (let right = left + 1; right < atoms.length; right += 1) {
      const a = atoms[left]; const b = atoms[right]
      const shared = a.allowedFactIds.filter((factId) => b.allowedFactIds.includes(factId)).length
      const factOverlap = shared / Math.max(1, Math.min(a.allowedFactIds.length, b.allowedFactIds.length))
      const semanticSimilarity = textSimilarity(projectItemSemanticText(a, plan), projectItemSemanticText(b, plan))
      if (factOverlap >= 0.75 && semanticSimilarity >= 0.15) {
        pairs.push({ left, right, score: factOverlap + semanticSimilarity })
      }
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.left - b.left || a.right - b.right)
  const paired = new Set(); const projectItems = []
  for (const pair of pairs) {
    if (paired.has(pair.left) || paired.has(pair.right)) continue
    paired.add(pair.left); paired.add(pair.right)
    projectItems.push(mergeProjectAtoms([atoms[pair.left], atoms[pair.right]], plan))
  }
  atoms.forEach((atom, index) => { if (!paired.has(index)) projectItems.push(mergeProjectAtoms([atom], plan)) })
  projectItems.sort((a, b) => a.order - b.order)
  assignFactsToProjectItems(projectItems, plan)
  return projectItems.map((item, index) => ({ ...item, planItemId: `${plan.experienceId}:project-${index + 1}` }))
}

function mergeProjectAtoms(atoms, plan) {
  const diagnosisIds = [...new Set(atoms.flatMap((item) => item.diagnosisIds))]
  const resumeItemIds = [...new Set(atoms.flatMap((item) => item.resumeItemIds))]
  const representative = [...atoms].sort((a, b) => b.diagnosisIds.length - a.diagnosisIds.length)[0]
  return {
    order: Math.min(...atoms.map((item) => item.order)),
    resumeItemId: representative.resumeItemId,
    resumeItemIds,
    originalTexts: [...new Set(atoms.flatMap((item) => item.originalTexts))],
    diagnosisIds,
    candidateFactIds: [...new Set(atoms.flatMap((item) => item.allowedFactIds))],
    allowedFactIds: [],
    rewriteGoals: [...new Set(atoms.flatMap((item) => item.rewriteGoals))],
    semanticText: atoms.map((item) => projectItemSemanticText(item, plan)).join('\n'),
  }
}

function projectItemSemanticText(item, plan) {
  const diagnosisIds = new Set(item.diagnosisIds)
  const diagnoses = plan.diagnoses.filter((diagnosis) => diagnosisIds.has(diagnosis.diagnosisId))
  return [
    ...(item.originalTexts ?? [item.originalText]),
    ...(item.rewriteGoals ?? []),
    ...diagnoses.flatMap((diagnosis) => [diagnosis.description, diagnosis.suggestion, diagnosis.requirement.normalizedRequirement]),
  ].filter(Boolean).join('\n')
}

function assignFactsToProjectItems(items, plan) {
  const factById = new Map(plan.allowedFacts.map((fact) => [fact.factId, fact]))
  const owners = new Map()
  for (const fact of plan.allowedFacts) {
    const eligible = items.filter((item) => item.candidateFactIds.includes(fact.factId))
    if (!eligible.length) continue
    const owner = [...eligible].sort((left, right) => factOwnershipScore(right, fact, plan) - factOwnershipScore(left, fact, plan)
      || left.resumeItemId.localeCompare(right.resumeItemId))[0]
    owner.allowedFactIds.push(fact.factId)
    owners.set(fact.factId, owner)
  }
  for (const item of items.filter((entry) => entry.allowedFactIds.length === 0)) {
    const movable = item.candidateFactIds.map((factId) => ({ factId, fact: factById.get(factId), owner: owners.get(factId) }))
      .filter((entry) => entry.fact && entry.owner && entry.owner.allowedFactIds.length > 1)
      .sort((a, b) => factOwnershipScore(item, b.fact, plan) - factOwnershipScore(item, a.fact, plan))[0]
    if (movable) {
      movable.owner.allowedFactIds = movable.owner.allowedFactIds.filter((factId) => factId !== movable.factId)
      item.allowedFactIds.push(movable.factId)
      owners.set(movable.factId, item)
    }
  }
}

function factOwnershipScore(item, fact, plan) {
  const directResumeItem = item.resumeItemIds.includes(`item-${fact.factId}`) ? 8 : 0
  const normalizedSource = normalizeComparable(fact.sourceText)
  const originalMatch = normalizedSource.length >= 8 && item.originalTexts.some((text) => {
    const normalizedOriginal = normalizeComparable(text)
    return normalizedOriginal.includes(normalizedSource) || normalizedSource.includes(normalizedOriginal)
  }) ? 4 : 0
  const diagnosisIds = new Set(item.diagnosisIds)
  const directDiagnoses = plan.diagnoses.filter((diagnosis) => diagnosisIds.has(diagnosis.diagnosisId) && diagnosis.factIds.includes(fact.factId)).length
  const semantic = textSimilarity(`${fact.content}\n${fact.sourceText}`, item.semanticText)
  return directResumeItem + originalMatch + directDiagnoses + semantic
}

function normalizeExistingRewrite(value) {
  if (!isRecord(value) || typeof value.optimizedText !== 'string' || typeof value.experienceId !== 'string') return null
  return {
    rewriteId: typeof value.rewriteId === 'string' ? value.rewriteId : '', experienceId: value.experienceId,
    optimizedText: typeof value.editedText === 'string' && value.editedText.trim() ? value.editedText : value.optimizedText,
    usedFactIds: Array.isArray(value.usedFactIds) ? value.usedFactIds.filter((id) => typeof id === 'string') : [],
  }
}

export function parseRewriteJson(text) {
  const raw = typeof text === 'string' ? text.trim() : ''
  if (!raw) throw new ApiError(502, 'MODEL_EMPTY_OUTPUT', '模型未返回 Rewrite 内容。', true)
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0) throw new ApiError(502, 'INVALID_JSON', '模型响应中没有 Rewrite JSON 对象。', true)
  if (end < start) throw new ApiError(502, 'OUTPUT_TRUNCATED', '模型返回的 Rewrite JSON 不完整。', true)
  try { return JSON.parse(cleaned.slice(start, end + 1)) }
  catch { throw new ApiError(502, looksTruncated(cleaned) ? 'OUTPUT_TRUNCATED' : 'INVALID_JSON', '模型返回的 Rewrite JSON 无法解析。', true) }
}

export function validateRewritePayload(payload, input) {
  if (!isRecord(payload) || !Array.isArray(payload.rewrites)) throw new ApiError(502, 'SCHEMA_INVALID', '模型返回缺少 rewrites 数组。', true)
  if (payload.rewrites.length === 0 && input.candidates.length > 0) throw new ApiError(502, 'EMPTY_REWRITE_RESULT', '模型未返回 Rewrite。', true)
  if (payload.rewrites.length > input.planItems.length) throw new ApiError(502, 'REWRITE_COUNT_EXCEEDS_PLAN', `模型返回 ${payload.rewrites.length} 条 Rewrite，超过项目级 Rewrite Plan 的 ${input.planItems.length} 项。`, true)
  const candidateById = new Map(input.candidates.map((candidate) => [candidate.diagnosisId, candidate]))
  const planByDiagnosis = new Map(input.planItems.flatMap((item) => item.diagnosisIds.map((diagnosisId) => [diagnosisId, item])))
  const seenDiagnoses = new Set()
  const seenResumeItems = new Set()
  const validated = payload.rewrites.map((item) => {
    if (!isRecord(item) || Object.keys(item).some((field) => !OUTPUT_FIELDS.includes(field)) || OUTPUT_FIELDS.some((field) => !(field in item))) {
      throw new ApiError(502, 'SCHEMA_INVALID', 'Rewrite 字段缺失或包含额外字段。', true)
    }
    const resumeItemId = requiredString(item.resumeItemId, 'resumeItemId', 502, 'SCHEMA_INVALID', true)
    if (!Array.isArray(item.diagnosisIds) || item.diagnosisIds.length === 0 || item.diagnosisIds.some((id) => typeof id !== 'string')) {
      throw new ApiError(502, 'SCHEMA_INVALID', 'diagnosisIds 必须是非空字符串数组。', true)
    }
    if (new Set(item.diagnosisIds).size !== item.diagnosisIds.length) throw new ApiError(502, 'INVALID_DIAGNOSIS_ID', '同一 Rewrite 重复引用 Diagnosis。', true)
    const coveredCandidates = item.diagnosisIds.map((diagnosisId) => candidateById.get(diagnosisId))
    if (coveredCandidates.some((candidate) => !candidate)) {
      throw new ApiError(502, 'UNKNOWN_DIAGNOSIS', 'Rewrite 引用了未选择的 Diagnosis。', true)
    }
    if (item.diagnosisIds.some((id) => seenDiagnoses.has(id))) {
      throw new ApiError(502, 'UNKNOWN_DIAGNOSIS', '同一 Diagnosis 被多个 Rewrite 覆盖。', true)
    }
    const experienceIds = new Set(coveredCandidates.map((candidate) => candidate.experienceId))
    if (experienceIds.size !== 1) throw new ApiError(502, 'CROSS_PROJECT_FACT', `Rewrite ${resumeItemId} 跨项目合并了 Diagnosis。`, true)
    const experienceId = coveredCandidates[0].experienceId
    const projectItem = planByDiagnosis.get(item.diagnosisIds[0])
    if (!projectItem || item.diagnosisIds.some((diagnosisId) => planByDiagnosis.get(diagnosisId) !== projectItem)) {
      throw new ApiError(502, 'PLAN_GROUP_MISMATCH', 'Rewrite 拆分或混合了项目级 Rewrite Plan 分组。', true)
    }
    if (item.diagnosisIds.length !== projectItem.diagnosisIds.length || projectItem.diagnosisIds.some((diagnosisId) => !item.diagnosisIds.includes(diagnosisId))) {
      throw new ApiError(502, 'PLAN_GROUP_MISMATCH', `Rewrite 必须完整覆盖 Plan ${projectItem.planItemId} 的 Diagnosis。`, true)
    }
    if (!projectItem.resumeItemIds.includes(resumeItemId)) {
      throw new ApiError(502, 'UNKNOWN_RESUME_ITEM', `Rewrite ${resumeItemId} 不属于项目级 Rewrite Plan 的原始条目。`, true)
    }
    const resumeItemKey = `${experienceId}:${resumeItemId}`
    if (seenResumeItems.has(resumeItemKey)) throw new ApiError(502, 'DUPLICATE_RESUME_ITEM', `同一简历条目 ${resumeItemId} 被拆成了多条 Rewrite。`, true)
    seenResumeItems.add(resumeItemKey)
    item.diagnosisIds.forEach((id) => seenDiagnoses.add(id))
    let optimizedText = requiredString(item.optimizedText, 'optimizedText', 502, 'SCHEMA_INVALID', true)
    const reason = requiredString(item.reason, 'reason', 502, 'SCHEMA_INVALID', true)
    if (!Array.isArray(item.usedFactIds) || item.usedFactIds.length === 0 || item.usedFactIds.some((id) => typeof id !== 'string')) {
      throw new ApiError(502, 'SCHEMA_INVALID', `Rewrite ${resumeItemId} 的 usedFactIds 必须是非空字符串数组。`, true)
    }
    if (new Set(item.usedFactIds).size !== item.usedFactIds.length) throw new ApiError(502, 'INVALID_FACT_ID', `Rewrite ${resumeItemId} 重复引用 Fact。`, true)
    const allowedById = new Map(projectItem.allowedFacts.map((fact) => [fact.factId, fact]))
    if (item.usedFactIds.some((id) => !allowedById.has(id))) throw new ApiError(502, 'INVALID_FACT_ID', `Rewrite ${resumeItemId} 引用了当前 Plan 未分配的 Fact。`, true)
    const usedFacts = item.usedFactIds.map((id) => allowedById.get(id))
    optimizedText = normalizeConstrainedText(optimizedText, usedFacts)
    const permission = coveredCandidates.some((candidate) => candidate.permission === '能力程度不足') ? '能力程度不足' : '表达缺口'
    const boundaryCandidate = { ...coveredCandidates[0], diagnosisId: item.diagnosisIds.join('、'), permission }
    enforceFactBoundaries(boundaryCandidate, optimizedText, usedFacts)
    enforceResumeStyle(boundaryCandidate, optimizedText, usedFacts)
    enforceReasonBoundaries(boundaryCandidate, reason, usedFacts)
    const diagnosisIds = [...item.diagnosisIds]
    const requirementIds = [...new Set(coveredCandidates.map((candidate) => candidate.requirement.requirementId))]
    return {
      rewriteId: rewriteIdFor(resumeItemId), diagnosisId: diagnosisIds[0], diagnosisIds,
      resumeItemId, experienceId, experienceName: coveredCandidates[0].experienceName,
      originalText: [...new Set(coveredCandidates.map((candidate) => candidate.originalText))].join('\n'), optimizedText,
      requirementIds, usedFactIds: item.usedFactIds, reason,
      validationStatus: '待事实校验', userDecision: '待处理',
    }
  })
  const missing = input.candidates.filter((candidate) => !seenDiagnoses.has(candidate.diagnosisId)).map((candidate) => candidate.diagnosisId)
  if (missing.length) throw new ApiError(502, 'MISSING_PLAN_ITEM', `以下 Diagnosis 未被 Rewrite Plan 完整覆盖：${missing.join('、')}。`, true)
  if (validated.length !== input.planItems.length) throw new ApiError(502, 'MISSING_PLAN_ITEM', `模型返回 ${validated.length} 条 Rewrite，项目级 Rewrite Plan 要求 ${input.planItems.length} 条。`, true)
  enforceExperienceDedup([...input.existingRewrites, ...validated])
  return validated
}

function enforceFactBoundaries(candidate, optimizedText, usedFacts) {
  const allowedText = usedFacts.map((fact) => `${fact.content}\n${fact.sourceText}`).join('\n')
  const allowedDuty = maxDutyLevel(allowedText); const rewrittenDuty = maxDutyLevel(optimizedText)
  if (rewrittenDuty > allowedDuty) throw new ApiError(502, 'DUTY_LEVEL_UPGRADED', `Rewrite ${candidate.diagnosisId} 扩大了职责等级（允许${dutyLabel(allowedDuty)}，输出${dutyLabel(rewrittenDuty)}）。`, true)
  const allowedStage = maxProjectStatus(allowedText); const rewrittenStage = maxProjectStatus(optimizedText)
  if (rewrittenStage > allowedStage) throw new ApiError(502, 'PROJECT_STATUS_UPGRADED', `Rewrite ${candidate.diagnosisId} 升级了项目状态（允许${projectStatusLabel(allowedStage)}，输出${projectStatusLabel(rewrittenStage)}）。`, true)
  const allowedNumbers = extractNumbers(allowedText)
  const unsupportedNumber = [...extractNumbers(optimizedText)].find((number) => !allowedNumbers.has(number))
  if (unsupportedNumber) throw new ApiError(502, 'UNSUPPORTED_NUMBER', `Rewrite ${candidate.diagnosisId} 新增或改变了数字：${unsupportedNumber}。`, true)
  const unsupportedTerm = [...RISK_TERMS, ...TECHNOLOGY_TERMS].find((term) => includesTerm(optimizedText, term) && !includesTerm(allowedText, term))
  if (unsupportedTerm) throw new ApiError(502, 'UNSUPPORTED_CLAIM', `Rewrite ${candidate.diagnosisId} 新增了白名单外信息：${unsupportedTerm}。`, true)
  if (candidate.permission === '能力程度不足' && /(?:完全|充分).{0,8}(?:满足|达到)|胜任|独立完成|独立负责|主导/.test(optimizedText)
    && maxDutyLevel(allowedText) < maxDutyLevel(optimizedText)) {
    throw new ApiError(502, 'CAPABILITY_OVERSTATED', `Rewrite ${candidate.diagnosisId} 将能力程度不足包装成了更高能力。`, true)
  }
}

function normalizeConstrainedText(text, usedFacts) {
  const duty = maxDutyLevel(usedFacts.map((fact) => `${fact.content}\n${fact.sourceText}`).join('\n'))
  let normalized = text
  if (duty <= 0) {
    normalized = normalized.replace(/独立负责|独立完成|主导|负责|参与|协助/g, '完成')
  } else if (duty === 1) {
    normalized = normalized.replace(/独立负责|独立完成|主导|负责|参与/g, '协助')
  } else if (duty === 2) {
    normalized = normalized.replace(/独立负责|独立完成|主导|负责/g, '参与')
  } else if (duty === 3) {
    normalized = normalized.replace(/独立负责|独立完成|主导/g, '负责')
  } else if (duty === 4) {
    normalized = normalized.replace(/主导/g, '独立负责')
  }
  const stage = maxProjectStatus(usedFacts.map((fact) => `${fact.content}\n${fact.sourceText}`).join('\n'))
  if (stage < 6) normalized = normalized.replace(/正式上线|商业上线|生产环境|上线后/g, stage > 0 ? projectStatusLabel(stage) : '落地')
  if (stage < 5) normalized = normalized.replace(/内部测试|内测/g, stage > 0 ? projectStatusLabel(stage) : '验证')
  if (stage < 4) normalized = normalized.replace(/最小可行产品|MVP/gi, stage > 0 ? projectStatusLabel(stage) : '方案')
  if (stage < 3) normalized = normalized.replace(/演示版本|Demo/gi, stage > 0 ? projectStatusLabel(stage) : '方案')
  if (stage < 2) normalized = normalized.replace(/原型/g, stage > 0 ? projectStatusLabel(stage) : '方案')
  return normalized
}

function enforceResumeStyle(candidate, optimizedText, usedFacts) {
  if (optimizedText.length > 220) throw new ApiError(502, 'NOT_RESUME_STYLE', `Rewrite ${candidate.diagnosisId} 过长，不符合简历 bullet 表达。`, true)
  for (const fact of usedFacts.filter((item) => item.isSupplemental)) {
    const source = normalizeComparable(fact.sourceText)
    const rewritten = normalizeComparable(optimizedText)
    if (source.length >= 16 && (rewritten.includes(source) || textSimilarity(source, rewritten) >= 0.5)) {
      throw new ApiError(502, 'SUPPLEMENT_COPIED', `Rewrite ${candidate.diagnosisId} 直接或近似复制了用户补充经历。`, true)
    }
  }
}

function enforceReasonBoundaries(candidate, reason, usedFacts) {
  if (!/^核心目的：/.test(reason)) throw new ApiError(502, 'SCHEMA_INVALID', `Rewrite ${candidate.diagnosisId} 的 reason 必须以“核心目的：”开头。`, true)
  const corePurpose = reason.split('；')[0]
  const allowedText = usedFacts.map((fact) => `${fact.content}\n${fact.sourceText}`).join('\n')
  const allowedDuty = maxDutyLevel(allowedText)
  if (maxDutyLevel(corePurpose) > allowedDuty) {
    throw new ApiError(502, 'DUTY_LEVEL_UPGRADED', `Rewrite ${candidate.diagnosisId} 的核心目的扩大了职责等级。`, true)
  }
}

function enforceExperienceDedup(items) {
  const groups = new Map()
  items.forEach((item) => {
    if (!item?.experienceId || !item?.optimizedText) return
    const group = groups.get(item.experienceId) ?? []
    group.push(item)
    groups.set(item.experienceId, group)
  })
  groups.forEach((group, experienceId) => {
    const facts = new Map(); const numbers = new Map()
    group.forEach((item) => {
      for (const factId of item.usedFactIds ?? []) {
        const previous = facts.get(factId)
        if (previous) throw new ApiError(502, 'DUPLICATE_FACT_USAGE', `项目 ${experienceId} 的 Fact ${factId} 被多条 Rewrite 重复使用。`, true)
        facts.set(factId, item.rewriteId)
      }
      for (const number of extractNumbers(item.optimizedText)) {
        const previous = numbers.get(number)
        if (previous) throw new ApiError(502, 'DUPLICATE_NUMBER_USAGE', `项目 ${experienceId} 的数字 ${number} 被多条 Rewrite 重复表达。`, true)
        numbers.set(number, item.rewriteId)
      }
    })
    for (let left = 0; left < group.length; left += 1) {
      for (let right = left + 1; right < group.length; right += 1) {
        if (textSimilarity(group[left].optimizedText, group[right].optimizedText) >= 0.5) {
          throw new ApiError(502, 'DUPLICATE_REWRITE', `项目 ${experienceId} 存在语义高度重复的 Rewrite。`, true)
        }
      }
    }
  })
}

function normalizeComparable(text) {
  return String(text).toLocaleLowerCase().replace(/[\s，。；、：:,.!?！？"“”'‘’（）()\-]/g, '')
}

function textSimilarity(left, right) {
  const a = charBigrams(normalizeComparable(left)); const b = charBigrams(normalizeComparable(right))
  if (!a.size || !b.size) return normalizeComparable(left) === normalizeComparable(right) ? 1 : 0
  let intersection = 0
  a.forEach((token) => { if (b.has(token)) intersection += 1 })
  return intersection / (a.size + b.size - intersection)
}

function charBigrams(text) {
  const tokens = new Set()
  for (let index = 0; index < text.length - 1; index += 1) tokens.add(text.slice(index, index + 2))
  return tokens
}

function maxDutyLevel(text) {
  const levels = [
    [/(?:主导|核心负责人|第一负责人|项目负责人|产品负责人)/g, 5],
    [/(?:独立负责|独立完成)/g, 4],
    [/(?:负责)/g, 3],
    [/(?:参与)/g, 2],
    [/(?:协助)/g, 1],
  ]
  return levels.reduce((highest, [pattern, level]) => pattern.test(String(text)) ? Math.max(highest, level) : highest, 0)
}

function dutyLabel(level) {
  return ['无明确职责', '协助', '参与', '负责', '独立负责', '主导'][Math.max(0, Math.min(5, level))]
}

function maxProjectStatus(text) {
  const value = String(text)
  const stages = [[/(?:正式上线|商业上线|生产环境|上线后)/, 6], [/(?:内部测试|内测)/, 5], [/(?:最小可行产品|MVP)/i, 4], [/(?:演示版本|Demo)/i, 3], [/(?:原型)/, 2], [/(?:方案设计)/, 1]]
  return stages.reduce((highest, [pattern, level]) => pattern.test(value) ? Math.max(highest, level) : highest, 0)
}

function projectStatusLabel(level) {
  return ['无明确项目阶段', '方案设计', '原型', 'Demo/演示版本', 'MVP/最小可行产品', '内部测试', '正式上线'][Math.max(0, Math.min(6, level))]
}

function extractNumbers(text) {
  const found = new Set()
  const arabic = /\d[\d,]*(?:\.\d+)?\+?\s*(?:%|％|条|名|人|次|轮|组|项|款|类|份|个|年|月|天)?/g
  for (const match of String(text).matchAll(arabic)) {
    const raw = match[0].replace(/\s+/g, '').replace(/,/g, '').replace(/％/g, '%')
    const parts = /^(\d+(?:\.\d+)?)(\+?)(.*)$/.exec(raw)
    if (!parts) continue
    const normalized = `${Number(parts[1])}${parts[2]}${parts[3]}`
    found.add(normalized)
  }
  const chinese = /[一二三四五六七八九十百千万两]+(?:条|名|人|次|轮|组|项|款|类|份|个|年|月|天)/g
  for (const match of String(text).matchAll(chinese)) found.add(match[0])
  return found
}

function includesTerm(text, term) {
  return String(text).toLocaleLowerCase().includes(term.toLocaleLowerCase())
}

function rewriteIdFor(resumeItemId) {
  const suffix = /^(?:item|resume-item)-(.+)$/i.exec(resumeItemId)?.[1] ?? resumeItemId
  return `rewrite-${suffix}`
}

function looksTruncated(text) {
  let braces = 0; let brackets = 0; let quoted = false; let escaped = false
  for (const char of text) {
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false }
    else if (char === '"') quoted = true
    else if (char === '{') braces += 1
    else if (char === '}') braces -= 1
    else if (char === '[') brackets += 1
    else if (char === ']') brackets -= 1
  }
  return quoted || braces > 0 || brackets > 0
}

export async function generateRewrites(config, input, invoke = callModel) {
  let lastError
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      const result = await invoke(config, input, retryHint(lastError))
      if (config.development !== false) console.info(`[rewrite] outputChars=${result.content?.length ?? 0} finishReason=${result.finishReason ?? 'unknown'}`)
      if (result.finishReason === 'length') throw new ApiError(502, 'OUTPUT_TRUNCATED', '模型返回的 Rewrite 因输出长度限制而截断。', true)
      const validated = validateRewritePayload(parseRewriteJson(result.content), input)
      if (config.development !== false) console.info(`[rewrite] success rewrites=${validated.length} groups=${JSON.stringify(validated.map((item) => ({ resumeItemId: item.resumeItemId, diagnosisIds: item.diagnosisIds, usedFactIds: item.usedFactIds, corePurpose: item.reason.split('；')[0] })))}`)
      return validated
    } catch (error) {
      lastError = error instanceof ApiError ? error : new ApiError(502, 'MODEL_CALL_FAILED', '模型服务调用失败。', true)
      if (config.development !== false) console.warn(`[rewrite] attempt=${attempt + 1} code=${lastError.code} message=${lastError.message} retry=${lastError.retryable && attempt < config.maxRetries}`)
      if (!lastError.retryable || attempt === config.maxRetries) throw lastError
    }
  }
}

function retryHint(error) {
  if (!error) return ''
  const planCodes = new Set(['REWRITE_COUNT_EXCEEDS_PLAN', 'DUPLICATE_RESUME_ITEM', 'UNKNOWN_DIAGNOSIS', 'UNKNOWN_RESUME_ITEM', 'MISSING_PLAN_ITEM', 'PLAN_GROUP_MISMATCH'])
  if (planCodes.has(error.code)) return `上一响应 Rewrite 数量/分组不符合指定项目级 Rewrite Plan，请严格按 projectItems 一项返回一条，不得新增、拆分或跨组合并。${error.message}`
  if (error.code === 'DUTY_LEVEL_UPGRADED') return `上一响应把事实中的职责等级写高了（包括 reason 的核心目的）。请逐条按 usedFactIds 对应的 dutyCeiling 重写：参与不得写负责，负责不得写主导，协助不得写参与；reason 也不得出现超出 dutyCeiling 的职责词；只返回完整 JSON。${error.message}`
  if (error.code === 'PROJECT_STATUS_UPGRADED') return `上一响应把事实中的项目阶段写高了。请逐条按 usedFactIds 对应的 projectStatusCeiling 重写：Demo、原型或 MVP 不得写成正式上线；只返回完整 JSON。${error.message}`
  if (error.code === 'SUPPLEMENT_COPIED') return `上一响应直接或近似复制了用户补充经历。请把补充经历仅作为事实素材，提炼一个动作、对象或结果，重新组织为更短的简历 bullet，不得沿用原始长句结构或整段措辞；只返回完整 JSON。${error.message}`
  return error.message
}

function createHandler(env) {
  return async (request, response) => {
    if (request.method !== 'POST') return send(response, 405, { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST。' })
    try {
      const input = validateRewriteInput(await readJsonBody(request))
      const config = readConfig(env)
      if (config.development) console.info(`[rewrite] diagnoses=${input.candidates.length} planItems=${input.planItems.length} experiences=${input.experiencePlans.length} planGroups=${JSON.stringify(input.planItems.map((item) => ({ planItemId: item.planItemId, resumeItemIds: item.resumeItemIds, diagnosisIds: item.diagnosisIds, allowedFactIds: item.allowedFactIds })))} inputChars=${JSON.stringify(modelExperiencePlans(input.experiencePlans)).length}`)
      return send(response, 200, { rewrites: await generateRewrites(config, input) })
    } catch (error) {
      const normalized = error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'Rewrite 服务发生错误。')
      return send(response, normalized.status, { code: normalized.code, message: normalized.message })
    }
  }
}

async function callModel(config, input, hint) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, signal: controller.signal,
      body: JSON.stringify({ model: config.model, response_format: { type: 'json_object' }, max_tokens: outputTokenLimit(config, input.planItems.length), messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: `${hint ? `上一响应未通过校验：${hint}。请重新规划 Fact 分工，只返回修正后的完整 JSON。\n` : ''}${input.regenerateDiagnosisId ? `这是重新生成请求。请在事实不变的前提下换一种简历表达，不要复用上一版本：${input.previousOptimizedText}\n` : ''}${input.existingRewrites.length ? `同项目中已存在的其他 Rewrite 如下，禁止重复其 Fact、数字和语义：${JSON.stringify(input.existingRewrites)}\n` : ''}experiencePlans=${JSON.stringify(modelExperiencePlans(input.experiencePlans))}` },
      ] }),
    })
    if (!response.ok) throw new ApiError(502, 'MODEL_CALL_FAILED', `模型服务调用失败（HTTP ${response.status}）。`, response.status !== 402)
    const payload = await response.json()
    const choice = payload?.choices?.[0]
    const content = choice?.message?.content
    if (config.development !== false) console.info(`[rewrite] modelFinish=${choice?.finish_reason ?? 'unknown'} contentChars=${typeof content === 'string' ? content.length : 0} reasoningChars=${typeof choice?.message?.reasoning_content === 'string' ? choice.message.reasoning_content.length : 0}`)
    if (typeof content !== 'string' || !content.trim()) throw new ApiError(502, choice?.finish_reason === 'length' ? 'OUTPUT_TRUNCATED' : 'MODEL_EMPTY_OUTPUT', '模型未返回 Rewrite 内容。', true)
    return { content, finishReason: choice?.finish_reason ?? null }
  } catch (error) {
    if (error?.name === 'AbortError') throw new ApiError(504, 'MODEL_TIMEOUT', 'Rewrite 调用超时。', true)
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'MODEL_CALL_FAILED', '无法连接模型服务。', true)
  } finally { clearTimeout(timer) }
}

function modelExperiencePlans(plans) {
  return plans.map((plan) => ({
    experienceId: plan.experienceId,
    experienceName: plan.experienceName,
    requiredDiagnosisIds: plan.diagnoses.map((diagnosis) => diagnosis.diagnosisId),
    requiredRewriteCount: plan.projectItems.length,
    projectItems: plan.projectItems.map((item) => ({
        planItemId: item.planItemId,
        resumeItemId: item.resumeItemId,
        resumeItemIds: item.resumeItemIds,
        originalTexts: item.originalTexts,
        diagnosisIds: item.diagnosisIds,
        allowedFactIds: item.allowedFactIds,
        assignedFacts: plan.allowedFacts.filter((fact) => item.allowedFactIds.includes(fact.factId)).map((fact) => ({
        factId: fact.factId,
        content: fact.content,
        sourceText: fact.sourceText,
        dutyCeiling: fact.dutyCeiling,
        projectStatusCeiling: fact.projectStatusCeiling,
        })),
        rewriteGoals: item.rewriteGoals,
      })),
    diagnoses: plan.diagnoses.map((diagnosis) => ({
      diagnosisId: diagnosis.diagnosisId,
      resumeItemId: diagnosis.resumeItemId,
      permission: diagnosis.permission,
      issueType: diagnosis.issueType,
      rewriteGoal: diagnosis.suggestion,
      requirement: {
        requirementId: diagnosis.requirement.requirementId,
        normalizedRequirement: diagnosis.requirement.normalizedRequirement,
        requiredLevel: diagnosis.requirement.requiredLevel,
      },
      evidenceLevel: diagnosis.mapping.evidenceLevel,
    })),
  }))
}

function readConfig(env) {
  const apiUrl = env.AI_API_URL?.trim(); const apiKey = env.AI_API_KEY?.trim(); const model = env.AI_REWRITE_MODEL?.trim() || env.AI_MODEL?.trim()
  if (!apiUrl || !apiKey || !model) throw new ApiError(500, 'AI_NOT_CONFIGURED', '真实 AI 尚未配置。')
  const timeout = Number(env.AI_TIMEOUT_MS); const retries = Number(env.AI_MAX_RETRIES); const output = Number(env.AI_REWRITE_MAX_TOKENS)
  return { apiUrl, apiKey, model, timeoutMs: Number.isInteger(timeout) && timeout > 0 ? timeout : 45000, maxRetries: Number.isInteger(retries) && retries >= 0 ? Math.min(retries, 1) : 1, maxOutputTokens: Number.isInteger(output) && output >= 1024 ? Math.min(output, 8192) : null, development: env.NODE_ENV !== 'production' }
}

function outputTokenLimit(config, count) { return config.maxOutputTokens ?? Math.min(8192, Math.max(8192, count * 800)) }
async function readJsonBody(request) { const chunks = []; for await (const chunk of request) chunks.push(chunk); try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new ApiError(400, 'INPUT_INVALID', '请求内容不是有效 JSON。') } }
function send(response, status, payload) { response.statusCode = status; response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.end(JSON.stringify(payload)) }

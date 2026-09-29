const LEVELS = ['L1 了解', 'L2 熟悉', 'L3 实践', 'L4 设计 / 主导']
const LEVEL_INDEX = new Map(LEVELS.map((level, index) => [level, index + 1]))
const EFFECTIVE_STRENGTHS = new Set(['强证据', '中等证据'])

export const MATCH_GAP_RULE_VERSION = 'match-gap-v2'

export function calculateMatchAndGaps(requirements, facts, mappings) {
  const mappingByRequirement = new Map(mappings.map((mapping) => [mapping.requirementId, mapping]))
  const factById = new Map(facts.map((fact) => [fact.factId, fact]))

  const evaluatedMappings = []
  const gaps = []

  requirements.forEach((requirement, index) => {
    const mapping = mappingByRequirement.get(requirement.requirementId) ?? emptyMapping(requirement.requirementId, index)
    const evidenceFacts = mapping.factIds
      .map((factId) => factById.get(factId))
      .filter((fact) => fact && fact.status === '已确认' && fact.requiresConfirmation === false && !fact.conflictNote)
    const hasExplicitAbsence = facts.some((fact) => isExplicitAbsenceForRequirement(fact, requirement))
    const hasEvidence = evidenceFacts.length > 0
      && mapping.evidenceStrength !== '无有效证据'
      && mapping.evidenceStrength !== '无有效支持'
      && mapping.relevance !== '无相关'

    let matchStatus
    let gapType
    let capabilityGapSubtype = null
    let gapReason
    let rewritePermission
    let nextAction

    if (hasExplicitAbsence) {
      matchStatus = '未满足'
      gapType = '能力缺口'
      capabilityGapSubtype = '能力缺失'
      gapReason = '用户已针对该岗位要求明确确认没有相关真实经历。'
      rewritePermission = '不可改写'
      nextAction = '保持真实差距，不通过文案生成不存在的经历。'
    } else if (!hasEvidence) {
      matchStatus = '待确认'
      gapType = '事实缺口'
      gapReason = '当前没有可用证据，但用户尚未确认不存在相关经历。'
      rewritePermission = '确认后改写'
      nextAction = '补充真实经历、确认没有相关经历，或暂时跳过。'
    } else if (!EFFECTIVE_STRENGTHS.has(mapping.evidenceStrength)) {
      if (hasExplicitPartialCoverage(requirement, mapping)) {
        matchStatus = '部分满足'
        gapType = '能力缺口'
        capabilityGapSubtype = '能力程度不足'
        gapReason = '现有真实事实能够明确证明岗位要求中的部分能力，但语义覆盖、能力深度或职责程度不足以证明完整要求。'
        rewritePermission = '有限改写'
        nextAction = '可以优化已有实践的表达，但不得补写尚未证明的能力组成部分。'
      } else {
        matchStatus = '待确认'
        gapType = '事实缺口'
        gapReason = `当前只有${mapping.evidenceStrength}和相邻线索，仍无法确认用户是否实际完成岗位要求中的关键行为。`
        rewritePermission = '确认后改写'
        nextAction = '补充能够直接证明关键能力、方法或结果的真实事实。'
      }
    } else if (levelOf(mapping.evidenceLevel) < levelOf(requirement.requiredLevel)) {
      matchStatus = '部分满足'
      gapType = '能力缺口'
      capabilityGapSubtype = '能力程度不足'
      gapReason = `现有证据最高只能证明 ${mapping.evidenceLevel}，低于岗位要求的 ${requirement.requiredLevel}。`
      rewritePermission = '有限改写'
      nextAction = '可以优化已有实践的表达，但不得提升真实职责或能力等级。'
    } else {
      matchStatus = '满足'
      const hasExpressionGap = evidenceFacts.some(isSupplementalResumeFact)
      gapType = hasExpressionGap ? '表达缺口' : '无缺口'
      gapReason = hasExpressionGap
        ? '能力证据已经达到岗位要求，但支持该结论的用户补充事实尚未写入当前简历。'
        : `现有${mapping.evidenceStrength}达到岗位要求，证据等级 ${mapping.evidenceLevel} 不低于 ${requirement.requiredLevel}，当前简历已有清晰事实表达。`
      rewritePermission = hasExpressionGap ? '可直接改写' : '无需改写'
      nextAction = hasExpressionGap ? '将已确认的补充事实写入简历，并保持原有职责边界。' : '保持现有真实表达。'
    }

    const evidenceReason = String(mapping.reason).split(' 匹配结论：')[0]
    const decisionReason = `${evidenceReason} 匹配结论：${gapReason}`
    evaluatedMappings.push({ ...mapping, matchStatus, reason: decisionReason })
    gaps.push({
      gapId: `gap-${String(index + 1).padStart(3, '0')}`,
      requirementId: requirement.requirementId,
      gapType,
      capabilityGapSubtype,
      reason: gapReason,
      severity: severityFor(requirement, gapType),
      rewritePermission,
      nextAction,
    })
  })

  return { mappings: evaluatedMappings, gaps }
}

export function createMatchGapSnapshot(requirements, facts, mappings) {
  return JSON.stringify({ ruleVersion: MATCH_GAP_RULE_VERSION, requirements, facts, mappings: mappings.map(stripDerivedStatus) })
}

function stripDerivedStatus(mapping) {
  const { matchStatus: _matchStatus, ...sourceMapping } = mapping
  return sourceMapping
}

function isExplicitAbsenceForRequirement(fact, requirement) {
  if (fact.status !== '明确不存在') return false
  const location = String(fact.sourceLocation ?? '')
  if (location.includes(requirement.requirementId)) return true
  if (fact.experienceId !== 'user-confirmation') return false
  const text = `${fact.content ?? ''}\n${fact.sourceText ?? ''}`
  return text.includes(`“${requirement.capability}”`) || text.includes(requirement.normalizedRequirement)
}

function isSupplementalResumeFact(fact) {
  return fact.status === '已确认' && /岗位匹配页\s*·\s*用户补充/.test(String(fact.sourceLocation ?? ''))
}

function hasExplicitPartialCoverage(requirement, mapping) {
  if (!mapping.factIds.length || mapping.relevance === '无相关') return false
  const reason = String(mapping.reason).split(' 匹配结论：')[0]
  const requirementText = `${requirement.normalizedRequirement}\n${requirement.sourceText ?? ''}`

  // 上线、发布等里程碑未被证明时，仍无法判断事实是否存在，不能当作已确认的能力程度不足。
  if (/(?:上线|发布|投产|生产环境)/.test(requirementText)
    && /(?:缺少|未证明|不能证明).{0,24}(?:上线|发布|投产|生产环境)/.test(reason)) return false

  // 产品机制中的人工确认不能证明个人已经形成相应工作习惯。
  if (/(?:个人|工作).{0,12}(?:习惯|方式)|人机协同.{0,12}(?:习惯|工作)/.test(requirementText)
    && /(?:产品机制|设计意识).{0,36}(?:缺少|不能证明).{0,24}(?:个人|日常|习惯|工作方式)/.test(reason)) return false

  const positiveClause = reason.split(/[；。]/).find((clause) => /仅支持|只支持|部分支持/.test(clause)) ?? reason
  const explicitlyProvesTargetPart = [
    /体现对?.{0,28}(?:熟悉|理解|判断能力)/,
    /体现.{0,20}(?:技术敏感度|商业敏感度|用户洞察|系统分析|产品判断)/,
    /(?:基于|通过|完成|开展).{0,48}(?:评测|实验|指标迭代|数据分析|连续迭代).{0,28}(?:优化|改善|验证|分析)?/,
    /(?:能证明|明确证明|直接证明).{0,36}(?:能力|实践|经验|判断|分析|优化)/,
  ].some((pattern) => pattern.test(positiveClause))
  const hasCoverageBoundary = /(?:仅支持|只支持|部分支持)/.test(reason)
    && /(?:缺少|未证明|不能证明|不足以证明)/.test(reason)

  return explicitlyProvesTargetPart && hasCoverageBoundary
}

function levelOf(level) {
  return LEVEL_INDEX.get(level) ?? 1
}

function severityFor(requirement, gapType) {
  if (gapType === '无缺口') return '低'
  if (gapType === '能力缺口' && requirement.importance === '核心要求') return '高'
  return '中'
}

function emptyMapping(requirementId, index) {
  return {
    mappingId: `map-${String(index + 1).padStart(3, '0')}`,
    requirementId,
    factIds: [],
    relevance: '无相关',
    evidenceStrength: '无有效证据',
    evidenceLevel: 'L1 了解',
    matchStatus: '待确认',
    reason: '当前没有对应的 Evidence Mapping。',
    confidence: 0,
  }
}

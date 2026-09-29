export const EVIDENCE_MAPPING_RULE_VERSION = 'semantic-v4'

export function createEvidenceMappingInputSnapshot(requirements, facts) {
  return JSON.stringify({ ruleVersion: EVIDENCE_MAPPING_RULE_VERSION, requirements, facts })
}

export function isLatestMappingRequest(requestId, latestRequestId) {
  return requestId === latestRequestId
}

export function createSupplementalFact({ facts, requirement, experience, supplement }) {
  const nextIndex = facts.reduce((highest, fact) => {
    const match = /^fact-supplement-(\d+)$/.exec(fact.factId)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0) + 1
  const factId = `fact-supplement-${String(nextIndex).padStart(3, '0')}`
  const resultText = supplement.result ? `；真实结果：${supplement.result}` : ''

  return {
    factId,
    experienceId: experience.experienceId,
    experienceName: experience.experienceName,
    content: `${supplement.responsibility}，${supplement.action}${resultText}。`,
    type: '行动事实',
    sourceText: `${supplement.responsibility}；${supplement.action}${resultText}`,
    sourceLocation: `岗位匹配页 · 用户补充 · ${requirement.requirementId}`,
    riskLevel: '中',
    riskReason: '由用户主动补充并确认，仅按填写内容建立证据。',
    reviewReason: null,
    requiresConfirmation: false,
    confidence: 1,
    status: '已确认',
  }
}

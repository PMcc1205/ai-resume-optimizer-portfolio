export function validationReasonPresentation(reason = '', unsupportedClaims = []) {
  const text = String(reason)
  if (/(?:职责等级|职责程度|核心目的扩大|扩大了职责|DUTY_LEVEL)/i.test(text)) return {
    kind: 'duty',
    title: '这条优化放大了你的职责程度。',
    explanation: '优化后的内容将已有的参与、使用或判断经历表达成了更高程度的职责，超出了当前已确认事实。建议降低职责表述后重新校验。',
  }
  if (/(?:数字|口径|UNSUPPORTED_NUMBER)/i.test(text)) return {
    kind: 'number',
    title: '这条优化包含无法从真实经历中确认的数字。',
    explanation: '当前数字、单位或指标口径与已确认事实不一致。请核对数字后手动修改，或重新生成。',
  }
  if (/(?:项目状态|项目阶段|正式上线|PROJECT_STATUS)/i.test(text)) return {
    kind: 'project-status',
    title: '这条优化将项目状态描述得高于真实阶段。',
    explanation: '当前表述超出了已确认的方案、原型、Demo、MVP、内部测试或上线阶段。请按真实项目阶段调整。',
  }
  if (/(?:跨项目|其他项目|CROSS_PROJECT)/i.test(text)) return {
    kind: 'cross-project',
    title: '这条优化混入了其他项目的经历信息。',
    explanation: '当前简历条目只能使用所属项目内的真实事实。请移除其他项目的信息后重新校验。',
  }
  return {
    kind: 'unsupported',
    title: '这条优化包含当前经历无法支持的表述。',
    explanation: unsupportedClaims.length
      ? '部分职责、行动、方法或结果暂时无法从已确认事实中追溯。请查看详细依据后修改、重新生成或手动确认。'
      : '当前内容没有足够的已确认事实支撑。请查看详细依据后修改、重新生成或手动确认。',
  }
}

export function diagnosisDisplayNames(diagnosisIds, diagnoses, requirements) {
  const requirementById = new Map(requirements.map((item) => [item.requirementId, item]))
  const names = diagnosisIds.map((id) => {
    const diagnosis = diagnoses.find((item) => item.diagnosisId === id)
    if (!diagnosis) return '相关简历表达问题'
    const requirement = requirementById.get(diagnosis.primaryRequirementId)
    const subject = cleanLabel(requirement?.capability || requirement?.normalizedRequirement || diagnosis.issueType)
    return subject ? `${subject}表达` : '相关简历表达问题'
  })
  return [...new Set(names)]
}

export function humanizeTechnicalError(message) {
  const text = String(message || '')
  if (!/(?:diag-|rewrite-|fact-|职责等级|核心目的扩大|数字|口径|项目状态|项目阶段|跨项目)/i.test(text)) return text
  const presentation = validationReasonPresentation(text)
  return `${presentation.title}${presentation.explanation}`
}

export function stripInternalIdentifiers(text) {
  return String(text || '')
    .replace(/(?:diag|rewrite|rw|fact)-[a-z0-9-]+(?:\s*[、,，]\s*(?:diag|rewrite|rw|fact)-[a-z0-9-]+)*/gi, '相关问题')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanLabel(value) {
  const text = String(value || '').replace(/[。；;：:]$/g, '').trim()
  if (!text) return ''
  return text.length > 28 ? `${text.slice(0, 28)}…` : text
}

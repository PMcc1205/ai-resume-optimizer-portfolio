export function applyRewriteDecision(items, rewriteId, decision) {
  const normalized = normalizeRewriteDecision(decision)
  return items.map((item) => item.rewriteId === rewriteId ? { ...item, userDecision: normalized } : item)
}

export function mergeRegeneratedRewrite(items, regenerated) {
  const regeneratedIds = diagnosisIdsOf(regenerated)
  return items.map((item) => diagnosisIdsOf(item).some((id) => regeneratedIds.includes(id))
    ? { ...regenerated, rewriteId: item.rewriteId, version: nextVersion(item, 'regenerated'), userDecision: '待处理', validationStatus: '待事实校验', validation: undefined }
    : item)
}

export function applyManualRewriteEdit(items, rewriteId, optimizedText) {
  const editedText = typeof optimizedText === 'string' ? optimizedText.trim() : ''
  if (!editedText) return items
  return items.map((item) => item.rewriteId === rewriteId
    ? { ...item, version: nextVersion(item, 'manual'), editedText, userDecision: '待处理', validationStatus: '待事实校验', validation: undefined }
    : item)
}

export function confirmRewriteFacts(items, rewriteId) {
  return items.map((item) => {
    if (item.rewriteId !== rewriteId || item.validationStatus !== '校验不通过' || !item.validation) return item
    return {
      ...item,
      validationStatus: '校验通过',
      validation: {
        ...item.validation,
        status: '校验通过',
        reason: '用户已手动确认当前版本中的事实声明真实有效。',
        confirmationMode: 'user-confirmed',
      },
    }
  })
}

export function mergeRewriteValidations(items, validations) {
  const byId = new Map(validations.map((validation) => [validation.rewriteId, validation]))
  return items.map((item) => {
    const result = byId.get(item.rewriteId)
    if (!result || item.validation?.confirmationMode === 'user-confirmed') return item
    if (result.validatedText !== effectiveRewriteText(item)) return item
    if (result.rewriteVersion && result.rewriteVersion !== (item.version || 'v1')) return item
    return { ...item, validationStatus: normalizeRewriteValidationStatus(result.status), validation: { ...result, status: normalizeRewriteValidationStatus(result.status) } }
  })
}

export function hasCurrentRewriteValidation(item) {
  return isCurrentValidation(item)
}

export function normalizeRewriteItems(items) {
  return items.map((item) => ({
    ...item,
    version: item.version || 'v1',
    diagnosisIds: Array.isArray(item.diagnosisIds) && item.diagnosisIds.length ? item.diagnosisIds : item.diagnosisId ? [item.diagnosisId] : [],
    editedText: typeof item.editedText === 'string' && item.editedText.trim() ? item.editedText : undefined,
    validation: isCurrentValidation(item) ? { ...item.validation, status: normalizeRewriteValidationStatus(item.validation.status) } : undefined,
    validationStatus: isCurrentValidation(item) ? normalizeRewriteValidationStatus(item.validation.status) : '待事实校验',
    userDecision: normalizeRewriteDecision(item.userDecision),
  }))
}

function isCurrentValidation(item) {
  if (!item.validation || typeof item.validation !== 'object') return false
  const text = typeof item.editedText === 'string' && item.editedText.trim() ? item.editedText.trim() : item.optimizedText
  return item.validation.validatedText === text && (!item.validation.rewriteVersion || item.validation.rewriteVersion === (item.version || 'v1'))
}

export function effectiveRewriteText(item) {
  return typeof item?.editedText === 'string' && item.editedText.trim() ? item.editedText : item?.optimizedText ?? ''
}

export function canEnterFinalResume(items) {
  return items.length > 0 && items.every((item) => {
    const decision = normalizeRewriteDecision(item.userDecision)
    const validation = normalizeRewriteValidationStatus(item.validationStatus)
    return decision === '已拒绝' || decision === '已接受' && validation === '校验通过'
  })
}

export function finalRewriteText(item) {
  const decision = normalizeRewriteDecision(item?.userDecision)
  const validation = normalizeRewriteValidationStatus(item?.validationStatus)
  if (decision === '已拒绝') return item?.originalText ?? ''
  if (decision === '已接受' && validation === '校验通过') return effectiveRewriteText(item)
  return null
}

export function acceptButtonState(item, regenerating = false) {
  const decision = normalizeRewriteDecision(item?.userDecision)
  const validation = normalizeRewriteValidationStatus(item?.validationStatus)
  const accepted = decision === '已接受'
  const rejected = decision === '已拒绝'
  const invalid = validation === '校验不通过'
  if (accepted) return { label: '已接受', disabled: true, title: '已接受；事实校验状态独立保留。', selected: true }
  if (invalid && rejected) return { label: '校验未通过，无法接受', disabled: true, title: '当前内容存在事实校验问题，请先手动修改或重新生成。', selected: false }
  if (regenerating) return { label: rejected && !invalid ? '改为接受' : '接受', disabled: true, title: '正在重新生成。', selected: false }
  return { label: rejected && !invalid ? '改为接受' : '接受', disabled: false, title: rejected ? '将用户决策改为已接受；事实校验状态不会改变。' : '接受该优化；接受不代表事实校验已经通过。', selected: false }
}

export function rejectButtonState(item, regenerating = false) {
  const decision = normalizeRewriteDecision(item?.userDecision)
  const accepted = decision === '已接受'
  const rejected = decision === '已拒绝'
  if (rejected) return { label: '已拒绝', disabled: true, title: '已拒绝；最终结果将保留原始简历内容。', selected: true }
  return { label: accepted ? '改为拒绝' : '拒绝', disabled: regenerating, title: accepted ? '将用户决策改为已拒绝；事实校验状态不会改变。' : '拒绝该优化并保留原始简历内容。', selected: false }
}

export function normalizeRewriteDecision(decision) {
  if (decision === '已接受' || decision === '已采纳' || decision === 'accepted') return '已接受'
  if (decision === '已拒绝' || decision === 'rejected') return '已拒绝'
  return '待处理'
}

export function normalizeRewriteValidationStatus(status) {
  if (status === '校验通过' || status === 'passed') return '校验通过'
  if (status === '校验不通过' || status === 'failed') return '校验不通过'
  return '待事实校验'
}

function diagnosisIdsOf(item) {
  return Array.isArray(item.diagnosisIds) && item.diagnosisIds.length ? item.diagnosisIds : item.diagnosisId ? [item.diagnosisId] : []
}

function nextVersion(item, kind) {
  return `${item.version || 'v1'}:${kind}:${Date.now()}`
}

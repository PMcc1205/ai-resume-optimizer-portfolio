export function resolutionStorageKey(baseKey, taskId) {
  return `${baseKey}:${taskId}`
}

export function readSkippedRequirements(storage, key) {
  try {
    const saved = JSON.parse(storage.getItem(key) ?? '[]')
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function updateSkippedRequirements(storage, key, current, requirementId, skipped) {
  const next = skipped ? Array.from(new Set([...current, requirementId])) : current.filter((id) => id !== requirementId)
  storage.setItem(key, JSON.stringify(next))
  return next
}

export function summarizeFactGapActions(mappings, gaps, skippedIds) {
  const pendingIds = new Set(mappings.filter((mapping) => mapping.matchStatus === '待确认').map((mapping) => mapping.requirementId))
  const factGapIds = gaps.filter((gap) => gap.gapType === '事实缺口' && pendingIds.has(gap.requirementId)).map((gap) => gap.requirementId)
  const skipped = new Set(skippedIds)
  const skippedCount = factGapIds.filter((id) => skipped.has(id)).length
  return { factGapCount: factGapIds.length, skippedCount, blockingCount: factGapIds.length - skippedCount }
}

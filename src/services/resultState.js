import { canEnterFinalResume, effectiveRewriteText, finalRewriteText, normalizeRewriteDecision } from './rewriteState.js'

export class ResultStateError extends Error {
  constructor(message, code = 'RESULT_INVALID') { super(message); this.code = code }
}

export function buildFinalResume(resumeText, rewrites) {
  if (typeof resumeText !== 'string' || !resumeText.trim()) throw new ResultStateError('当前任务没有可用的真实简历文本。', 'RESUME_EMPTY')
  if (!Array.isArray(rewrites) || !canEnterFinalResume(rewrites)) throw new ResultStateError('仍有优化建议尚未完成用户决策或事实校验。', 'RESULT_BLOCKED')
  const nodes = parseResumeNodes(resumeText)
  const accepted = rewrites.filter((rewrite) => normalizeRewriteDecision(rewrite.userDecision) === '已接受')
  assertUniqueRewriteText(accepted)

  // Resolve every target against the untouched resume before applying changes.
  // This prevents an earlier Rewrite from becoming the match target of a later one.
  const plans = rewrites.map((rewrite) => ({ rewrite, nodeIds: findResumeItemIds(nodes, rewrite.originalText), anchorId: null }))
  const acceptedPlans = plans.filter(({ rewrite }) => normalizeRewriteDecision(rewrite.userDecision) === '已接受')
  const matchCount = new Map()
  acceptedPlans.forEach(({ nodeIds }) => nodeIds.forEach((nodeId) => matchCount.set(nodeId, (matchCount.get(nodeId) ?? 0) + 1)))
  const ownerByAnchorId = new Map()
  acceptedPlans.forEach((plan) => {
    const uniqueIds = plan.nodeIds.filter((nodeId) => matchCount.get(nodeId) === 1)
    plan.anchorId = uniqueIds[0] ?? plan.nodeIds[0] ?? null
    if (plan.anchorId == null) return
    const owner = ownerByAnchorId.get(plan.anchorId)
    if (owner && owner !== plan.rewrite.rewriteId) {
      throw new ResultStateError('多个优化建议无法唯一对应原始简历条目。', 'RESULT_ITEM_CONFLICT')
    }
    ownerByAnchorId.set(plan.anchorId, plan.rewrite.rewriteId)
  })

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const insertions = new Map()
  const append = []
  const coveredNodeIds = new Set(acceptedPlans.flatMap((plan) => plan.nodeIds))
  const anchorIds = new Set(acceptedPlans.map((plan) => plan.anchorId).filter((id) => id != null))
  const replacementTexts = acceptedPlans.map(({ rewrite }) => effectiveRewriteText(rewrite))
  nodes.filter((node) => node.kind === 'item' && !coveredNodeIds.has(node.id))
    .filter((node) => replacementTexts.some((replacement) => isSemanticallySubsumed(node.text, replacement)))
    .forEach((node) => coveredNodeIds.add(node.id))
  coveredNodeIds.forEach((nodeId) => {
    if (!anchorIds.has(nodeId)) nodeById.get(nodeId).removed = true
  })

  for (const { rewrite, nodeIds, anchorId } of plans) {
    if (normalizeRewriteDecision(rewrite.userDecision) === '已拒绝') {
      if (!nodeIds.length) insertOriginalText(nodes, insertions, append, rewrite)
      continue
    }
    const replacement = finalRewriteText(rewrite).trim()
    const source = rewrite.editedText?.trim() ? 'manual' : 'ai'
    if (anchorId != null) {
      const first = nodeById.get(anchorId)
      first.text = preservePrefix(first.text, replacement)
      first.removed = false
      first.rewriteId = rewrite.rewriteId
      first.source = source
      continue
    }

    const item = { id: `inserted-${rewrite.rewriteId}`, kind: 'item', text: `• ${replacement}`, removed: false, rewriteId: rewrite.rewriteId, source }
    insertAtExperienceEnd(nodes, insertions, append, rewrite.experienceName, item)
  }

  const finalLines = []
  nodes.forEach((node) => {
    if (!node.removed) finalLines.push(publicLine(node))
    ;(insertions.get(node.id) ?? []).forEach((item) => finalLines.push(publicLine(item)))
  })
  append.forEach((item) => finalLines.push(publicLine(item)))
  return { lines: finalLines, sections: parseResumeSections(finalLines), text: finalLines.map((line) => line.text).join('\n').trim() }
}

export function buildResultStats(rewrites) {
  const adopted = rewrites.filter((item) => normalizeRewriteDecision(item.userDecision) === '已接受' && finalRewriteText(item) !== null).length
  const retained = rewrites.filter((item) => normalizeRewriteDecision(item.userDecision) === '已拒绝').length
  return { suggestionCount: rewrites.length, adoptedCount: adopted, retainedCount: retained, remainingCount: rewrites.length - adopted - retained }
}

export function buildDiagnosisStats(selectedDiagnosisIds, rewrites) {
  const acceptedIds = new Set(rewrites.filter((item) => normalizeRewriteDecision(item.userDecision) === '已接受' && finalRewriteText(item) !== null).flatMap(diagnosisIdsOf))
  const rejectedIds = new Set(rewrites.filter((item) => normalizeRewriteDecision(item.userDecision) === '已拒绝').flatMap(diagnosisIdsOf))
  const selected = new Set(selectedDiagnosisIds)
  return {
    issueCount: selected.size,
    resolvedCount: [...selected].filter((id) => acceptedIds.has(id)).length,
    retainedCount: [...selected].filter((id) => rejectedIds.has(id)).length,
    uncoveredCount: [...selected].filter((id) => !acceptedIds.has(id) && !rejectedIds.has(id)).length,
  }
}

export function buildGapStats(mappings, gaps, skippedIds) {
  const matchByRequirement = new Map(mappings.map((item) => [item.requirementId, item.matchStatus]))
  const skipped = new Set(skippedIds)
  const factGaps = gaps.filter((gap) => gap.gapType === '事实缺口' && matchByRequirement.get(gap.requirementId) === '待确认')
  const capabilityShortfalls = gaps.filter((gap) => gap.gapType === '能力缺口' && gap.capabilityGapSubtype === '能力程度不足')
  const capabilityMissing = gaps.filter((gap) => gap.gapType === '能力缺口' && gap.capabilityGapSubtype === '能力缺失')
  const skippedCount = factGaps.filter((gap) => skipped.has(gap.requirementId)).length
  return { factGapCount: factGaps.length, skippedCount, blockingFactGapCount: factGaps.length - skippedCount, capabilityShortfallCount: capabilityShortfalls.length, capabilityMissingCount: capabilityMissing.length, capabilityGapCount: capabilityShortfalls.length + capabilityMissing.length }
}

function parseResumeNodes(resumeText) {
  const physicalLines = resumeText.replace(/\r\n?/g, '\n').split('\n')
  const nodes = []
  let index = 0
  while (index < physicalLines.length) {
    const text = physicalLines[index]
    if (!text.trim()) {
      nodes.push(createNode(nodes.length, 'blank', text)); index += 1; continue
    }
    if (isSectionHeading(text)) {
      nodes.push(createNode(nodes.length, 'heading', text)); index += 1; continue
    }
    if (isBulletLine(text)) {
      const itemLines = [text]
      index += 1
      while (index < physicalLines.length && isItemContinuation(physicalLines, index)) {
        itemLines.push(physicalLines[index]); index += 1
      }
      nodes.push(createNode(nodes.length, 'item', itemLines.join('\n')))
      continue
    }
    const next = physicalLines[index + 1]
    const nextNext = physicalLines[index + 2]
    const structural = isMetaLine(text)
      || next != null && isMetaLine(next) && looksLikeExperienceTitle(text)
      || next != null && nextNext != null && isMetaLine(nextNext) && looksLikeExperienceTitle(text) && looksLikeExperienceTitle(next)
    if (!structural && isWrappedItemStart(text, next)) {
      const itemLines = [text]
      index += 1
      while (index < physicalLines.length && isPlainItemContinuation(physicalLines, index)) {
        itemLines.push(physicalLines[index]); index += 1
      }
      nodes.push(createNode(nodes.length, 'item', itemLines.join('\n')))
      continue
    }
    nodes.push(createNode(nodes.length, structural ? 'meta' : 'item', text))
    index += 1
  }
  return nodes
}

function createNode(id, kind, text) { return { id, kind, text, removed: false, rewriteId: null, source: 'original' } }
function publicLine(node) { return { text: node.text, rewriteId: node.rewriteId, source: node.source } }
function isBulletLine(text) { return /^\s*(?:[•·*\-\uF0B2]\s*|\d+[.)、]\s+|[（(]\d+[）)]\s*)/.test(text) }
function isItemContinuation(lines, index) {
  const text = lines[index]
  if (!text.trim() || isBulletLine(text) || isSectionHeading(text) || isMetaLine(text)) return false
  const next = lines[index + 1]
  if (next != null && isMetaLine(next) && looksLikeExperienceTitle(text)) return false
  return true
}
function looksLikeExperienceTitle(text) {
  const value = text.trim()
  return value.length <= 50 && !/[。；;，,]$/.test(value)
}
function isWrappedItemStart(text, next) {
  if (next == null || !next.trim() || isBulletLine(next) || isSectionHeading(next) || isMetaLine(next)) return false
  const value = text.trim()
  return /^(?:项目描述|工作内容|项目职责|主要职责|工作职责)[：:]/.test(value) || !/[。！？；;]$/.test(value)
}
function isPlainItemContinuation(lines, index) {
  const text = lines[index]
  return Boolean(text.trim()) && !isBulletLine(text) && !isSectionHeading(text) && !isMetaLine(text)
}
function isMetaLine(text) {
  const value = text.trim()
  return /^(?:(?:19|20)\d{2}(?:[./年-]\d{1,2}月?)?\s*(?:[-–—~至到]\s*(?:(?:19|20)\d{2}(?:[./年-]\d{1,2}月?)?|至今|现在))?|至今|现在)$/.test(value)
    || /(?:19|20)\d{2}(?:[./年-]\d{1,2}月?)?\s*(?:[-–—~至到]\s*(?:(?:19|20)\d{2}(?:[./年-]\d{1,2}月?)?|至今|现在))/.test(value)
}

function findResumeItemIds(nodes, originalText) {
  const targets = String(originalText || '').replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean)
  if (!targets.length) return []
  const eligible = nodes.filter((node) => node.kind === 'item')
  const matched = []
  for (const target of targets) {
    const match = bestItemMatch(eligible, target)
    if (match != null && !matched.includes(match.id)) matched.push(match.id)
  }
  return matched.sort((left, right) => left - right)
}

function bestItemMatch(nodes, target) {
  const scored = nodes.map((node) => ({ node, score: itemMatchScore(node.text, target) })).filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.node.id - right.node.id)
  if (!scored.length) return null
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    throw new ResultStateError('无法唯一定位优化建议对应的原始简历条目。', 'RESULT_ITEM_AMBIGUOUS')
  }
  return scored[0].node
}

function itemMatchScore(itemText, targetText) {
  const item = normalizeLine(itemText); const target = normalizeLine(targetText)
  if (!item || !target) return 0
  if (item === target) return 1000 + target.length
  if (target.length >= 4 && item.includes(target)) return 700 + Math.round(100 * target.length / item.length)
  if (item.length >= 6 && target.includes(item)) return 500 + Math.round(100 * item.length / target.length)
  return 0
}

function findExperienceNodeId(nodes, name) {
  if (!name) return null
  const target = normalizeLine(name)
  const found = nodes.find((node) => node.kind !== 'blank' && normalizeLine(node.text).includes(target))
  return found?.id ?? null
}
function insertAtExperienceEnd(nodes, insertions, append, experienceName, item) {
  const experienceId = findExperienceNodeId(nodes, experienceName)
  if (experienceId == null) { append.push(item); return }
  const start = nodes.findIndex((node) => node.id === experienceId)
  let end = nodes.length - 1
  for (let index = start + 1; index < nodes.length; index += 1) {
    if (nodes[index].kind === 'heading') { end = index - 1; break }
  }
  while (end > start && nodes[end].kind === 'blank') end -= 1
  const anchorId = nodes[end]?.id ?? experienceId
  insertions.set(anchorId, [...(insertions.get(anchorId) ?? []), item])
}
function insertOriginalText(nodes, insertions, append, rewrite) {
  const original = String(rewrite.originalText || '').trim()
  if (!original) return
  const item = { id: `retained-${rewrite.rewriteId}`, kind: 'item', text: `• ${original}`, removed: false, rewriteId: rewrite.rewriteId, source: 'original' }
  insertAtExperienceEnd(nodes, insertions, append, rewrite.experienceName, item)
}
function assertUniqueRewriteText(rewrites) {
  const seen = new Set()
  rewrites.forEach((rewrite) => {
    const normalized = normalizeLine(effectiveRewriteText(rewrite))
    if (normalized && seen.has(normalized)) throw new ResultStateError('最终简历包含重复的优化内容。', 'RESULT_DUPLICATE_REWRITE')
    seen.add(normalized)
  })
}
function isSemanticallySubsumed(original, replacement) {
  const source = normalizeSemanticText(original); const target = normalizeSemanticText(replacement)
  if (source.length < 18 || target.length < source.length) return false
  const sourceNumbers = source.match(/\d+(?:\.\d+)?\+?/g) ?? []
  if (sourceNumbers.some((number) => !target.includes(number))) return false
  const grams = new Set(); for (let index = 0; index < source.length - 1; index += 1) grams.add(source.slice(index, index + 2))
  let covered = 0; grams.forEach((gram) => { if (target.includes(gram)) covered += 1 })
  return grams.size > 0 && covered / grams.size >= 0.72
}
function normalizeSemanticText(text) { return normalizeLine(text).toLowerCase().replace(/[，。；：、“”‘’（）()【】\[\],.;:!?！？]/g, '') }
function normalizeLine(text) { return String(text).trim().replace(/^(?:[•·*\-\uF0B2]\s*|\d+[.)、]\s+|[（(]\d+[）)]\s*)/, '').replace(/\s+/g, '') }
function preservePrefix(original, replacement) { const prefix = /^\s*((?:[•·*\-\uF0B2]|\d+[.)、]|[（(]\d+[）)]))(?=\s|[^\d])\s*/.exec(original); return prefix ? `${prefix[1]} ${replacement}` : replacement }
function diagnosisIdsOf(item) { return Array.isArray(item.diagnosisIds) && item.diagnosisIds.length ? item.diagnosisIds : item.diagnosisId ? [item.diagnosisId] : [] }

function parseResumeSections(lines) {
  const sections = []; let current = { title: '', lines: [] }
  for (const line of lines) {
    if (!line.text.trim()) continue
    if (isSectionHeading(line.text)) {
      if (current.title || current.lines.length) sections.push(current)
      current = { title: line.text.trim().replace(/[：:]$/, ''), lines: [] }
    } else current.lines.push(line)
  }
  if (current.title || current.lines.length) sections.push(current)
  return sections.length ? sections : [{ title: '', lines: lines.filter((line) => line.text.trim()) }]
}

function isSectionHeading(text) {
  const value = text.trim().replace(/[：:]$/, '')
  return /^(?:个人信息|基本信息|求职意向|个人简介|教育背景|教育经历|工作背景|工作经历|实习经历|项目经历|产品经历|专业技能|技能清单|证书|获奖经历|校园经历|自我评价|语言能力)$/i.test(value)
}

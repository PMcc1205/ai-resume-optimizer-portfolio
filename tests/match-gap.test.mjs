import assert from 'node:assert/strict'
import { calculateMatchAndGaps, createMatchGapSnapshot } from '../src/services/matchGap.js'
import { createEvidenceMappingInputSnapshot, createSupplementalFact, isLatestMappingRequest } from '../src/services/matchingSupplement.js'
import { readSkippedRequirements, resolutionStorageKey, summarizeFactGapActions, updateSkippedRequirements } from '../src/services/matchingResolution.js'

let checks = 0
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1 }
const check = (value, message) => { assert.ok(value, message); checks += 1 }

function requirement(overrides = {}) {
  return {
    requirementId: 'req-001', normalizedRequirement: '独立设计产品方案', capability: '产品方案设计',
    requiredLevel: 'L3 实践', importance: '核心要求', sourceText: '独立设计产品方案',
    ...overrides,
  }
}

function fact(overrides = {}) {
  return {
    factId: 'fact-001', experienceId: 'exp-001', experienceName: '项目', content: '设计产品方案',
    sourceText: '设计产品方案', sourceLocation: '项目第1条', status: '已确认', requiresConfirmation: false,
    ...overrides,
  }
}

function mapping(overrides = {}) {
  return {
    mappingId: 'map-001', requirementId: 'req-001', factIds: ['fact-001'], relevance: '高相关',
    evidenceStrength: '强证据', evidenceLevel: 'L3 实践', matchStatus: '满足', reason: '存在直接证据。', confidence: 0.9,
    ...overrides,
  }
}

const decide = (r = requirement(), fs = [fact()], m = mapping()) => calculateMatchAndGaps([r], fs, [m])

const noEvidence = decide(requirement(), [], mapping({ factIds: [], relevance: '无相关', evidenceStrength: '无有效证据', evidenceLevel: 'L1 了解', matchStatus: '未满足' }))
equal(noEvidence.mappings[0].matchStatus, '待确认', '无 Evidence 应为待确认')
equal(noEvidence.gaps[0].gapType, '事实缺口', '无 Evidence 应为事实缺口')
check(noEvidence.gaps[0].capabilityGapSubtype === null, '无 Evidence 不得推断能力缺失')

const absent = fact({
  factId: 'fact-absent', experienceId: 'user-confirmation', experienceName: '用户补充确认',
  content: '未有能够证明“产品方案设计”的真实经历。', sourceText: '用户选择我没有相关经历。',
  sourceLocation: '岗位匹配页 · 用户确认 · req-001', status: '明确不存在',
})
const explicitlyAbsent = decide(requirement(), [absent], mapping({ factIds: [], relevance: '无相关', evidenceStrength: '无有效证据', evidenceLevel: 'L1 了解' }))
equal(explicitlyAbsent.mappings[0].matchStatus, '未满足', '明确不存在应为未满足')
equal(explicitlyAbsent.gaps[0].gapType, '能力缺口', '明确不存在应为能力缺口')
equal(explicitlyAbsent.gaps[0].capabilityGapSubtype, '能力缺失', '明确不存在应为能力缺失')

const levelShortfall = decide(requirement({ requiredLevel: 'L4 设计 / 主导' }), [fact()], mapping({ evidenceStrength: '中等证据', evidenceLevel: 'L3 实践', matchStatus: '待确认' }))
equal(levelShortfall.mappings[0].matchStatus, '部分满足', 'L4 Requirement + L3 Evidence 应部分满足')
equal(levelShortfall.gaps[0].capabilityGapSubtype, '能力程度不足', '等级不足应为能力程度不足')

const met = decide()
equal(met.mappings[0].matchStatus, '满足', '达标强证据应满足')
equal(met.gaps[0].gapType, '无缺口', '简历原文已充分表达时应无缺口')

const supplemental = fact({ sourceLocation: '岗位匹配页 · 用户补充' })
const expressionGap = decide(requirement(), [supplemental])
equal(expressionGap.mappings[0].matchStatus, '满足', '补充事实达到等级时能力层面满足')
equal(expressionGap.gaps[0].gapType, '表达缺口', '未写入简历的补充事实应形成表达缺口')

const insufficientCannotHide = decide(requirement({ requiredLevel: 'L4 设计 / 主导' }), [supplemental], mapping({ evidenceStrength: '强证据', evidenceLevel: 'L3 实践' }))
equal(insufficientCannotHide.gaps[0].gapType, '能力缺口', '表达缺口不得掩盖能力程度不足')

const beforeAdd = decide(requirement(), [], mapping({ factIds: [], relevance: '无相关', evidenceStrength: '无有效证据', evidenceLevel: 'L1 了解' }))
const afterAdd = decide(requirement(), [supplemental], mapping())
equal(beforeAdd.mappings[0].matchStatus, '待确认', '新增 Fact 前应待确认')
equal(afterAdd.mappings[0].matchStatus, '满足', '新增 Fact 与 Mapping 后应重新计算')

const afterDelete = decide(requirement(), [fact({ status: '已删除' })], mapping())
equal(afterDelete.mappings[0].matchStatus, '待确认', 'Fact 删除后旧 Mapping 不得继续产生满足')
equal(afterDelete.gaps[0].gapType, '事实缺口', 'Fact 删除后应重新生成事实缺口')

const oldGapSnapshot = createMatchGapSnapshot([requirement()], [fact()], [mapping()])
const updatedGapSnapshot = createMatchGapSnapshot([requirement()], [fact()], [mapping({ evidenceStrength: '弱证据' })])
check(oldGapSnapshot !== updatedGapSnapshot, 'Mapping 更新必须使旧 Gap 输入快照失效')

const weakMapping = decide(requirement(), [fact()], mapping({ evidenceStrength: '弱证据', matchStatus: '满足' }))
equal(weakMapping.mappings[0].matchStatus, '待确认', '旧 session 中的满足状态不得污染规则结果')
equal(weakMapping.gaps[0].gapType, '事实缺口', '弱证据应由当前规则生成事实缺口')

const partialCombination = decide(
  requirement({
    normalizedRequirement: '具备技术敏感度及商业敏感度',
    capability: '技术与商业判断',
    requiredLevel: 'L2 熟悉',
    sourceText: '具备技术敏感度及商业敏感度',
  }),
  [fact({ content: '对比6类模型并设计任务路由', sourceText: '对比6类模型并设计任务路由' })],
  mapping({
    relevance: '低相关', evidenceStrength: '弱证据', evidenceLevel: 'L2 熟悉',
    reason: '仅支持模型比较与路由体现技术敏感度；缺少商业模式、成本收益或付费转化证据。',
  }),
)
equal(partialCombination.mappings[0].matchStatus, '部分满足', '明确支持组合 Requirement 的一部分时应部分满足')
equal(partialCombination.gaps[0].capabilityGapSubtype, '能力程度不足', '组合能力只覆盖一部分应为能力程度不足')

const weakButExplicit = decide(
  requirement({
    normalizedRequirement: '通过数据实验持续优化产品策略',
    capability: '数据实验',
    sourceText: '通过 A/B 测试、用户行为分析、漏斗分析持续优化产品策略',
  }),
  [fact({ content: '基于50条样本完成4轮统一评测并改善质量指标', sourceText: '基于50条样本完成4轮统一评测并改善质量指标' })],
  mapping({
    relevance: '低相关', evidenceStrength: '弱证据', evidenceLevel: 'L3 实践',
    reason: '仅支持基于样本开展统一评测和连续迭代并优化质量指标；缺少A/B测试、行为分析和漏斗分析证据。',
  }),
)
equal(weakButExplicit.mappings[0].matchStatus, '部分满足', '弱证据明确证明部分目标能力时不得继续待确认')
equal(weakButExplicit.gaps[0].gapType, '能力缺口', '弱证据明确部分覆盖时应为能力缺口')

const weakAmbiguous = decide(
  requirement({ normalizedRequirement: '善于借助AI工具拆解复杂问题', capability: 'AI辅助问题拆解', sourceText: '借助AI工具拆解复杂问题' }),
  [fact({ content: '设计AI产品的任务路由', sourceText: '按任务设计模型路由' })],
  mapping({
    relevance: '中相关', evidenceStrength: '弱证据', evidenceLevel: 'L3 实践',
    reason: '仅支持在AI产品中拆解模型任务；缺少明确借助AI工具拆解复杂问题的直接证据。',
  }),
)
equal(weakAmbiguous.mappings[0].matchStatus, '待确认', '弱证据仍无法确认目标行为时应保持待确认')
equal(weakAmbiguous.gaps[0].gapType, '事实缺口', '相邻主题线索不能替代目标事实')

const unknownMilestone = decide(
  requirement({ normalizedRequirement: '推动产品从概念到正式上线', capability: '上线闭环', requiredLevel: 'L4 设计 / 主导', sourceText: '从概念到正式上线' }),
  [fact({ content: '完成需求设计和内部测试', sourceText: '完成需求设计和内部测试' })],
  mapping({
    relevance: '低相关', evidenceStrength: '弱证据', evidenceLevel: 'L3 实践',
    reason: '仅支持完成需求设计和内部评测优化；缺少正式上线或发布证据。',
  }),
)
equal(unknownMilestone.mappings[0].matchStatus, '待确认', '关键上线事实未知时不得直接判能力程度不足')

const unrelatedAbsence = fact({
  factId: 'fact-absent-other', experienceId: 'user-confirmation', status: '明确不存在',
  content: '未有能够证明“其他能力”的真实经历。', sourceLocation: '岗位匹配页 · 用户确认 · req-999',
})
const scopedAbsence = decide(requirement(), [unrelatedAbsence], mapping({ factIds: [], relevance: '无相关', evidenceStrength: '无有效证据', evidenceLevel: 'L1 了解' }))
equal(scopedAbsence.mappings[0].matchStatus, '待确认', '其他 Requirement 的负向事实不得导致能力缺失')

const totals = calculateMatchAndGaps(
  [requirement({ requirementId: 'req-001' }), requirement({ requirementId: 'req-002' })],
  [fact()],
  [mapping({ requirementId: 'req-001' }), mapping({ requirementId: 'req-002', factIds: [], relevance: '无相关', evidenceStrength: '无有效证据', evidenceLevel: 'L1 了解' })],
)
equal(totals.mappings.length, 2, '每条 Requirement 必须生成一个状态')
equal(totals.gaps.length, 2, '每条 Requirement 必须生成一个 Gap')

const launchRequirement = requirement({
  requirementId: 'req-launch',
  normalizedRequirement: '推动 AI 产品从概念到上线的完整闭环',
  capability: '产品上线闭环',
  requiredLevel: 'L4 设计 / 主导',
  sourceText: '推动 AI 产品从概念到上线的完整闭环',
})
const initialFacts = [fact()]
const launchSupplement = createSupplementalFact({
  facts: initialFacts,
  requirement: launchRequirement,
  experience: { experienceId: 'exp-001', experienceName: 'AI 产品项目' },
  supplement: {
    experienceId: 'exp-001',
    responsibility: '负责产品闭环推进',
    action: '从概念验证推进到正式上线并持续运营',
    result: '产品已进入生产环境',
  },
})
equal(launchSupplement.status, '已确认', '用户主动补充的 Fact 应立即成为可用事实')
equal(launchSupplement.requiresConfirmation, false, '用户主动补充的 Fact 不应再次阻塞确认')
check(launchSupplement.sourceLocation.includes('req-launch'), '补充 Fact 必须追溯到触发它的 Requirement')

const factsAfterSupplement = [...initialFacts, launchSupplement]

const snapshotBeforeSupplement = createEvidenceMappingInputSnapshot([launchRequirement], initialFacts)
const snapshotAfterSupplement = createEvidenceMappingInputSnapshot([launchRequirement], factsAfterSupplement)
check(snapshotBeforeSupplement !== snapshotAfterSupplement, '新增 Fact 必须触发新的 Evidence Mapping 输入快照')

const insufficientLaunchMapping = mapping({
  requirementId: 'req-launch',
  factIds: [launchSupplement.factId],
  relevance: '中相关',
  evidenceStrength: '中等证据',
  evidenceLevel: 'L3 实践',
  reason: '事实证明实际推进过上线流程，但职责与闭环深度不足以证明 L4。',
})
const insufficientLaunch = calculateMatchAndGaps([launchRequirement], factsAfterSupplement, [insufficientLaunchMapping])
equal(insufficientLaunch.mappings[0].matchStatus, '部分满足', '新增 Fact 等级不足时应重新计算为部分满足')
equal(insufficientLaunch.gaps[0].capabilityGapSubtype, '能力程度不足', '新增 Fact 等级不足时应形成能力程度不足')

const sufficientLaunchMapping = mapping({
  requirementId: 'req-launch',
  factIds: [launchSupplement.factId],
  relevance: '高相关',
  evidenceStrength: '强证据',
  evidenceLevel: 'L4 设计 / 主导',
  reason: '用户补充事实直接证明负责从概念到正式上线的完整闭环。',
})
const sufficientLaunch = calculateMatchAndGaps([launchRequirement], factsAfterSupplement, [sufficientLaunchMapping])
equal(sufficientLaunch.mappings[0].matchStatus, '满足', '新增 Fact 足够时应重新计算为满足')
equal(sufficientLaunch.gaps[0].gapType, '表达缺口', '岗位匹配页补充的达标 Fact 应形成表达缺口')
check(sufficientLaunch.mappings[0].factIds.includes(launchSupplement.factId), '主要支持证据必须引用新增 Fact')

const deletedSupplementFacts = factsAfterSupplement.map((item) => item.factId === launchSupplement.factId ? { ...item, status: '已删除' } : item)
const afterSupplementDelete = calculateMatchAndGaps([launchRequirement], deletedSupplementFacts, [sufficientLaunchMapping])
equal(afterSupplementDelete.mappings[0].matchStatus, '待确认', '新增 Fact 删除后下游状态必须重新失效')
equal(afterSupplementDelete.gaps[0].gapType, '事实缺口', '新增 Fact 删除后应恢复事实缺口')

const restoredFacts = JSON.parse(JSON.stringify(factsAfterSupplement))
const restoredResult = calculateMatchAndGaps([launchRequirement], restoredFacts, [sufficientLaunchMapping])
equal(restoredResult.mappings[0].matchStatus, sufficientLaunch.mappings[0].matchStatus, '页面刷新后持久化 Fact 应产生一致状态')
check(!isLatestMappingRequest(1, 2), '并发旧 Mapping 请求不得覆盖较新的结果')
check(isLatestMappingRequest(2, 2), '只有最新 Mapping 请求可以提交完整结果')

const resolutionValues = new Map()
const resolutionStore = {
  getItem(key) { return resolutionValues.get(key) ?? null },
  setItem(key, value) { resolutionValues.set(key, value) },
}
const resolutionKey = resolutionStorageKey('resume-matching-resolution-actions', 'task-a')
const pendingMappings = [mapping({ requirementId: 'req-001', matchStatus: '待确认' }), mapping({ requirementId: 'req-002', matchStatus: '待确认' })]
const pendingGaps = [{ requirementId: 'req-001', gapType: '事实缺口' }, { requirementId: 'req-002', gapType: '事实缺口' }]
const beforeSkip = summarizeFactGapActions(pendingMappings, pendingGaps, [])
equal(beforeSkip.blockingCount, 2, '未处理的事实缺口均应阻塞下一步')
const skipped = updateSkippedRequirements(resolutionStore, resolutionKey, [], 'req-001', true)
equal(pendingMappings[0].matchStatus, '待确认', '跳过不得修改 Match Status')
equal(pendingGaps[0].gapType, '事实缺口', '跳过不得修改 Gap Type')
equal(skipped.length, 1, '跳过应记录独立的交互状态')
const afterSkip = summarizeFactGapActions(pendingMappings, pendingGaps, skipped)
equal(afterSkip.factGapCount, 2, '跳过不得减少待确认事实缺口总数')
equal(afterSkip.skippedCount, 1, '跳过数应单独统计')
equal(afterSkip.blockingCount, 1, '跳过应减少一个阻塞待处理项')
equal(readSkippedRequirements(resolutionStore, resolutionKey)[0], 'req-001', '刷新后应恢复跳过记录')
equal(readSkippedRequirements(resolutionStore, resolutionStorageKey('resume-matching-resolution-actions', 'task-b')).length, 0, '跳过记录不能污染其他任务')
const allSkipped = updateSkippedRequirements(resolutionStore, resolutionKey, skipped, 'req-002', true)
equal(summarizeFactGapActions(pendingMappings, pendingGaps, allSkipped).blockingCount, 0, '全部跳过后应允许继续下一步')
equal(summarizeFactGapActions(pendingMappings, pendingGaps, allSkipped).factGapCount, 2, 'Diagnosis 仍应看到未解决事实缺口')
const reopened = updateSkippedRequirements(resolutionStore, resolutionKey, allSkipped, 'req-001', false)
equal(summarizeFactGapActions(pendingMappings, pendingGaps, reopened).blockingCount, 1, '重新处理应恢复阻塞与操作')
const handled = updateSkippedRequirements(resolutionStore, resolutionKey, reopened, 'req-002', false)
equal(readSkippedRequirements(resolutionStore, resolutionKey).length, 0, '补充经历或明确否认后应清除跳过记录')
equal(handled.length, 0, '已处理要求不应继续标为已跳过')

process.stdout.write(`${JSON.stringify({ ok: true, checks })}\n`)

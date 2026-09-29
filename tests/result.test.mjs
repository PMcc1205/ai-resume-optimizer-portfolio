import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildDiagnosisStats, buildFinalResume, buildGapStats, buildResultStats } from '../src/services/resultState.js'

let checks = 0
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1 }
const check = (value, message) => { assert.ok(value, message); checks += 1 }
const fails = (run, code) => { assert.throws(run, (error) => error.code === code); checks += 1 }

const resumeText = `个人信息
张三 | AI 产品经理

项目经历
AI 简历助手
• 原始需求分析条目
• 原始数据分析条目
• 未参与本轮优化的条目

教育背景
真实大学 | 产品设计`
const validation = (id, text) => ({ validationId: `validation-${id}`, rewriteId: id, status: '校验通过', claims: [], unsupportedClaims: [], usedFactIds: [], reason: '通过', validatedText: text })
const acceptedAi = { rewriteId: 'rewrite-1', diagnosisIds: ['diag-1'], originalText: '原始需求分析条目', optimizedText: '优化后的需求分析条目', requirementIds: [], usedFactIds: [], validationStatus: '校验通过', validation: validation('rewrite-1', '优化后的需求分析条目'), userDecision: '已接受' }
const rejected = { rewriteId: 'rewrite-2', diagnosisIds: ['diag-2'], originalText: '原始数据分析条目', optimizedText: '不应采用的 AI 文本', requirementIds: [], usedFactIds: [], validationStatus: '校验不通过', userDecision: '已拒绝' }
const result = buildFinalResume(resumeText, [acceptedAi, rejected])
check(result.text.includes('优化后的需求分析条目'), 'accepted + passed 使用 Rewrite')
check(result.text.includes('原始数据分析条目'), 'rejected 使用 originalText')
check(!result.text.includes('不应采用的 AI 文本'), 'rejected Rewrite 不进入结果')
check(result.text.includes('未参与本轮优化的条目'), '未参与优化条目保留原文')
equal(result.sections.map((section) => section.title).join('|'), '个人信息|项目经历|教育背景', '真实 Resume section 顺序保持')

const acceptedManual = { ...acceptedAi, editedText: '用户手动修改后的最终条目', validation: validation('rewrite-1', '用户手动修改后的最终条目') }
const manualResult = buildFinalResume(resumeText, [acceptedManual, rejected])
check(manualResult.text.includes('用户手动修改后的最终条目'), 'manual + accepted + passed 使用手动文本')
check(!manualResult.text.includes('优化后的需求分析条目'), '手动文本优先于 AI Rewrite')
fails(() => buildFinalResume(resumeText, [{ ...acceptedAi, validationStatus: '校验不通过' }]), 'RESULT_BLOCKED')
fails(() => buildFinalResume(resumeText, [{ ...acceptedAi, validationStatus: '待事实校验' }]), 'RESULT_BLOCKED')

const stats = buildResultStats([acceptedManual, rejected])
equal(stats.suggestionCount, 2, 'Rewrite 统计以优化建议为单位')
equal(stats.adoptedCount, 1, '已采用统计正确')
equal(stats.retainedCount, 1, '保留原文统计正确')
equal(stats.remainingCount, 0, '完成状态无仍需处理')
const diagnosisStats = buildDiagnosisStats(['diag-1', 'diag-2', 'diag-3'], [acceptedManual, rejected])
equal(diagnosisStats.issueCount, 3, 'Diagnosis 统计独立计算')
equal(diagnosisStats.resolvedCount, 1, 'accepted Rewrite 覆盖 Diagnosis')
equal(diagnosisStats.retainedCount, 1, 'rejected Rewrite 对应保留问题')

const mappings = [{ requirementId: 'req-1', matchStatus: '待确认' }, { requirementId: 'req-2', matchStatus: '待确认' }]
const gaps = [{ requirementId: 'req-1', gapType: '事实缺口', capabilityGapSubtype: null }, { requirementId: 'req-2', gapType: '事实缺口', capabilityGapSubtype: null }, { requirementId: 'req-3', gapType: '能力缺口', capabilityGapSubtype: '能力程度不足' }, { requirementId: 'req-4', gapType: '能力缺口', capabilityGapSubtype: '能力缺失' }]
const gapStats = buildGapStats(mappings, gaps, ['req-1', 'req-2'])
equal(gapStats.factGapCount, 2, 'skipped 仍计入待确认事实缺口')
equal(gapStats.skippedCount, 2, 'skipped 数量正确')
equal(gapStats.blockingFactGapCount, 0, 'skipped 不计入阻塞项')
equal(gapStats.capabilityGapCount, 2, '能力缺口分开统计')
equal(buildFinalResume(resumeText, [acceptedManual, rejected]).text, manualResult.text, '复制内容与页面聚合文本一致')
equal(buildFinalResume(resumeText, [acceptedManual, rejected]).text, manualResult.text, '刷新后相同状态生成相同结果')

const structuredResume = `项目经历
AI 简历助手 | 产品设计
2025.03 - 2025.08
• 参与需求分析并输出方案，
  使用访谈记录梳理核心问题与流程说明。
• 跟踪留存与转化指标，形成上线复盘。
• 保持原样的项目条目

教育背景
真实大学 | 产品设计`
const multilineRewrite = {
  ...acceptedAi,
  rewriteId: 'rewrite-multiline',
  originalText: '参与需求分析并输出方案',
  optimizedText: '参与需求分析，结合访谈记录梳理核心问题并输出产品方案。',
  validation: validation('rewrite-multiline', '参与需求分析，结合访谈记录梳理核心问题并输出产品方案。'),
  experienceName: 'AI 简历助手',
}
const structuredResult = buildFinalResume(structuredResume, [multilineRewrite])
check(structuredResult.text.includes('• 参与需求分析，结合访谈记录梳理核心问题并输出产品方案。'), '局部 originalText 按完整 resumeItem 替换')
check(!structuredResult.text.includes('使用访谈记录梳理核心问题与流程说明'), '跨行 resumeItem 的续行不会残留')
check(!structuredResult.text.includes('参与需求分析并输出方案，'), '原始句尾不会残留')
check(structuredResult.text.indexOf('2025.03 - 2025.08') < structuredResult.text.indexOf('参与需求分析'), '日期与条目顺序保持')
check(structuredResult.text.indexOf('保持原样的项目条目') < structuredResult.text.indexOf('教育背景'), '未参与条目与 section 顺序保持')
const numberedResult = buildFinalResume('项目经历\n1. 原始编号条目\n2. 保留编号条目', [{ ...acceptedAi, originalText: '原始编号条目', optimizedText: '优化编号条目', validation: validation('rewrite-1', '优化编号条目') }])
check(numberedResult.text.includes('1. 优化编号条目') && numberedResult.text.includes('2. 保留编号条目'), '编号式 resumeItem 保留前缀和顺序')

const mergedRewrite = {
  ...acceptedAi,
  rewriteId: 'rewrite-merged',
  originalText: '参与需求分析并输出方案\n跟踪留存与转化指标',
  optimizedText: '参与需求分析与指标复盘，输出产品方案并跟踪留存、转化表现。',
  validation: validation('rewrite-merged', '参与需求分析与指标复盘，输出产品方案并跟踪留存、转化表现。'),
}
const mergedResult = buildFinalResume(structuredResume, [mergedRewrite])
equal((mergedResult.text.match(/参与需求分析与指标复盘/g) ?? []).length, 1, '多个原始 resumeItem 合并为一个 Rewrite')
check(!mergedResult.text.includes('使用访谈记录梳理核心问题与流程说明') && !mergedResult.text.includes('形成上线复盘'), '合并 Rewrite 完整移除所有覆盖条目')

const rejectedMultiline = { ...multilineRewrite, userDecision: '已拒绝', validationStatus: '校验不通过' }
equal(buildFinalResume(structuredResume, [rejectedMultiline]).text, structuredResume, '拒绝的跨行 resumeItem 完整保留')
const supplementalRejected = { ...rejectedMultiline, rewriteId: 'rewrite-supplemental', originalText: '补充经历原文', experienceName: 'AI 简历助手' }
check(buildFinalResume(structuredResume, [supplementalRejected]).text.includes('• 补充经历原文'), '拒绝但不在原简历中的补充经历使用 originalText')

const conflictRewrite = {
  ...multilineRewrite,
  rewriteId: 'rewrite-conflict',
  originalText: '使用访谈记录梳理核心问题与流程说明',
  optimizedText: '参与访谈分析并整理产品流程。',
  validation: validation('rewrite-conflict', '参与访谈分析并整理产品流程。'),
}
fails(() => buildFinalResume(structuredResume, [multilineRewrite, conflictRewrite]), 'RESULT_ITEM_CONFLICT')
fails(() => buildFinalResume(structuredResume, [multilineRewrite, { ...multilineRewrite, rewriteId: 'rewrite-duplicate', originalText: '跟踪留存与转化指标' }]), 'RESULT_DUPLICATE_REWRITE')

const overlapLeft = { ...multilineRewrite, rewriteId: 'rewrite-overlap-left', originalText: 'AI 简历助手\n参与需求分析并输出方案', optimizedText: '负责产品定位表达。', validation: validation('rewrite-overlap-left', '负责产品定位表达。') }
const overlapRight = { ...multilineRewrite, rewriteId: 'rewrite-overlap-right', originalText: '参与需求分析并输出方案\n跟踪留存与转化指标', optimizedText: '负责需求与指标表达。', validation: validation('rewrite-overlap-right', '负责需求与指标表达。') }
const overlapResult = buildFinalResume(structuredResume, [overlapLeft, overlapRight])
check(overlapResult.text.includes('负责产品定位表达') && overlapResult.text.includes('负责需求与指标表达'), '共享原文区间只移除一次且 Rewrite 使用各自唯一锚点')
check(!overlapResult.text.includes('使用访谈记录梳理核心问题与流程说明') && !overlapResult.text.includes('形成上线复盘'), '共享原文区间不产生残片')

const dedupResume = `AI 简历助手
产品设计负责人
2025.11–2026.04
项目描述：设计以目标 JD 为中心的简历优化产品
 基于问卷、5 次深访及 3 款竞品分析识别求职痛点，定位 JD 驱动的定向优化工具；`
const dedupRewrite = { ...acceptedAi, originalText: '项目描述：设计以目标 JD 为中心的简历优化产品', optimizedText: '担任产品设计负责人，基于问卷、5 次深访与 3 款竞品分析识别求职痛点，将产品定位为 JD 驱动的定向优化工具。', validation: validation('rewrite-1', '担任产品设计负责人，基于问卷、5 次深访与 3 款竞品分析识别求职痛点，将产品定位为 JD 驱动的定向优化工具。') }
const dedupResult = buildFinalResume(dedupResume, [dedupRewrite])
check(dedupResult.text.includes('2025.11–2026.04'), '日期字段不会被识别成编号 bullet 或参与替换')
equal((dedupResult.text.match(/5 次深访/g) ?? []).length, 1, '被 Rewrite 高度覆盖的原始完整条目不重复保留')

const pageSource = readFileSync(new URL('../src/pages/ResultPage.tsx', import.meta.url), 'utf8')
check(!pageSource.includes('mockResume') && !pageSource.includes('mockTask') && !pageSource.includes('mockGaps') && !pageSource.includes('mockRequirements'), 'ResultPage 不读取 Mock 业务数据')
check(!pageSource.includes('演示公司') && !pageSource.includes('虚构'), '公司为空时不会显示演示或虚构数据')
check(pageSource.includes('ROUTES.OPTIMIZATION(taskId)') && !pageSource.includes('removeItem('), '返回 Optimization 不清除当前状态')
check(pageSource.includes("['未完成决策', rewriteStats.remainingCount") && !pageSource.includes("['仍需处理', rewriteStats.remainingCount"), '顶部统计使用未完成决策口径')
process.stdout.write(`${JSON.stringify({ ok: true, checks })}\n`)

import { ArrowLeft, CheckCircle2, Clipboard } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageTitle } from '../components/layout/PageTitle'
import { TaskLayout } from '../components/layout/TaskLayout'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { DEMO_TASK_ID, ROUTES } from '../constants/routes'
import { DIAGNOSIS_STATE_KEY, MATCHING_RESOLUTION_ACTIONS_KEY, OPTIMIZATION_SELECTION_KEY, OPTIMIZATION_STATE_KEY, TASK_INPUT_STATE_KEY } from '../constants/storage'
import { readSkippedRequirements, resolutionStorageKey } from '../services/matchingResolution'
import { buildDiagnosisStats, buildFinalResume, buildGapStats, buildResultStats } from '../services/resultState'
import { canEnterFinalResume, normalizeRewriteItems } from '../services/rewriteState'
import type { EvidenceMapping, Gap, ResumeDiagnosis, RewriteSuggestion, TaskInputState } from '../types/domain'
import { GAPS_STATE_KEY, MAPPINGS_STATE_KEY } from './MatchingPage'

export function ResultPage() {
  const navigate = useNavigate()
  const { taskId = DEMO_TASK_ID } = useParams()
  const [copied, setCopied] = useState(false)
  const task = read<TaskInputState | null>(TASK_INPUT_STATE_KEY, null)
  const selected = read<string[]>(OPTIMIZATION_SELECTION_KEY, [])
  const diagnoses = read<ResumeDiagnosis[]>(DIAGNOSIS_STATE_KEY, [])
  const selectedSet = new Set(selected)
  const rewrites = normalizeRewriteItems(read<RewriteSuggestion[]>(OPTIMIZATION_STATE_KEY, [])).filter((rewrite) => diagnosisIdsOf(rewrite).some((id) => selectedSet.has(id)))
  const mappings = read<EvidenceMapping[]>(MAPPINGS_STATE_KEY, [])
  const gaps = read<Gap[]>(GAPS_STATE_KEY, [])
  const skippedIds = readSkippedRequirements(sessionStorage, resolutionStorageKey(MATCHING_RESOLUTION_ACTIONS_KEY, taskId))
  const canEnter = canEnterFinalResume(rewrites)
  const finalResume = useMemo(() => {
    if (!task?.resumeText || !canEnter) return null
    try { return buildFinalResume(task.resumeText, rewrites) } catch { return null }
  }, [task?.resumeText, rewrites, canEnter])
  const rewriteStats = buildResultStats(rewrites)
  const diagnosisStats = buildDiagnosisStats(selected.filter((id) => diagnoses.some((diagnosis) => diagnosis.diagnosisId === id)), rewrites)
  const gapStats = buildGapStats(mappings, gaps, skippedIds)

  const copy = async () => {
    if (!finalResume) return
    await navigator.clipboard?.writeText(finalResume.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!task || !finalResume || !canEnter) {
    const message = !task?.resumeText ? '当前任务没有可用的真实简历文本。' : '仍有优化建议尚未完成用户决策或事实校验，请返回继续处理。'
    return <TaskLayout currentStep={6} maxCompletedStep={5} titleArea={<PageTitle eyebrow="优化结果 · 第 6 步" title="暂时无法生成优化结果" description={message} />} footer={<div className="page-footer-actions"><Button variant="secondary" onClick={() => navigate(ROUTES.OPTIMIZATION(taskId))}><ArrowLeft className="h-4 w-4" />返回继续修改</Button></div>}><Card><CardContent className="p-6 text-sm text-amber-900">{message}</CardContent></Card></TaskLayout>
  }

  const metrics = [
    ['优化建议', rewriteStats.suggestionCount, 'text-ink'],
    ['已采用', rewriteStats.adoptedCount, 'text-emerald-700'],
    ['保留原文', rewriteStats.retainedCount, 'text-slate-700'],
    ['未完成决策', rewriteStats.remainingCount, 'text-red-700'],
  ] as const

  return <TaskLayout currentStep={6} maxCompletedStep={5}
    titleArea={<PageTitle eyebrow="优化结果 · 第 6 步" title="本轮优化结果" description="查看最终采用的修改，以及仍需补充或提升的部分。" />}
    footer={<div className="page-footer-actions"><Button variant="secondary" onClick={() => navigate(ROUTES.OPTIMIZATION(taskId))}><ArrowLeft className="h-4 w-4" />返回继续修改</Button><Button onClick={copy}><Clipboard className="h-4 w-4" />{copied ? '已复制' : '复制优化内容'}</Button></div>}
  >
    {gapStats.factGapCount > 0 && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">仍有 {gapStats.factGapCount} 项事实缺口尚未确认，其中 {gapStats.skippedCount} 项已暂时跳过。本轮结果基于当前已确认事实生成；当前阻塞待处理 {gapStats.blockingFactGapCount} 项。</div>}
    <Card><CardContent className="p-5 sm:p-6"><div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-sm font-semibold text-brand-700">当前岗位</p><p className="mt-1 text-xl font-semibold tracking-tight text-ink">{task.jobTitle || '未填写岗位名称'}</p>{task.companyName.trim() && <p className="mt-1 text-sm text-slate-500">{task.companyName}</p>}</div><dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[620px]">{metrics.map(([label, value, tone]) => <div key={label} className="summary-metric"><dt className="summary-metric-label">{label}</dt><dd className={`summary-metric-value ${tone}`}>{value}</dd></div>)}</dl></div></CardContent></Card>

    <Card className="mt-5"><CardHeader><h2 className="section-title">最终简历内容</h2><p className="section-description">以下内容基于你的原始简历生成，仅替换已接受且事实校验通过的优化内容；已拒绝的内容保留原文。</p></CardHeader><CardContent className="space-y-6">{finalResume.sections.map((section, sectionIndex) => <section key={`${section.title}-${sectionIndex}`}>{section.title && <h3 className="text-base font-semibold text-ink">{section.title}</h3>}<div className={section.title ? 'mt-3 space-y-2.5' : 'space-y-2.5'}>{section.lines.map((line, lineIndex) => <p key={`${lineIndex}-${line.text}`} className={line.source !== 'original' ? 'rounded-lg border border-brand-100 bg-brand-50/40 px-4 py-3 text-sm leading-6 text-slate-800' : 'whitespace-pre-wrap px-1 text-sm leading-6 text-slate-700'}>{line.text}{line.source !== 'original' && <span className="ml-2 inline-flex rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">{line.source === 'manual' ? '手动优化' : 'AI 优化'}</span>}</p>)}</div></section>)}</CardContent></Card>

    <div className="mt-5 grid gap-5 lg:grid-cols-2"><Card><CardHeader><h2 className="section-title">本轮优化摘要</h2></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-slate-700"><p>本轮发现问题：<strong>{diagnosisStats.issueCount}</strong> 条</p><p>已通过采用优化覆盖：<strong>{diagnosisStats.resolvedCount}</strong> 条</p><p>选择保留原文：<strong>{diagnosisStats.retainedCount}</strong> 条</p><p>未完成决策：<strong>{diagnosisStats.uncoveredCount}</strong> 条</p></CardContent></Card><Card><CardHeader><h2 className="section-title">剩余问题</h2></CardHeader><CardContent className="space-y-3 text-sm leading-6"><div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-amber-900"><strong>事实缺口：</strong>{gapStats.factGapCount} 项待确认，其中 {gapStats.skippedCount} 项已暂时跳过，{gapStats.blockingFactGapCount} 项仍阻塞处理。</div><div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-red-900"><strong>能力程度不足：</strong>{gapStats.capabilityShortfallCount} 项，无法仅靠文案完全解决。</div><div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-red-900"><strong>能力缺失：</strong>{gapStats.capabilityMissingCount} 项，无法通过简历改写解决。</div></CardContent></Card></div>
    <div className="mt-5 flex items-start gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />最终采用的修改均已接受并通过事实校验；拒绝的建议保留原始简历内容。</div>
  </TaskLayout>
}

function read<T>(key: string, fallback: T): T { try { const value = sessionStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }
function diagnosisIdsOf(item: RewriteSuggestion) { return item.diagnosisIds?.length ? item.diagnosisIds : item.diagnosisId ? [item.diagnosisId] : [] }

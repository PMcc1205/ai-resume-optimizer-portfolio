import { ArrowLeft, ArrowRight, AlertTriangle, Filter, ListChecks } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DiagnosisCard } from '../components/diagnosis/DiagnosisCard'
import { PageTitle } from '../components/layout/PageTitle'
import { TaskLayout } from '../components/layout/TaskLayout'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { EmptyState } from '../components/ui/FeedbackStates'
import { DEMO_TASK_ID, ROUTES } from '../constants/routes'
import { DIAGNOSIS_INPUT_KEY, DIAGNOSIS_SOURCE_KEY, DIAGNOSIS_STATE_KEY, FACTS_SOURCE_KEY, MAPPINGS_INPUT_KEY, MAPPINGS_SOURCE_KEY, MATCH_GAP_SOURCE_KEY, MATCHING_OPTIMIZATION_REQUIREMENTS_KEY, MATCHING_RESOLUTION_ACTIONS_KEY, OPTIMIZATION_SELECTION_KEY, TASK_INPUT_STATE_KEY } from '../constants/storage'
import { analyzeDiagnoses, diagnosisSnapshot, type DiagnosisInput, DiagnosisError } from '../services/diagnosis'
import { createEvidenceMappingInputSnapshot } from '../services/matchingSupplement'
import { readSkippedRequirements, resolutionStorageKey, summarizeFactGapActions } from '../services/matchingResolution'
import type { EvidenceMapping, Fact, Gap, JobRequirement, ResumeDiagnosis, TaskInputState } from '../types/domain'
import { FACTS_STATE_KEY } from './FactConfirmationPage'
import { REQUIREMENTS_STATE_KEY } from './JobAnalysisPage'
import { GAPS_STATE_KEY, MAPPINGS_STATE_KEY } from './MatchingPage'

type PriorityFilter = '全部' | ResumeDiagnosis['priority']
const priorityFilters: PriorityFilter[] = ['全部', '高', '中', '低']

export function DiagnosisPage() {
  const navigate = useNavigate()
  const { taskId = DEMO_TASK_ID } = useParams()
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('全部')
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const saved = readSession<ResumeDiagnosis[]>(DIAGNOSIS_STATE_KEY)
    const selected = readSession<string[]>(OPTIMIZATION_SELECTION_KEY) ?? []
    return saved?.filter((item) => item.optimizable && selected.includes(item.diagnosisId)).map((item) => item.diagnosisId) ?? []
  })
  const [feedback, setFeedback] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const input = useMemo(() => readCurrentInput(taskId), [taskId])
  const snapshot = input ? diagnosisSnapshot(input) : ''
  const [diagnoses, setDiagnoses] = useState<ResumeDiagnosis[] | null>(() => readStoredDiagnoses(snapshot))
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'upstream'>(input ? diagnoses ? 'ready' : 'loading' : 'upstream')
  const [errorMessage, setErrorMessage] = useState('')
  const latestRequest = useRef(0)

  useEffect(() => {
    if (!input || diagnoses && state === 'ready' && readStoredDiagnoses(snapshot)) return
    const requestId = ++latestRequest.current
    setState('loading')
    setErrorMessage('')
    void analyzeDiagnoses(input).then((items) => {
      if (requestId !== latestRequest.current) return
      sessionStorage.setItem(DIAGNOSIS_STATE_KEY, JSON.stringify(items))
      sessionStorage.setItem(DIAGNOSIS_INPUT_KEY, snapshot)
      sessionStorage.setItem(DIAGNOSIS_SOURCE_KEY, 'real-ai')
      const selectedRequirements = new Set(readSession<string[]>(MATCHING_OPTIMIZATION_REQUIREMENTS_KEY) ?? [])
      const nextSelection = items.filter((item) => item.optimizable && selectedRequirements.has(item.primaryRequirementId)).map((item) => item.diagnosisId)
      sessionStorage.setItem(OPTIMIZATION_SELECTION_KEY, JSON.stringify(nextSelection))
      setSelectedIds(nextSelection)
      setDiagnoses(items)
      setState('ready')
    }).catch((error: unknown) => {
      if (requestId !== latestRequest.current) return
      setErrorMessage(error instanceof DiagnosisError ? error.message : 'Diagnosis 生成失败，请重试。')
      setState('error')
    })
    return () => { latestRequest.current += 1 }
  // Retry is explicit; upstream changes produce a new snapshot when the page is opened again.
  }, [input, snapshot, requestVersion])

  const activeDiagnoses = state === 'ready' ? diagnoses ?? [] : []
  const optimizableIds = useMemo(() => new Set(activeDiagnoses.filter((item) => item.optimizable === true).map((item) => item.diagnosisId)), [activeDiagnoses])
  const summary = {
    total: activeDiagnoses.length,
    high: activeDiagnoses.filter((item) => item.priority === '高').length,
    medium: activeDiagnoses.filter((item) => item.priority === '中').length,
    low: activeDiagnoses.filter((item) => item.priority === '低').length,
  }
  const visibleDiagnoses = activeDiagnoses.filter((item) => priorityFilter === '全部' || item.priority === priorityFilter)
  const factGapActions = input ? summarizeFactGapActions(input.mappings, input.gaps, input.skippedIds) : null
  const highOptimizableIds = activeDiagnoses.filter((item) => item.priority === '高' && optimizableIds.has(item.diagnosisId)).map((item) => item.diagnosisId)
  const allHighSelected = highOptimizableIds.length > 0 && highOptimizableIds.every((id) => selectedIds.includes(id))

  const toggleSelection = (diagnosisId: string) => {
    if (!optimizableIds.has(diagnosisId)) return
    const next = selectedIds.includes(diagnosisId) ? selectedIds.filter((id) => id !== diagnosisId) : [...selectedIds, diagnosisId]
    setSelectedIds(next)
    sessionStorage.setItem(OPTIMIZATION_SELECTION_KEY, JSON.stringify(next))
    setFeedback(next.includes(diagnosisId) ? `${diagnosisId.toUpperCase()} 已加入优化列表。` : `${diagnosisId.toUpperCase()} 已移出优化列表。`)
  }

  const toggleAllHighPriority = () => {
    const next = allHighSelected ? selectedIds.filter((id) => !highOptimizableIds.includes(id)) : Array.from(new Set([...selectedIds, ...highOptimizableIds]))
    setSelectedIds(next)
    sessionStorage.setItem(OPTIMIZATION_SELECTION_KEY, JSON.stringify(next))
  }

  return (
    <TaskLayout currentStep={4} maxCompletedStep={3}
      titleArea={<PageTitle eyebrow="问题诊断 · 第 4 步" title="简历问题诊断" description="我的简历具体哪里有问题？应该先改什么？" />}
      footer={<div className="page-footer-actions">
        <Button variant="secondary" onClick={() => navigate(ROUTES.MATCHING(taskId))}><ArrowLeft className="h-4 w-4" />上一步</Button>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <p className="text-center text-sm text-slate-600 sm:text-right">已选择 {selectedIds.filter((id) => optimizableIds.has(id)).length} 条可优化问题</p>
          <Button disabled={state !== 'ready' || selectedIds.filter((id) => optimizableIds.has(id)).length === 0} onClick={() => navigate(ROUTES.OPTIMIZATION(taskId))}>开始逐条优化 <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </div>}
    >
      {factGapActions && factGapActions.factGapCount > 0 && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">部分事实缺口尚未确认，分析结果可能不完整（{factGapActions.factGapCount} 项待确认，其中 {factGapActions.skippedCount} 项已暂时跳过）。</div>}
      {state === 'upstream' && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">当前匹配结果尚未完成，请返回岗位匹配页完成分析。</div>}
      {state === 'loading' && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" role="status">正在基于真实岗位要求、事实与缺口生成问题诊断…</div>}
      {state === 'error' && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{errorMessage}</span><Button variant="secondary" onClick={() => setRequestVersion((current) => current + 1)}>重试诊断</Button></div>}
      {state === 'ready' && <>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="诊断统计">
          <Metric label="问题总数" value={summary.total} /><Metric label="高优先级" value={summary.high} /><Metric label="中优先级" value={summary.medium} /><Metric label="低优先级" value={summary.low} />
        </div>
        <Card className="mt-5"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Filter className="h-4 w-4" />筛选诊断</div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="修改优先级筛选">{priorityFilters.map((priority) => <button type="button" key={priority} aria-pressed={priorityFilter === priority} onClick={() => setPriorityFilter(priority)} className={priorityFilter === priority ? 'filter-chip filter-chip-active' : 'filter-chip'}>{priority}</button>)}</div>
          <Button variant="secondary" disabled={!highOptimizableIds.length} onClick={toggleAllHighPriority}><ListChecks className="h-4 w-4" />{allHighSelected ? '移出全部高优先级' : '选择全部高优先级可优化问题'}</Button>
        </CardContent></Card>
        {feedback && <p className="mt-4 text-sm text-emerald-800" role="status">{feedback}</p>}
        <div className="mt-6 space-y-5">{visibleDiagnoses.map((diagnosis) => {
          const requirement = input?.requirements.find((item) => item.requirementId === diagnosis.primaryRequirementId)
          const mapping = input?.mappings.find((item) => item.mappingId === diagnosis.mappingId)
          const gap = input?.gaps.find((item) => item.gapId === diagnosis.gapId)
          if (!requirement || !mapping || !gap) return null
          const facts = diagnosis.factIds.map((id) => input?.facts.find((fact) => fact.factId === id)).filter((fact): fact is Fact => Boolean(fact))
          return <DiagnosisCard key={diagnosis.diagnosisId} diagnosis={diagnosis} requirement={requirement} linkedRequirements={[requirement]} mapping={mapping} gap={gap} facts={facts} selected={selectedIds.includes(diagnosis.diagnosisId)} onToggleSelection={toggleSelection} onViewFacts={() => navigate(ROUTES.MATCHING(taskId))} />
        })}</div>
        {visibleDiagnoses.length === 0 && <EmptyState title={activeDiagnoses.length ? '没有符合筛选条件的问题' : '当前没有需要修改的问题'} description={activeDiagnoses.length ? '调整优先级筛选查看其他诊断。' : '当前真实证据与简历表达无需额外诊断。'} />}
      </>}
    </TaskLayout>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="summary-metric"><dt className="summary-metric-label">{label}</dt><dd className="summary-metric-value text-ink">{value}</dd></div>
}

function readSession<T>(key: string): T | null {
  try { const saved = sessionStorage.getItem(key); return saved ? JSON.parse(saved) as T : null }
  catch { return null }
}

function readCurrentInput(taskId: string): DiagnosisInput | null {
  if (sessionStorage.getItem(FACTS_SOURCE_KEY) !== 'real-ai' || sessionStorage.getItem(MAPPINGS_SOURCE_KEY) !== 'real-ai' || sessionStorage.getItem(MATCH_GAP_SOURCE_KEY) !== 'rules-v1') return null
  const requirements = readSession<JobRequirement[]>(REQUIREMENTS_STATE_KEY)
  const facts = readSession<Fact[]>(FACTS_STATE_KEY)
  const mappings = readSession<EvidenceMapping[]>(MAPPINGS_STATE_KEY)
  const gaps = readSession<Gap[]>(GAPS_STATE_KEY)
  const task = readSession<TaskInputState>(TASK_INPUT_STATE_KEY)
  if (!requirements?.length || !facts || !mappings || !gaps || !task || mappings.length !== requirements.length || gaps.length !== requirements.length) return null
  if (sessionStorage.getItem(MAPPINGS_INPUT_KEY) !== createEvidenceMappingInputSnapshot(requirements, facts)) return null
  const skippedIds = readSkippedRequirements(sessionStorage, resolutionStorageKey(MATCHING_RESOLUTION_ACTIONS_KEY, taskId))
  return { requirements, facts, mappings, gaps, skippedIds, resumeText: task.resumeText }
}

function readStoredDiagnoses(snapshot: string): ResumeDiagnosis[] | null {
  if (!snapshot || sessionStorage.getItem(DIAGNOSIS_SOURCE_KEY) !== 'real-ai' || sessionStorage.getItem(DIAGNOSIS_INPUT_KEY) !== snapshot) return null
  const saved = readSession<ResumeDiagnosis[]>(DIAGNOSIS_STATE_KEY)
  return Array.isArray(saved) ? saved : null
}

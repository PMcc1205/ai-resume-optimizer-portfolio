import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Filter,
  GitMerge,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AddExperienceModal, type ExperienceSupplement } from '../components/matching/AddExperienceModal'
import { MatchingRequirementCard } from '../components/matching/MatchingRequirementCard'
import { PageTitle } from '../components/layout/PageTitle'
import { TaskLayout } from '../components/layout/TaskLayout'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { EmptyState } from '../components/ui/FeedbackStates'
import { DEMO_TASK_ID, ROUTES } from '../constants/routes'
import { MATCH_GAP_INPUT_KEY, MATCH_GAP_SOURCE_KEY, MAPPINGS_INPUT_KEY, MAPPINGS_SOURCE_KEY, MATCHING_OPTIMIZATION_REQUIREMENTS_KEY, MATCHING_RESOLUTION_ACTIONS_KEY, OPTIMIZATION_SELECTION_KEY, TASK_INPUT_STATE_KEY } from '../constants/storage'
import { mockFacts, mockRequirements } from '../mocks/resumeOptimization'
import { analyzeEvidenceMappings, EvidenceMappingError } from '../services/evidenceMapping'
import { calculateMatchAndGaps, createMatchGapSnapshot } from '../services/matchGap'
import { createEvidenceMappingInputSnapshot, createSupplementalFact, isLatestMappingRequest } from '../services/matchingSupplement'
import { readSkippedRequirements, resolutionStorageKey, summarizeFactGapActions, updateSkippedRequirements } from '../services/matchingResolution'
import type { EvidenceMapping, Fact, Gap, JobRequirement, TaskInputState } from '../types/domain'
import { REQUIREMENTS_STATE_KEY } from './JobAnalysisPage'
import { FACTS_STATE_KEY } from './FactConfirmationPage'

export const MAPPINGS_STATE_KEY = 'resume-mappings-state'
export const GAPS_STATE_KEY = 'resume-gaps-state'
type StatusFilter = '全部' | EvidenceMapping['matchStatus']
type ImportanceFilter = '全部' | JobRequirement['importance']

const statusFilters: StatusFilter[] = ['全部', '满足', '部分满足', '未满足', '待确认']
const importanceFilters: ImportanceFilter[] = ['全部', '核心要求', '一般要求', '加分项']

type CompletedAnalysis = {
  requirements: JobRequirement[]
  facts: Fact[]
  mappings: EvidenceMapping[]
  gaps: Gap[]
  inputSnapshot: string
}

export function MatchingPage() {
  const navigate = useNavigate()
  const { taskId = DEMO_TASK_ID } = useParams()
  const taskInput = useMemo(readTaskInput, [])
  const [facts, setFacts] = useState<Fact[]>(() => { try { const s = sessionStorage.getItem(FACTS_STATE_KEY); return s ? JSON.parse(s) as Fact[] : mockFacts.map((f) => ({ ...f, numericDetail: f.numericDetail ? { ...f.numericDetail } : undefined })) } catch { return mockFacts.map((f) => ({ ...f, numericDetail: f.numericDetail ? { ...f.numericDetail } : undefined })) } })
  const requirements = useMemo<JobRequirement[]>(() => { try { const s = sessionStorage.getItem(REQUIREMENTS_STATE_KEY); return s ? JSON.parse(s) as JobRequirement[] : mockRequirements } catch { return mockRequirements } }, [])
  const mappingInputSnapshot = useMemo(() => createEvidenceMappingInputSnapshot(requirements, facts), [facts, requirements])
  const [analysis, setAnalysis] = useState<CompletedAnalysis | null>(() => readStoredCompletedAnalysis(requirements, facts))
  const [mappingState, setMappingState] = useState<'loading' | 'ready' | 'error'>(() => analysis?.inputSnapshot === mappingInputSnapshot ? 'ready' : 'loading')
  const [mappingError, setMappingError] = useState('')
  const mappingRequestId = useRef(0)
  const requestedSnapshot = useRef(analysis?.inputSnapshot === mappingInputSnapshot ? mappingInputSnapshot : '')
  useEffect(() => { sessionStorage.setItem(FACTS_STATE_KEY, JSON.stringify(facts)) }, [facts])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('全部')
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>('全部')
  const [supplementingRequirement, setSupplementingRequirement] = useState<JobRequirement | null>(null)
  const [optimizationIds, setOptimizationIds] = useState<string[]>(() => { try { const saved = sessionStorage.getItem(MATCHING_OPTIMIZATION_REQUIREMENTS_KEY); return saved ? JSON.parse(saved) as string[] : [] } catch { return [] } })
  const [feedback, setFeedback] = useState('')
  const resolutionKey = resolutionStorageKey(MATCHING_RESOLUTION_ACTIONS_KEY, taskId)
  const [skippedIds, setSkippedIds] = useState<string[]>(() => readSkippedRequirements(sessionStorage, resolutionKey))
  const experiences = useMemo(() => Array.from(new Map(
    facts.filter((fact) => fact.status !== '已删除').map((fact) => [fact.experienceId, { experienceId: fact.experienceId, experienceName: fact.experienceName }]),
  ).values()), [facts])
  const evaluatedMappings = analysis?.mappings ?? []
  const gaps = analysis?.gaps ?? []
  const displayRequirements = analysis?.requirements ?? requirements
  const displayFacts = analysis?.facts ?? []

  const commitCompletedAnalysis = useCallback((sourceMappings: EvidenceMapping[], inputRequirements: JobRequirement[], inputFacts: Fact[], inputSnapshot: string) => {
    const completed = calculateMatchAndGaps(inputRequirements, inputFacts, sourceMappings)
    const nextAnalysis: CompletedAnalysis = {
      requirements: inputRequirements,
      facts: inputFacts,
      mappings: completed.mappings,
      gaps: completed.gaps,
      inputSnapshot,
    }
    sessionStorage.setItem(MAPPINGS_STATE_KEY, JSON.stringify(completed.mappings))
    sessionStorage.setItem(GAPS_STATE_KEY, JSON.stringify(completed.gaps))
    sessionStorage.setItem(MAPPINGS_SOURCE_KEY, 'real-ai')
    sessionStorage.setItem(MAPPINGS_INPUT_KEY, inputSnapshot)
    sessionStorage.setItem(MATCH_GAP_SOURCE_KEY, 'rules-v1')
    sessionStorage.setItem(MATCH_GAP_INPUT_KEY, createMatchGapSnapshot(inputRequirements, inputFacts, sourceMappings))
    setAnalysis(nextAnalysis)
  }, [])

  const extractMappings = useCallback(async (inputFacts: Fact[] = facts) => {
    const requestId = mappingRequestId.current + 1
    mappingRequestId.current = requestId
    const inputSnapshot = createEvidenceMappingInputSnapshot(requirements, inputFacts)
    requestedSnapshot.current = inputSnapshot
    setMappingState('loading')
    setMappingError('')
    try {
      const result = await analyzeEvidenceMappings(requirements, inputFacts)
      if (!isLatestMappingRequest(requestId, mappingRequestId.current)) return
      commitCompletedAnalysis(result, requirements, inputFacts, inputSnapshot)
      setMappingState('ready')
    } catch (error) {
      if (!isLatestMappingRequest(requestId, mappingRequestId.current)) return
      setMappingError(error instanceof EvidenceMappingError ? error.message : 'Evidence Mapping 生成失败，请稍后重试。')
      setMappingState('error')
    }
  }, [commitCompletedAnalysis, facts, requirements])

  useEffect(() => {
    if (analysis?.inputSnapshot === mappingInputSnapshot || requestedSnapshot.current === mappingInputSnapshot) return
    void extractMappings(facts)
  }, [analysis?.inputSnapshot, extractMappings, facts, mappingInputSnapshot])

  const activeMappings = useMemo(() => evaluatedMappings.filter((mapping) => displayRequirements.some((requirement) => requirement.requirementId === mapping.requirementId)), [displayRequirements, evaluatedMappings])

  const summary = useMemo(() => ({
    core: displayRequirements.filter((requirement) => requirement.importance === '核心要求').length,
    met: analysis ? activeMappings.filter((mapping) => mapping.matchStatus === '满足').length : null,
    partiallyMet: analysis ? activeMappings.filter((mapping) => mapping.matchStatus === '部分满足').length : null,
    notMet: analysis ? activeMappings.filter((mapping) => mapping.matchStatus === '未满足').length : null,
    pending: analysis ? activeMappings.filter((mapping) => mapping.matchStatus === '待确认').length : null,
  }), [activeMappings, analysis, displayRequirements])

  const factGapActions = useMemo(() => summarizeFactGapActions(activeMappings, gaps, skippedIds), [activeMappings, gaps, skippedIds])

  const visibleRequirements = useMemo(() => displayRequirements.filter((requirement) => {
    const mapping = evaluatedMappings.find((item) => item.requirementId === requirement.requirementId)
    if (!mapping) return false
    const matchesStatus = statusFilter === '全部' || mapping.matchStatus === statusFilter
    const matchesImportance = importanceFilter === '全部' || requirement.importance === importanceFilter
    return matchesStatus && matchesImportance
  }), [displayRequirements, evaluatedMappings, importanceFilter, statusFilter])

  const isCurrentAnalysis = analysis?.inputSnapshot === mappingInputSnapshot && mappingState === 'ready'
  const isUpdating = mappingState === 'loading'
  const controlsDisabled = !isCurrentAnalysis

  const setSkipped = (requirementId: string, skipped: boolean) => {
    setSkippedIds((current) => updateSkippedRequirements(sessionStorage, resolutionKey, current, requirementId, skipped))
  }

  const submitExperience = (supplement: ExperienceSupplement) => {
    if (!supplementingRequirement) return
    const experience = experiences.find((item) => item.experienceId === supplement.experienceId)
    if (!experience) return
    const newFact = createSupplementalFact({ facts, requirement: supplementingRequirement, experience, supplement })
    const nextFacts = [...facts, newFact]
    setSkipped(supplementingRequirement.requirementId, false)
    sessionStorage.setItem(FACTS_STATE_KEY, JSON.stringify(nextFacts))
    setFacts(nextFacts)
    setFeedback(`已保存 ${newFact.factId.toUpperCase()}，正在基于新 Fact 重新生成 Mapping、匹配状态与缺口。`)
    setSupplementingRequirement(null)
    void extractMappings(nextFacts)
  }

  const markAbsent = (requirement: JobRequirement) => {
    setSkipped(requirement.requirementId, false)
    const nextIndex = facts.reduce((highest, fact) => {
      const match = /^fact-supplement-(\d+)$/.exec(fact.factId)
      return match ? Math.max(highest, Number(match[1])) : highest
    }, 0) + 1
    const newFactId = `fact-supplement-${String(nextIndex).padStart(3, '0')}`
    const absentFact: Fact = {
      factId: newFactId,
      experienceId: 'user-confirmation',
      experienceName: '用户补充确认',
      content: `未有能够证明“${requirement.capability}”的真实经历。`,
      type: '行动事实',
      sourceText: '用户在岗位匹配页选择“我没有相关经历”。',
      sourceLocation: `岗位匹配页 · 用户确认 · ${requirement.requirementId}`,
      riskLevel: '低',
      riskReason: '由具体岗位要求按需触发，不扩展为其他否定事实。',
      reviewReason: null,
      requiresConfirmation: false,
      confidence: 1,
      status: '明确不存在',
    }
    const nextFacts = [...facts, absentFact]
    sessionStorage.setItem(FACTS_STATE_KEY, JSON.stringify(nextFacts))
    setFacts(nextFacts)
    setFeedback(`已记录“明确不存在”，正在重新生成 ${requirement.requirementId.toUpperCase()} 的匹配状态与缺口。`)
    void extractMappings(nextFacts)
  }

  const removeMapping = (requirementId: string, factId: string) => {
    if (!analysis) return
    const targetFact = displayFacts.find((fact) => fact.factId === factId)
    const targetMapping = analysis.mappings.find((mapping) => mapping.requirementId === requirementId)
    const remainingFactIds = targetMapping?.factIds.filter((id) => id !== factId) ?? []
    const nextMappings = analysis.mappings.map((mapping) => {
      if (mapping.requirementId !== requirementId) return mapping
      return {
        ...mapping,
        factIds: remainingFactIds,
        ...(remainingFactIds.length === 0 ? {
          relevance: '无相关' as const,
          evidenceStrength: '无有效证据' as const,
          evidenceLevel: 'L1 了解' as const,
          matchStatus: '待确认' as const,
          reason: '用户已移除当前证据映射，暂时没有足够事实证明该岗位要求。',
          confidence: 1,
        } : {
          evidenceStrength: '弱证据' as const,
          reason: '用户已移除一条不适用的证据，其余真实事实仍保留在当前映射中。',
        }),
      }
    })
    commitCompletedAnalysis(nextMappings, analysis.requirements, analysis.facts, analysis.inputSnapshot)
    setFeedback(`已移除 ${targetFact?.factId.toUpperCase() ?? '该事实'} 与 ${requirementId.toUpperCase()} 的映射关系；原 Fact 仍保留。`)
  }

  const skipRequirement = (requirement: JobRequirement) => {
    setSkipped(requirement.requirementId, true)
    setFeedback(`${requirement.requirementId.toUpperCase()} 已暂时跳过；仍为“待确认 + 事实缺口”，可随时重新处理。`)
  }

  const reopenRequirement = (requirement: JobRequirement) => {
    setSkipped(requirement.requirementId, false)
    setFeedback(`${requirement.requirementId.toUpperCase()} 已恢复处理。`)
  }

  const addToOptimization = (requirementId: string) => {
    setOptimizationIds((current) => {
      const next = current.includes(requirementId) ? current : [...current, requirementId]
      sessionStorage.setItem(MATCHING_OPTIMIZATION_REQUIREMENTS_KEY, JSON.stringify(next))
      return next
    })
    setFeedback(`${requirementId.toUpperCase()} 已加入优化列表。`)
  }

  return (
    <TaskLayout
      currentStep={3}
      maxCompletedStep={2}
      titleArea={
        <PageTitle
          eyebrow="证据匹配 · 第 3 步"
          title="岗位匹配分析"
          description="这个岗位的每一项要求，我目前满足到什么程度？依据是什么？"
        />
      }
      footer={
        <div className="page-footer-actions">
          <Button variant="secondary" onClick={() => navigate(ROUTES.FACT_CONFIRMATION(taskId))}><ArrowLeft className="h-4 w-4" />上一步</Button>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {analysis && factGapActions.factGapCount > 0 && <p className="text-center text-sm font-medium text-amber-700 sm:text-right">{summary.pending} 项待确认中，{factGapActions.skippedCount} 项已暂时跳过，仍需处理 {factGapActions.blockingCount} 项事实缺口；后续结果可能不完整。</p>}
            <Button disabled={controlsDisabled || factGapActions.blockingCount > 0} onClick={() => navigate(ROUTES.DIAGNOSIS(taskId))}>查看简历问题 <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      }
    >
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-600">当前优化任务</p>
              <p className="mt-1 truncate text-xl font-semibold text-ink">{taskInput?.jobTitle || '未提供岗位名称'}</p>
              <p className="mt-1 truncate text-sm text-slate-500">{taskInput?.companyName || '未填写公司名称'}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5 xl:min-w-[720px]">
              <SummaryItem label="核心要求" value={summary.core} tone="slate" />
              <SummaryItem label="满足" value={summary.met} tone="green" />
              <SummaryItem label="部分满足" value={summary.partiallyMet} tone="amber" />
              <SummaryItem label="未满足" value={summary.notMet} tone="red" />
              <SummaryItem label="待确认" value={summary.pending} tone="orange" />
            </dl>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-800">
        <GitMerge className="mt-0.5 h-4 w-4 shrink-0" />
        <p><span className="font-semibold">判断路径：</span>岗位要求 → 真实事实 → 证据映射 → 匹配状态 → 缺口类型。关键词只用于发现候选事实，不直接决定匹配结果。</p>
      </div>

      {mappingState === 'loading' && (
        <Card className="mt-5"><CardContent className="p-5 text-sm font-medium text-slate-600">{analysis ? '匹配结果更新中，当前展示上一次分析结果。' : '正在根据岗位要求和真实经历生成证据映射与匹配结果……'}</CardContent></Card>
      )}
      {mappingState === 'error' && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{analysis ? `匹配结果更新失败，上一次分析结果已保留，请重试。${mappingError ? ` ${mappingError}` : ''}` : mappingError}</span>
          <Button variant="secondary" onClick={() => void extractMappings()}>重新生成 Mapping</Button>
        </div>
      )}

      {feedback && (
        <div className="inline-feedback mt-5 border-emerald-200 bg-emerald-50 text-emerald-800" role="status" aria-live="polite">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="shrink-0 font-semibold hover:text-emerald-950">知道了</button>
        </div>
      )}

      {analysis && <Card className="mt-5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Filter className="h-4 w-4" />筛选匹配结果</div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex flex-wrap gap-2" role="group" aria-label="匹配状态筛选">
                {statusFilters.map((status) => (
                  <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} className={statusFilter === status ? 'filter-chip filter-chip-active' : 'filter-chip'}>{status}</button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                重要程度
                <select aria-label="重要程度筛选" value={importanceFilter} onChange={(event) => setImportanceFilter(event.target.value as ImportanceFilter)} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
                  {importanceFilters.map((importance) => <option key={importance} value={importance}>{importance}</option>)}
                </select>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>}

      <div className={`mt-6 space-y-5 transition-opacity ${isUpdating && analysis ? 'opacity-60' : ''}`} aria-live="polite" aria-busy={isUpdating}>
        {analysis && visibleRequirements.map((requirement) => {
          const mapping = evaluatedMappings.find((item) => item.requirementId === requirement.requirementId)
          const gap = gaps.find((item) => item.requirementId === requirement.requirementId)
          if (!mapping || !gap) return null
          const evidenceFacts = mapping.factIds.map((factId) => displayFacts.find((fact) => fact.factId === factId)).filter((fact): fact is Fact => Boolean(fact))
          return (
            <MatchingRequirementCard
              key={requirement.requirementId}
              requirement={requirement}
              mapping={mapping}
              gap={gap}
              facts={evidenceFacts}
              skipped={skippedIds.includes(requirement.requirementId) && mapping.matchStatus === '待确认' && gap.gapType === '事实缺口'}
              disabled={controlsDisabled}
              inOptimizationList={optimizationIds.includes(requirement.requirementId)}
              onAddExperience={setSupplementingRequirement}
              onMarkAbsent={markAbsent}
              onSkip={skipRequirement}
              onReopen={reopenRequirement}
              onAddToOptimization={addToOptimization}
              onRemoveMapping={removeMapping}
            />
          )
        })}
        {analysis && visibleRequirements.length === 0 && <EmptyState title="没有符合筛选条件的岗位要求" description="可以调整匹配状态或重要程度筛选查看其他结果。" />}
      </div>

      <AddExperienceModal requirement={supplementingRequirement} experiences={experiences} onClose={() => setSupplementingRequirement(null)} onSubmit={submitExperience} />
    </TaskLayout>
  )
}

function SummaryItem({ label, value, tone }: { label: string; value: number | null; tone: 'slate' | 'green' | 'amber' | 'red' | 'orange' }) {
  const valueTone = {
    slate: 'text-ink',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    orange: 'text-orange-700',
  }[tone]
  return <div className="summary-metric"><dt className="summary-metric-label">{label}</dt><dd className={`summary-metric-value ${valueTone}`}>{value ?? '—'}</dd></div>
}

function readStoredCompletedAnalysis(fallbackRequirements: JobRequirement[], fallbackFacts: Fact[]): CompletedAnalysis | null {
  if (sessionStorage.getItem(MAPPINGS_SOURCE_KEY) !== 'real-ai') return null
  if (sessionStorage.getItem(MATCH_GAP_SOURCE_KEY) !== 'rules-v1') return null
  try {
    const savedMappings = sessionStorage.getItem(MAPPINGS_STATE_KEY)
    const savedGaps = sessionStorage.getItem(GAPS_STATE_KEY)
    const inputSnapshot = sessionStorage.getItem(MAPPINGS_INPUT_KEY)
    if (!savedMappings || !savedGaps || !inputSnapshot) return null
    const mappings = JSON.parse(savedMappings) as EvidenceMapping[]
    const gaps = JSON.parse(savedGaps) as Gap[]
    const input = JSON.parse(inputSnapshot) as { requirements?: JobRequirement[]; facts?: Fact[] }
    const storedRequirements = Array.isArray(input.requirements) ? input.requirements : fallbackRequirements
    const storedFacts = Array.isArray(input.facts) ? input.facts : fallbackFacts
    if (mappings.length !== storedRequirements.length || gaps.length !== storedRequirements.length) return null
    return { requirements: storedRequirements, facts: storedFacts, mappings, gaps, inputSnapshot }
  } catch { return null }
}

function readTaskInput() {
  try {
    const saved = sessionStorage.getItem(TASK_INPUT_STATE_KEY)
    return saved ? JSON.parse(saved) as TaskInputState : null
  } catch { return null }
}

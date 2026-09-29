import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleSlash2,
  FileQuestion,
  Info,
  LockKeyhole,
  LoaderCircle,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FactCard } from '../components/fact-confirmation/FactCard'
import { FactEditModal } from '../components/fact-confirmation/FactEditModal'
import { PageTitle } from '../components/layout/PageTitle'
import { TaskLayout } from '../components/layout/TaskLayout'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { Card, CardContent } from '../components/ui/Card'
import { EmptyState } from '../components/ui/FeedbackStates'
import { Modal } from '../components/ui/Modal'
import { DEMO_TASK_ID, ROUTES } from '../constants/routes'
import { FACTS_SOURCE_KEY, TASK_INPUT_STATE_KEY } from '../constants/storage'
import { analyzeResumeFacts, ResumeFactAnalysisError } from '../services/resumeFactAnalysis'
import type { Fact, TaskInputState } from '../types/domain'

export const FACTS_STATE_KEY = 'resume-facts-state'

export function FactConfirmationPage() {
  const navigate = useNavigate()
  const { taskId = DEMO_TASK_ID } = useParams()
  const taskInput = useMemo(readTaskInput, [])
  const storedFacts = useMemo(readStoredFacts, [])
  const [facts, setFacts] = useState<Fact[]>(storedFacts ?? [])
  const [analysisState, setAnalysisState] = useState<'loading' | 'ready' | 'error'>(storedFacts ? 'ready' : 'loading')
  const [analysisError, setAnalysisError] = useState('')
  const requested = useRef(false)
  useEffect(() => {
    if (analysisState === 'ready') sessionStorage.setItem(FACTS_STATE_KEY, JSON.stringify(facts))
  }, [analysisState, facts])
  const [editingFact, setEditingFact] = useState<Fact | null>(null)
  const [deletingFact, setDeletingFact] = useState<Fact | null>(null)
  const [feedback, setFeedback] = useState('')

  const extractFacts = useCallback(async () => {
    const resumeText = taskInput?.resumeText.trim() || ''
    if (!resumeText) {
      setAnalysisError('当前任务没有可用的简历文本。请返回首页粘贴简历文本后重试；本阶段暂不解析 PDF。')
      setAnalysisState('error')
      return
    }
    setAnalysisState('loading')
    setAnalysisError('')
    try {
      const result = await analyzeResumeFacts(resumeText)
      setFacts(result)
      sessionStorage.setItem(FACTS_STATE_KEY, JSON.stringify(result))
      sessionStorage.setItem(FACTS_SOURCE_KEY, 'real-ai')
      setAnalysisState('ready')
    } catch (error) {
      setAnalysisError(error instanceof ResumeFactAnalysisError ? error.message : '简历事实提取失败，请稍后重试。')
      setAnalysisState('error')
    }
  }, [taskInput])

  useEffect(() => {
    if (storedFacts || requested.current) return
    requested.current = true
    void extractFacts()
  }, [extractFacts, storedFacts])

  const sections = useMemo(() => ({
    pending: facts.filter((fact) => fact.status === '待确认' && fact.requiresConfirmation),
    recognized: facts.filter((fact) => fact.status === '已确认'),
    insufficient: facts.filter((fact) => fact.status === '信息不足'),
    excluded: facts.filter((fact) => fact.status === '明确不存在' || fact.status === '已删除'),
  }), [facts])

  const blockingFacts = sections.pending.filter((fact) => fact.riskLevel === '高' || fact.reviewReason === '冲突事实')
  const canContinue = sections.pending.length === 0

  const confirmFact = (factId: string) => {
    const target = facts.find((fact) => fact.factId === factId)
    if (!target) return
    setFacts((current) => current.map((fact) => fact.factId === factId ? { ...fact, status: '已确认', requiresConfirmation: false } : fact))
    setFeedback(`已确认 ${target.factId.toUpperCase()}，该事实可以进入岗位匹配。`)
  }

  const saveFact = (updated: Fact) => {
    setFacts((current) => current.some((fact) => fact.factId === updated.factId)
      ? current.map((fact) => fact.factId === updated.factId ? updated : fact)
      : [...current, updated])
    setEditingFact(null)
    setFeedback(`已修改并确认 ${updated.factId.toUpperCase()}，后续将使用当前内容。`)
  }

  const deleteFact = () => {
    if (!deletingFact) return
    const factId = deletingFact.factId
    setFacts((current) => current.map((fact) => fact.factId === factId ? { ...fact, status: '已删除', requiresConfirmation: false } : fact))
    setDeletingFact(null)
    setFeedback(`已删除 ${factId.toUpperCase()}，该事实不会用于后续匹配。`)
  }

  const continueToMatching = () => {
    if (!canContinue) {
      setFeedback('仍有需要确认的必要事实，请先处理。')
      return
    }
    navigate(ROUTES.MATCHING(taskId))
  }

  const addFact = () => {
    const firstExperience = facts.find((fact) => fact.status !== '已删除')
    setEditingFact({
      factId: `fact-user-${Date.now()}`,
      experienceId: firstExperience?.experienceId || 'exp-user-001',
      experienceName: firstExperience?.experienceName || '用户补充经历',
      content: '',
      type: '行动事实',
      sourceText: '',
      sourceLocation: '用户补充',
      riskLevel: '中',
      riskReason: '用户主动补充，需要本人确认',
      reviewReason: null,
      requiresConfirmation: false,
      confidence: 1,
      status: '待确认',
    })
  }

  return (
    <TaskLayout
      currentStep={2}
      maxCompletedStep={1}
      titleArea={
        <PageTitle
          eyebrow="事实边界 · 第 2 步"
          title="关键事实确认"
          description="只重点确认可能影响真实性的关键信息；原文明确、低风险的事实会自动保留，你仍可随时修改。"
          actions={<Button variant="secondary" disabled={analysisState !== 'ready'} onClick={addFact}><Plus className="h-4 w-4" />补充真实事实</Button>}
        />
      }
      aside={<FactBoundaryAside pendingCount={sections.pending.length} blockingCount={blockingFacts.length} />}
      footer={
        <div className="page-footer-actions">
          <Button variant="secondary" onClick={() => navigate(ROUTES.JOB_ANALYSIS(taskId))}><ArrowLeft className="h-4 w-4" />上一步</Button>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {!canContinue && (
              <p className="text-center text-sm font-medium text-red-700 sm:text-right" role="alert">
                {blockingFacts.length > 0
                  ? `还有 ${blockingFacts.length} 项阻塞性关键事实需要处理（共 ${sections.pending.length} 项待确认）`
                  : `仍有 ${sections.pending.length} 项事实需要确认`}
              </p>
            )}
            <Button disabled={!canContinue} onClick={continueToMatching} title={!canContinue ? '请先处理必要事实确认' : undefined}>
              确认并开始岗位匹配 <ArrowRight className="h-4 w-4" />
            </Button>
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
            <dl className="grid grid-cols-3 gap-3 xl:min-w-[480px]">
              <SummaryItem label="已识别事实" value={sections.recognized.length} tone="green" />
              <SummaryItem label="需要确认" value={sections.pending.length} tone="red" />
              <SummaryItem label="信息不足" value={sections.insufficient.length} tone="amber" />
            </dl>
          </div>
        </CardContent>
      </Card>

      {analysisState === 'loading' && (
        <Card className="mt-5"><CardContent className="flex min-h-48 flex-col items-center justify-center text-center"><LoaderCircle className="h-8 w-8 animate-spin text-brand-600" /><h2 className="mt-4 text-lg font-semibold text-ink">正在提取真实简历事实</h2><p className="mt-2 text-sm text-slate-500">DeepSeek 正在识别经历、职责、行动、技术、数字、结果和项目状态。</p></CardContent></Card>
      )}
      {analysisState === 'error' && <div className="mt-5"><Alert title="简历事实提取未完成" tone="warning">{analysisError}<div className="mt-3"><Button variant="secondary" onClick={() => void extractFacts()}>重新提取</Button></div></Alert></div>}

      {feedback && (
        <div className="inline-feedback mt-5 border-emerald-200 bg-emerald-50 text-emerald-800" role="status" aria-live="polite">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="shrink-0 font-semibold hover:text-emerald-950">知道了</button>
        </div>
      )}

      {analysisState === 'ready' && <div className="mt-7 space-y-9">
        <FactSection
          id="pending-facts"
          title="需要你确认"
          description="高风险、低置信度、存在冲突或即将用于生成但原文不够明确的事实"
          count={sections.pending.length}
          icon={<AlertCircle className="h-5 w-5" />}
          tone="red"
        >
          {sections.pending.length > 0 ? sections.pending.map((fact) => <FactCard key={fact.factId} fact={fact} onConfirm={confirmFact} onEdit={setEditingFact} onDelete={setDeletingFact} />) : <EmptyState title="需要确认的事实已处理" description="当前没有需要显式确认的高风险事实。" />}
        </FactSection>

        <FactSection
          id="recognized-facts"
          title="已识别事实"
          description="原文明确、风险较低，已进入可用事实集合；你仍可检查和修改。"
          count={sections.recognized.length}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="green"
        >
          {sections.recognized.length > 0 ? sections.recognized.map((fact) => <FactCard key={fact.factId} fact={fact} onConfirm={confirmFact} onEdit={setEditingFact} onDelete={setDeletingFact} />) : <EmptyState title="暂无已识别事实" description="完成必要确认后，可用事实会显示在这里。" />}
        </FactSection>

        <FactSection
          id="insufficient-facts"
          title="信息不足"
          description="当前信息不足以形成可靠判断，需要补充真实信息或保留为未知"
          count={sections.insufficient.length}
          icon={<FileQuestion className="h-5 w-5" />}
          tone="amber"
        >
          {sections.insufficient.length > 0 ? sections.insufficient.map((fact) => <FactCard key={fact.factId} fact={fact} onConfirm={confirmFact} onEdit={setEditingFact} onDelete={setDeletingFact} />) : <EmptyState title="没有信息不足项" description="当前候选事实均有明确来源或处理状态。" />}
        </FactSection>

        <FactSection
          id="excluded-facts"
          title="已排除事实"
          description="明确不存在或已删除，不会用于岗位匹配和 AI 改写"
          count={sections.excluded.length}
          icon={<CircleSlash2 className="h-5 w-5" />}
          tone="slate"
        >
          {sections.excluded.length > 0 ? sections.excluded.map((fact) => <FactCard key={fact.factId} fact={fact} onConfirm={confirmFact} onEdit={setEditingFact} onDelete={setDeletingFact} />) : <EmptyState title="暂无已排除事实" description="明确排除的事实会保留在这里，便于追溯。" />}
        </FactSection>
      </div>}

      <FactEditModal fact={editingFact} experiences={getExperiences(facts)} onClose={() => setEditingFact(null)} onSave={saveFact} />

      <Modal
        open={Boolean(deletingFact)}
        title="确认删除事实"
        description="删除后，该事实会进入“已排除事实”，不再用于匹配和 AI 改写。"
        onClose={() => setDeletingFact(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingFact(null)}>取消</Button>
            <Button variant="danger" onClick={deleteFact}>确认删除</Button>
          </>
        }
      >
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">{deletingFact?.content}</div>
      </Modal>
    </TaskLayout>
  )
}

function readTaskInput(): TaskInputState | null {
  try {
    const saved = sessionStorage.getItem(TASK_INPUT_STATE_KEY)
    return saved ? JSON.parse(saved) as TaskInputState : null
  } catch { return null }
}

function readStoredFacts(): Fact[] | null {
  try {
    if (sessionStorage.getItem(FACTS_SOURCE_KEY) !== 'real-ai') return null
    const saved = sessionStorage.getItem(FACTS_STATE_KEY)
    return saved ? JSON.parse(saved) as Fact[] : null
  } catch { return null }
}

function getExperiences(facts: Fact[]) {
  return Array.from(new Map(facts.map((fact) => [fact.experienceId, { experienceId: fact.experienceId, experienceName: fact.experienceName }])).values())
}

function FactSection({ id, title, description, count, icon, tone, children }: { id: string; title: string; description: string; count: number; icon: ReactNode; tone: 'red' | 'green' | 'amber' | 'slate'; children: ReactNode }) {
  const iconTone = {
    red: 'bg-red-50 text-red-700 ring-red-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  }[tone]

  return (
    <section aria-labelledby={id}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${iconTone}`}>{icon}</span>
          <div>
            <h2 id={id} className="text-lg font-semibold text-ink">{title}</h2>
            <p className="mt-0.5 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">{count} 项</span>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function FactBoundaryAside({ pendingCount, blockingCount }: { pendingCount: number; blockingCount: number }) {
  return (
    <div className="space-y-5 lg:sticky lg:top-5">
      <Card>
        <CardContent className="p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><LockKeyhole className="h-5 w-5" /></span>
          <h2 className="mt-4 text-base font-semibold text-ink">事实使用边界</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">已确认事实，以及原文明确、低风险且无冲突的可用事实，会作为后续岗位匹配和改写的事实依据。</p>
          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {blockingCount > 0
              ? <>还有 <span className="font-semibold text-red-700">{blockingCount}</span> 项阻塞性关键事实需要处理（共 <span className="font-semibold text-ink">{pendingCount}</span> 项待确认）</>
              : <>当前没有阻塞性关键事实，共 <span className="font-semibold text-ink">{pendingCount}</span> 项待确认</>}
          </div>
        </CardContent>
      </Card>
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-sky-800"><Info className="h-4 w-4" />为什么需要确认？</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-sky-800">
          <li>职责不会从“参与”扩大为“主导”</li>
          <li>数字和结果必须能够追溯来源</li>
          <li>演示版本不会被描述为正式上线</li>
        </ul>
      </div>
    </div>
  )
}

function SummaryItem({ label, value, tone }: { label: string; value: number; tone: 'green' | 'red' | 'amber' }) {
  const valueTone = { green: 'text-emerald-700', red: 'text-red-700', amber: 'text-amber-700' }[tone]
  return <div className="summary-metric"><dt className="summary-metric-label">{label}</dt><dd className={`summary-metric-value ${valueTone}`}>{value}</dd></div>
}

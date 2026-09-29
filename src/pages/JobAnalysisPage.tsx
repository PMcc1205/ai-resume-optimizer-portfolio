import {
  ArrowLeft,
  ArrowRight,
  BadgePlus,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  FileSearch,
  FileText,
  GraduationCap,
  ListChecks,
  type LucideIcon,
  MessageSquareText,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageTitle } from '../components/layout/PageTitle'
import { TaskLayout } from '../components/layout/TaskLayout'
import { RequirementCard } from '../components/job-analysis/RequirementCard'
import { RequirementEditModal } from '../components/job-analysis/RequirementEditModal'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { EmptyState } from '../components/ui/FeedbackStates'
import { Modal } from '../components/ui/Modal'
import { DEMO_TASK_ID, ROUTES } from '../constants/routes'
import { REQUIREMENTS_STATE_KEY, TASK_INPUT_STATE_KEY } from '../constants/storage'
import type { JobRequirement, TaskInputState } from '../types/domain'

export { REQUIREMENTS_STATE_KEY }

const categoryConfig: Array<{ category: JobRequirement['category']; icon: LucideIcon; description: string }> = [
  { category: '岗位职责', icon: BriefcaseBusiness, description: '岗位需要承担的主要工作' },
  { category: '产品能力', icon: ListChecks, description: '产品判断、分析与方案能力' },
  { category: 'AI 技术能力', icon: BrainCircuit, description: '岗位涉及的 AI 技术要求' },
  { category: '专业技能', icon: Wrench, description: '岗位明确要求的专业能力与工具' },
  { category: '通用能力', icon: MessageSquareText, description: '协作、沟通和推进能力' },
  { category: '背景要求', icon: GraduationCap, description: '学历、专业与经历门槛' },
  { category: '加分项', icon: BadgePlus, description: '能够增强竞争力的额外条件' },
]
export function JobAnalysisPage() {
  const navigate = useNavigate()
  const { taskId = DEMO_TASK_ID } = useParams()
  const taskInput = useMemo(readTaskInput, [])
  const [requirements, setRequirements] = useState<JobRequirement[]>(readRequirements)
  useEffect(() => { sessionStorage.setItem(REQUIREMENTS_STATE_KEY, JSON.stringify(requirements)) }, [requirements])
  const [editingRequirement, setEditingRequirement] = useState<JobRequirement | null>(null)
  const [deletingRequirement, setDeletingRequirement] = useState<JobRequirement | null>(null)
  const [fullJdVisible, setFullJdVisible] = useState(false)
  const [feedback, setFeedback] = useState('')

  const summary = useMemo(() => ({
    total: requirements.length,
    core: requirements.filter((item) => item.importance === '核心要求').length,
    general: requirements.filter((item) => item.importance === '一般要求').length,
    bonus: requirements.filter((item) => item.importance === '加分项').length,
  }), [requirements])

  const updateImportance = (requirementId: string, importance: JobRequirement['importance']) => {
    setRequirements((current) => current.map((item) => item.requirementId === requirementId ? { ...item, importance, status: '已修改' } : item))
    setFeedback('重要程度已更新，后续分析将使用新的判断。')
  }

  const saveRequirement = (updated: JobRequirement) => {
    setRequirements((current) => current.map((item) => item.requirementId === updated.requirementId ? updated : item))
    setEditingRequirement(null)
    setFeedback('岗位要求已修改，证据匹配将使用当前内容。')
  }

  const deleteRequirement = () => {
    if (!deletingRequirement) return
    const deletedText = deletingRequirement.normalizedRequirement
    setRequirements((current) => current.filter((item) => item.requirementId !== deletingRequirement.requirementId))
    setDeletingRequirement(null)
    setFeedback(`已删除“${deletedText}”。`)
  }

  const confirmAndContinue = () => {
    const confirmed = requirements.map((item) => ({ ...item, status: '已确认' }))
    setRequirements(confirmed)
    sessionStorage.setItem(REQUIREMENTS_STATE_KEY, JSON.stringify(confirmed))
    navigate(ROUTES.FACT_CONFIRMATION(taskId))
  }

  return (
    <TaskLayout
      currentStep={1}
      maxCompletedStep={0}
      titleArea={
        <PageTitle
          eyebrow="岗位解析 · 第 1 步"
          title="岗位描述解析"
          description="这个岗位真正需要什么？检查系统提取的岗位要求，必要时可以修改。"
          actions={<Button variant="secondary" onClick={() => setFullJdVisible(true)}><FileText className="h-4 w-4" />查看原始 JD</Button>}
        />
      }
      footer={
        <div className="page-footer-actions">
          <Button variant="secondary" onClick={() => navigate(ROUTES.NEW_TASK)}><ArrowLeft className="h-4 w-4" />返回首页</Button>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <p className="text-center text-sm text-slate-500 sm:text-right">确认后，{requirements.length} 项要求将进入事实确认。</p>
            <Button disabled={requirements.length === 0} onClick={confirmAndContinue}>确认岗位要求并继续 <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      }
    >
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><FileSearch className="h-6 w-6" /></span>
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold text-ink">{taskInput?.jobTitle || '未提供岗位名称'}</p>
                <p className="mt-1 truncate text-sm text-slate-500">{taskInput?.companyName || '未填写公司名称'}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[600px]">
              <SummaryItem label="岗位要求" value={summary.total} />
              <SummaryItem label="核心要求" value={summary.core} tone="red" />
              <SummaryItem label="一般要求" value={summary.general} />
              <SummaryItem label="加分项" value={summary.bonus} tone="blue" />
            </dl>
          </div>
        </CardContent>
      </Card>

      {feedback && (
        <div className="inline-feedback mt-5 border-emerald-200 bg-emerald-50 text-emerald-800" role="status">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="shrink-0 font-semibold hover:text-emerald-950">知道了</button>
        </div>
      )}

      <div className="mt-7 space-y-8">
        {categoryConfig.map(({ category, icon: Icon, description }) => {
          const items = requirements.filter((item) => item.category === category)
          if (!items.length) return null
          return (
            <section key={category} aria-labelledby={`category-${category}`}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm ring-1 ring-slate-200"><Icon className="h-5 w-5" /></span>
                  <div><h2 id={`category-${category}`} className="text-lg font-semibold text-ink">{category}</h2><p className="mt-0.5 text-sm text-slate-500">{description}</p></div>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">{items.length} 项</span>
              </div>
              <div className="grid items-start gap-5 xl:grid-cols-2">
                {items.map((requirement) => (
                  <RequirementCard
                    key={requirement.requirementId}
                    requirement={requirement}
                    onEdit={setEditingRequirement}
                    onDelete={setDeletingRequirement}
                    onImportanceChange={updateImportance}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {requirements.length === 0 && <EmptyState title="没有有效的岗位要求" description="尚未获得通过校验的真实 AI 解析结果，请返回首页检查岗位描述或接口配置后重试。" action={<Button variant="secondary" onClick={() => navigate(ROUTES.NEW_TASK)}>返回首页</Button>} />}
      </div>

      <RequirementEditModal requirement={editingRequirement} onClose={() => setEditingRequirement(null)} onSave={saveRequirement} />

      <Modal
        open={Boolean(deletingRequirement)}
        title="确认删除岗位要求"
        description="删除后，该要求不会进入事实确认和证据匹配。"
        onClose={() => setDeletingRequirement(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingRequirement(null)}>取消</Button>
            <Button variant="danger" onClick={deleteRequirement}>确认删除</Button>
          </>
        }
      >
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">{deletingRequirement?.normalizedRequirement}</div>
      </Modal>

      <Modal
        open={fullJdVisible}
        title="原始岗位描述"
        description={`${taskInput?.jobTitle || '未提供岗位名称'}${taskInput?.companyName ? ` · ${taskInput.companyName}` : ''}`}
        onClose={() => setFullJdVisible(false)}
        footer={<Button onClick={() => setFullJdVisible(false)}>完成查看</Button>}
      >
        <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{taskInput?.jobDescription || '当前会话没有保存原始岗位描述。'}</div>
      </Modal>
    </TaskLayout>
  )
}

function SummaryItem({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'red' | 'blue' }) {
  const styles = tone === 'red' ? 'text-red-700' : tone === 'blue' ? 'text-sky-700' : 'text-ink'
  return <div className="summary-metric"><dt className="summary-metric-label">{label}</dt><dd className={`summary-metric-value ${styles}`}>{value}</dd></div>
}

function readTaskInput(): TaskInputState | null {
  try {
    const saved = sessionStorage.getItem(TASK_INPUT_STATE_KEY)
    return saved ? JSON.parse(saved) as TaskInputState : null
  } catch {
    return null
  }
}

function readRequirements(): JobRequirement[] {
  try {
    const saved = sessionStorage.getItem(REQUIREMENTS_STATE_KEY)
    return saved ? JSON.parse(saved) as JobRequirement[] : []
  } catch {
    return []
  }
}

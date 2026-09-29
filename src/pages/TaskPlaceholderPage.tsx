import { ArrowLeft, ArrowRight, ClipboardList, Construction, Database, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageTitle } from '../components/layout/PageTitle'
import { TaskLayout } from '../components/layout/TaskLayout'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { DEMO_TASK_ID, TASK_STEPS } from '../constants/routes'
import { mockTask } from '../mocks/resumeOptimization'
import type { TaskStep } from '../types/domain'

const PAGE_COPY: Record<TaskStep, { title: string; description: string; placeholder: string }> = {
  1: { title: '岗位描述解析', description: '将原始 JD 拆解为可判断、可映射的岗位要求。', placeholder: '岗位要求的解析与确认功能将在下一阶段实现。' },
  2: { title: '关键事实确认', description: '核对从简历中提取的经历事实，明确事实边界。', placeholder: '事实提取、追问与确认功能将在后续阶段实现。' },
  3: { title: '岗位匹配分析', description: '查看每项岗位要求对应的事实证据与匹配状态。', placeholder: '岗位要求—证据映射视图将在后续阶段实现。' },
  4: { title: '简历问题诊断', description: '根据岗位缺口定位简历表达与证据问题。', placeholder: '问题诊断清单与优先级视图将在后续阶段实现。' },
  5: { title: 'AI 逐条优化', description: '在事实约束下逐条审阅和确认改写建议。', placeholder: '原文对照、改写解释与事实校验将在后续阶段实现。' },
  6: { title: '优化结果', description: '汇总已确认的优化内容并查看最终版本。', placeholder: '结果预览与导出功能将在后续阶段实现。' },
}

export function TaskPlaceholderPage({ step }: { step: TaskStep }) {
  const { taskId = DEMO_TASK_ID } = useParams()
  const page = PAGE_COPY[step]
  const previous = TASK_STEPS.find((item) => item.step === step - 1)
  const next = TASK_STEPS.find((item) => item.step === step + 1)

  return (
    <TaskLayout
      currentStep={step}
      titleArea={<PageTitle eyebrow={`${mockTask.jobTitle} · ${mockTask.companyName}`} title={page.title} description={page.description} />}
      aside={step === 1 || step === 3 ? <TaskSummary /> : undefined}
      footer={
        <div className="flex items-center justify-between">
          {previous ? <Link to={previous.route(taskId)}><Button variant="secondary"><ArrowLeft className="h-4 w-4" />上一步</Button></Link> : <span />}
          {next ? <Button disabled={step >= 3}>保存并继续 <ArrowRight className="h-4 w-4" /></Button> : <Button disabled>完成优化</Button>}
        </div>
      }
    >
      <Card>
        <CardContent className="p-8">
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Construction className="h-7 w-7" /></span>
            <h2 className="text-xl font-semibold text-ink">页面骨架已就绪</h2>
            <p className="mt-2 max-w-lg text-base leading-7 text-slate-500">{page.placeholder}</p>
            <div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-3">
              <SkeletonStat icon={<ClipboardList />} label="统一任务布局" />
              <SkeletonStat icon={<Database />} label="模拟数据已接入" />
              <SkeletonStat icon={<ShieldCheck />} label="状态规范已统一" />
            </div>
          </div>
        </CardContent>
      </Card>
      {step >= 3 && <div className="mt-5"><Alert title="演示流程限制" tone="warning">当前模拟任务只完成前两步，尚未完成的后续步骤不能通过步骤导航直接跳转。</Alert></div>}
    </TaskLayout>
  )
}

function SkeletonStat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 py-3 text-sm font-medium text-slate-600"><span className="h-4 w-4 text-brand-600">{icon}</span>{label}</div>
}

function TaskSummary() {
  return (
    <Card>
      <CardContent>
        <p className="text-sm font-semibold text-slate-500">当前任务</p>
        <h2 className="mt-2 text-lg font-semibold text-ink">{mockTask.jobTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{mockTask.companyName}</p>
        <dl className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-slate-500">任务状态</dt><dd className="font-semibold text-amber-700">{mockTask.taskStatus}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-slate-500">当前进度</dt><dd className="font-semibold text-ink">2 / 6 已完成</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-slate-500">数据说明</dt><dd className="font-semibold text-ink">前端展示测试</dd></div>
        </dl>
      </CardContent>
    </Card>
  )
}

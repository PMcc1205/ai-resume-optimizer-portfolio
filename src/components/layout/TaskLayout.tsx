import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { DEMO_TASK_ID } from '../../constants/routes'
import { PageContainer } from './PageContainer'
import { TaskStepNavigation } from './TaskStepNavigation'
import { TopNavigation } from './TopNavigation'
import type { TaskStep } from '../../types/domain'
import { TASK_PROGRESS_STATE_KEY } from '../../constants/storage'

type TaskLayoutProps = {
  currentStep: TaskStep
  maxCompletedStep?: TaskStep | 0
  titleArea: ReactNode
  children: ReactNode
  aside?: ReactNode
  footer?: ReactNode
}

export function TaskLayout({ currentStep, maxCompletedStep, titleArea, children, aside, footer }: TaskLayoutProps) {
  const { taskId = DEMO_TASK_ID } = useParams()
  const progressKey = `${TASK_PROGRESS_STATE_KEY}:${taskId}`
  const [furthestStep, setFurthestStep] = useState<TaskStep>(() => {
    const saved = Number(sessionStorage.getItem(progressKey))
    return Math.max(currentStep, Number.isInteger(saved) && saved >= 1 && saved <= 6 ? saved : 1) as TaskStep
  })
  useEffect(() => {
    setFurthestStep((previous) => {
      const next = Math.max(previous, currentStep) as TaskStep
      sessionStorage.setItem(progressKey, String(next))
      return next
    })
  }, [currentStep, progressKey])
  const completedStep = Math.max(maxCompletedStep ?? 0, furthestStep) as TaskStep
  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <TopNavigation />
      <div className="border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.02)]">
        <PageContainer><TaskStepNavigation taskId={taskId} currentStep={currentStep} maxCompletedStep={completedStep} /></PageContainer>
      </div>
      <main className={footer ? 'pb-44 sm:pb-32' : undefined}>
        <PageContainer className="py-7 sm:py-8">
          {titleArea}
          <div className={aside ? 'mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]' : 'mt-6'}>
            <div>{children}</div>
            {aside && <aside>{aside}</aside>}
          </div>
        </PageContainer>
      </main>
      {footer && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur"><PageContainer>{footer}</PageContainer></div>}
    </div>
  )
}

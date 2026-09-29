import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { TASK_STEPS } from '../../constants/routes'
import { cn } from '../../lib/cn'
import type { TaskStep } from '../../types/domain'

type TaskStepNavigationProps = {
  taskId: string
  currentStep: TaskStep
  maxCompletedStep: TaskStep | 0
}

export function TaskStepNavigation({ taskId, currentStep, maxCompletedStep }: TaskStepNavigationProps) {
  return (
    <nav aria-label="优化任务进度">
      <ol className="flex w-full items-center py-4 sm:py-[18px]">
        {TASK_STEPS.map((item, index) => {
          const completed = item.step <= maxCompletedStep && item.step !== currentStep
          const current = item.step === currentStep
          const allowed = completed || current
          const content = (
            <>
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition sm:h-8 sm:w-8 sm:text-sm', completed && 'border-brand-600 bg-brand-600 text-white', current && 'border-brand-600 bg-white text-brand-700 ring-4 ring-brand-100', !completed && !current && 'border-slate-300 bg-slate-50 text-slate-400')}>
                {completed ? <Check className="h-4 w-4" aria-hidden="true" /> : item.step}
              </span>
              <span className={cn('ml-2 hidden whitespace-nowrap text-sm font-semibold md:inline', completed && 'text-brand-700', current && 'text-ink', !allowed && 'text-slate-400')}>{item.label}</span>
            </>
          )
          return (
            <li key={item.step} className="flex flex-1 items-center last:flex-none">
              {completed ? <Link to={item.route(taskId)} aria-label={`${item.label}，已完成`} className="flex items-center rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{content}</Link> : <div className="flex items-center p-1" aria-label={`${item.label}，${current ? '当前步骤' : '未完成'}`} aria-current={current ? 'step' : undefined} aria-disabled={!allowed}>{content}</div>}
              {index < TASK_STEPS.length - 1 && <span className={cn('mx-1.5 h-px min-w-2 flex-1 sm:mx-3 sm:min-w-5', item.step < currentStep || item.step < maxCompletedStep ? 'bg-brand-300' : 'bg-slate-200')} aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

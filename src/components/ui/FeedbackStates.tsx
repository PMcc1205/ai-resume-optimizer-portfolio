import { AlertTriangle, FileQuestion, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

type StateProps = { title: string; description: string; action?: ReactNode }

function StateFrame({ icon, title, description, action }: StateProps & { icon: ReactNode }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center sm:p-8">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm">{icon}</div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function EmptyState(props: StateProps) {
  return <StateFrame icon={<FileQuestion className="h-6 w-6" />} {...props} />
}

export function LoadingState({ title = '正在加载', description = '请稍候，正在准备页面内容。' }: Partial<StateProps>) {
  return <StateFrame icon={<LoaderCircle className="h-6 w-6 animate-spin" />} title={title} description={description} />
}

export function ErrorState({ title = '暂时无法加载', description = '请检查后重试。', action }: Partial<StateProps>) {
  return <StateFrame icon={<AlertTriangle className="h-6 w-6 text-red-600" />} title={title} description={description} action={action ?? <Button variant="secondary">重新加载</Button>} />
}

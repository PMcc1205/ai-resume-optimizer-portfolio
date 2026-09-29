import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type AlertProps = { title: string; children: ReactNode; tone?: 'info' | 'success' | 'warning' }

export function Alert({ title, children, tone = 'info' }: AlertProps) {
  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }
  const Icon = tone === 'success' ? CircleCheck : tone === 'warning' ? CircleAlert : Info
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3.5 shadow-sm', styles[tone])} role="status">
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div><p className="text-sm font-semibold">{title}</p><div className="mt-1 text-sm leading-6 opacity-80">{children}</div></div>
    </div>
  )
}

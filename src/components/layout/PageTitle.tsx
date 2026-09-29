import type { ReactNode } from 'react'

type PageTitleProps = {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}

export function PageTitle({ eyebrow, title, description, actions }: PageTitleProps) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-2 text-sm font-semibold text-brand-700">{eyebrow}</p>}
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.025em] text-ink sm:text-[2rem]">{title}</h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">{description}</p>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}

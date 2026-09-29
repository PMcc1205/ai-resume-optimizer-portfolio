import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from '../../lib/cn'

type ModalProps = {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  className?: string
}

export function Modal({ open, title, description, children, onClose, footer, className }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={onClose}>
      <section className={cn('max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-hidden rounded-2xl border border-white/70 bg-white shadow-lift', className)} role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
          <div><h2 id="modal-title" className="text-lg font-semibold tracking-tight text-ink">{title}</h2>{description && <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>}</div>
          <Button variant="ghost" className="min-h-9 px-2" onClick={onClose} aria-label="关闭弹窗"><X className="h-5 w-5" /></Button>
        </header>
        <div className="overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">{footer}</footer>}
      </section>
    </div>
  )
}

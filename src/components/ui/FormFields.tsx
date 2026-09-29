import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type FieldExtras = { label?: string; hint?: string; error?: string }
type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldExtras
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldExtras

export const TextInput = forwardRef<HTMLInputElement, InputProps>(({ label, hint, error, className, id, required, ...props }, ref) => {
  const inputId = id ?? props.name
  const descriptionId = inputId ? `${inputId}-description` : undefined
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-2 block text-sm font-semibold text-slate-700">{label}{required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}</span>}
      <input ref={ref} id={inputId} required={required} aria-invalid={Boolean(error)} aria-describedby={hint || error ? descriptionId : undefined} className={cn('min-h-11 w-full rounded-xl border bg-white px-3.5 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2', error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100', className)} {...props} />
      {(error || hint) && <span id={descriptionId} className={cn('mt-1.5 block text-sm', error ? 'font-medium text-red-600' : 'text-slate-500')}>{error ?? hint}</span>}
    </label>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, hint, error, className, id, required, ...props }, ref) => {
  const inputId = id ?? props.name
  const descriptionId = inputId ? `${inputId}-description` : undefined
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-2 block text-sm font-semibold text-slate-700">{label}{required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}</span>}
      <textarea ref={ref} id={inputId} required={required} aria-invalid={Boolean(error)} aria-describedby={hint || error ? descriptionId : undefined} className={cn('w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-base leading-7 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2', error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100', className)} {...props} />
      {(error || hint) && <span id={descriptionId} className={cn('mt-1.5 block text-sm', error ? 'font-medium text-red-600' : 'text-slate-500')}>{error ?? hint}</span>}
    </label>
  )
})

TextInput.displayName = 'TextInput'
Textarea.displayName = 'Textarea'

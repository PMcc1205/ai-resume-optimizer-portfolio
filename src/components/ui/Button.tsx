import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  children: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary: 'border border-brand-600 bg-brand-600 text-white shadow-sm hover:border-brand-700 hover:bg-brand-700 focus-visible:ring-brand-500 disabled:border-slate-300 disabled:bg-slate-300 disabled:shadow-none',
  secondary: 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-slate-400',
  danger: 'border border-red-600 bg-red-600 text-white shadow-sm hover:border-red-700 hover:bg-red-700 focus-visible:ring-red-500',
  ghost: 'border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
}

export function Button({ variant = 'primary', className, type = 'button', children, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:active:translate-y-0',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

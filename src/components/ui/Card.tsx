import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type CardProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode }

export function Card({ children, className, ...props }: CardProps) {
  return <div className={cn('rounded-2xl border border-slate-200/90 bg-white shadow-card', className)} {...props}>{children}</div>
}

export function CardHeader({ children, className, ...props }: CardProps) {
  return <div className={cn('border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5', className)} {...props}>{children}</div>
}

export function CardContent({ children, className, ...props }: CardProps) {
  return <div className={cn('p-5 sm:p-6', className)} {...props}>{children}</div>
}

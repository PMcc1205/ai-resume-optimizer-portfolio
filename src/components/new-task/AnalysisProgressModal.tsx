import { Check, FileSearch, LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

export const ANALYSIS_STEPS = [
  '正在校验岗位描述',
  '正在请求结构化解析',
  '正在校验岗位要求',
  '正在准备解析结果',
] as const

type AnalysisProgressModalProps = {
  open: boolean
  currentStep: number
}

export function AnalysisProgressModal({ open, currentStep }: AnalysisProgressModalProps) {
  if (!open) return null

  const progress = Math.round(((currentStep + 1) / ANALYSIS_STEPS.length) * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-5 backdrop-blur-sm" role="presentation">
      <section className="w-full max-w-lg rounded-2xl border border-white/70 bg-white p-6 shadow-lift sm:p-8" role="dialog" aria-modal="true" aria-labelledby="analysis-title" aria-describedby="analysis-description">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><FileSearch className="h-6 w-6" /></span>
          <div>
            <p className="text-sm font-semibold text-brand-700">真实 AI 岗位解析</p>
            <h2 id="analysis-title" className="mt-1 text-xl font-semibold text-ink">正在识别岗位要求</h2>
            <p id="analysis-description" className="mt-2 text-sm leading-6 text-slate-500">系统正在解析 JD，并校验结构化结果。</p>
          </div>
        </div>

        <div className="mt-7 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <ol className="mt-6 space-y-3" aria-live="polite">
          {ANALYSIS_STEPS.map((label, index) => {
            const complete = index < currentStep
            const active = index === currentStep
            return (
              <li key={label} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm', active && 'bg-brand-50 text-brand-900', complete && 'text-slate-600', index > currentStep && 'text-slate-400')}>
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border', complete && 'border-brand-600 bg-brand-600 text-white', active && 'border-brand-600 bg-white text-brand-700', index > currentStep && 'border-slate-300 bg-white')}>
                  {complete ? <Check className="h-3.5 w-3.5" /> : active ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
                </span>
                <span className={cn(active && 'font-semibold')}>{label}</span>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}

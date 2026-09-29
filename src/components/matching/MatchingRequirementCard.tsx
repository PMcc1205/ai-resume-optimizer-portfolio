import { ChevronDown, Link2Off, Plus, ShieldCheck } from 'lucide-react'
import type { EvidenceMapping, Fact, Gap, JobRequirement } from '../../types/domain'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { StatusBadge } from '../ui/StatusBadge'

type Props = {
  requirement: JobRequirement
  mapping: EvidenceMapping
  gap: Gap
  facts: Fact[]
  skipped: boolean
  disabled?: boolean
  inOptimizationList: boolean
  onAddExperience: (r: JobRequirement) => void
  onMarkAbsent: (r: JobRequirement) => void
  onSkip: (r: JobRequirement) => void
  onReopen: (r: JobRequirement) => void
  onAddToOptimization: (id: string) => void
  onRemoveMapping: (requirementId: string, factId: string) => void
}

export function MatchingRequirementCard({ requirement, mapping, gap, facts, skipped, disabled = false, inOptimizationList, onAddExperience, onMarkAbsent, onSkip, onReopen, onAddToOptimization, onRemoveMapping }: Props) {
  const primaryFact = facts.find((fact) => fact.sourceLocation.includes(`用户补充 · ${requirement.requirementId}`))
    ?? facts.find((fact) => fact.sourceLocation.includes('岗位匹配页 · 用户补充'))
    ?? facts[0]

  return (
    <Card data-requirement-id={requirement.requirementId} data-match-status={mapping.matchStatus} data-gap-type={gap.gapType} data-skipped={skipped}>
      <CardContent className="p-0">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-400">{requirement.requirementId}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 sm:text-sm">{requirement.importance}</span>
                {gap.capabilityGapSubtype && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 sm:text-sm">{gap.capabilityGapSubtype}</span>}
              </div>
              <h2 className="mt-2 text-lg font-semibold leading-7 tracking-tight text-ink">{requirement.normalizedRequirement}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">岗位原文：{requirement.sourceText}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2"><StatusBadge status={mapping.matchStatus} /><StatusBadge status={gap.gapType} />{skipped && <span className="inline-flex min-h-7 items-center rounded-md bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">已暂时跳过</span>}</div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="metadata-label">判断说明</p>
              <p className="mt-1.5 text-sm leading-6 text-slate-700">{mapping.reason}</p>
            </div>
            <div className="rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
              <p className="metadata-label text-brand-600">证据支持程度</p>
              <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-brand-800"><ShieldCheck className="h-4 w-4" />{mapping.evidenceStrength}</p>
            </div>
          </div>

          {primaryFact && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
              <p className="metadata-label text-emerald-700">主要支持证据</p>
              <p className="mt-1.5 text-sm font-medium leading-6 text-emerald-900">{primaryFact.content}</p>
            </div>
          )}

          <details className="detail-disclosure mt-4 group">
            <summary className="detail-summary">
              <span>查看证据与判断详情（{facts.length} 条事实）</span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 border-t border-slate-200 px-4 py-4">
              <dl className="grid gap-4 sm:grid-cols-3">
                <div><dt className="metadata-label">相关性</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{mapping.relevance}</dd></div>
                <div><dt className="metadata-label">证据等级</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{mapping.evidenceLevel}</dd></div>
                <div><dt className="metadata-label">判断置信度</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{Math.round(mapping.confidence * 100)}%</dd></div>
              </dl>
              <div>
                <p className="metadata-label">支持事实</p>
                {facts.length ? facts.map((fact) => (
                  <div key={fact.factId} className="mt-2 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-sm leading-6 text-slate-700">
                      <p className="font-medium text-ink">{fact.content}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{fact.factId.toUpperCase()} · {fact.experienceName} · {fact.sourceLocation}</p>
                    </div>
                    <Button disabled={disabled} variant="ghost" className="min-h-9 shrink-0 px-2.5 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onRemoveMapping(requirement.requirementId, fact.factId)}><Link2Off className="h-4 w-4" />该经历不能证明此要求</Button>
                  </div>
                )) : <p className="mt-2 text-sm text-slate-500">暂无可用事实</p>}
              </div>
              <div className="rounded-lg bg-white px-3 py-3 text-sm leading-6 text-slate-600">
                <span className="font-semibold text-slate-700">缺口说明：</span>{gap.reason}<br />
                <span className="font-semibold text-slate-700">下一步建议：</span>{gap.nextAction}
              </div>
            </div>
          </details>
        </div>

        {(gap.gapType === '事实缺口' || gap.gapType === '表达缺口') && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
            {gap.gapType === '事实缺口' && (skipped ? <Button disabled={disabled} variant="secondary" onClick={() => onReopen(requirement)}>重新处理</Button> : <>
              <Button disabled={disabled} onClick={() => onAddExperience(requirement)}>我有相关经历</Button>
              <Button disabled={disabled} variant="secondary" onClick={() => onMarkAbsent(requirement)}>我没有相关经历</Button>
              <Button disabled={disabled} variant="ghost" onClick={() => onSkip(requirement)}>暂时跳过</Button>
            </>)}
            {gap.gapType === '表达缺口' && <Button disabled={disabled || inOptimizationList} onClick={() => onAddToOptimization(requirement.requirementId)}><Plus className="h-4 w-4" />{inOptimizationList ? '已加入优化列表' : '加入优化列表'}</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

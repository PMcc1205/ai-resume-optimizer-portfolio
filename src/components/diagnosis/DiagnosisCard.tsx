import {
  AlertCircle,
  ArrowUpRight,
  Ban,
  Check,
  ChevronDown,
  FileText,
  Lightbulb,
  Minus,
  ShieldAlert,
  Target,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { PriorityBadge, StatusBadge } from '../ui/StatusBadge'
import type { EvidenceMapping, Fact, Gap, JobRequirement, ResumeDiagnosis } from '../../types/domain'

type DiagnosisCardProps = {
  diagnosis: ResumeDiagnosis
  requirement: JobRequirement
  linkedRequirements: JobRequirement[]
  mapping: EvidenceMapping
  gap: Gap
  facts: Fact[]
  selected: boolean
  onToggleSelection: (diagnosisId: string) => void
  onViewFacts: () => void
}

export function DiagnosisCard({ diagnosis, requirement, linkedRequirements, mapping, gap, facts, selected, onToggleSelection, onViewFacts }: DiagnosisCardProps) {
  const isExpressionGap = gap.gapType === '表达缺口'
  const isFactGap = gap.gapType === '事实缺口'
  const isCapabilityShortfall = gap.gapType === '能力缺口' && gap.capabilityGapSubtype === '能力程度不足'
  const isCapabilityMissing = gap.gapType === '能力缺口' && gap.capabilityGapSubtype === '能力缺失'

  return (
    <Card
      className={selected ? 'border-brand-300 ring-2 ring-brand-100' : undefined}
      data-diagnosis-id={diagnosis.diagnosisId}
      data-priority={diagnosis.priority}
      data-gap-type={gap.gapType}
      data-capability-subtype={gap.capabilityGapSubtype ?? ''}
      data-optimizable={diagnosis.optimizable === true}
    >
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600">{diagnosis.diagnosisId.toUpperCase()}</span>
            <span className="text-sm font-semibold text-slate-700">{diagnosis.experienceName}</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span className="text-sm text-slate-500">{diagnosis.issueType}</span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <PriorityBadge priority={diagnosis.priority} />
            {diagnosis.skipped && <span className="inline-flex min-h-7 items-center rounded-md bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">已暂时跳过</span>}
            <span className="inline-flex min-h-7 items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 sm:text-sm">{requirement.importance}</span>
            {selected && <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 sm:text-sm"><Check className="h-3.5 w-3.5" />已选中</span>}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4" aria-label="原始简历内容">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-600"><FileText className="h-4 w-4" />原始简历内容</p>
              <blockquote className="mt-3 text-base font-medium leading-7 text-ink">{diagnosis.originalText || '暂无对应简历原文'}</blockquote>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="问题诊断">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={mapping.matchStatus} />
                <StatusBadge status={gap.gapType} />
                {gap.capabilityGapSubtype && <span className="inline-flex min-h-7 items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 sm:text-sm">{gap.capabilityGapSubtype}</span>}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{diagnosis.description}</p>
            </section>
          </div>

          <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-800"><Lightbulb className="h-4 w-4" />{diagnosis.optimizable ? '修改方向' : '下一步处理'}</p>
            <p className="mt-1.5 text-sm leading-6 text-brand-800">{diagnosis.suggestion}</p>
          </div>

          <details className="detail-disclosure mt-4 group">
            <summary className="detail-summary">
              <span className="flex items-center gap-2"><Target className="h-4 w-4" />查看岗位要求与证据依据</span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-4 border-t border-slate-200 px-4 py-4 lg:grid-cols-2">
              <div>
                <p className="metadata-label">对应岗位要求</p>
                <div className="mt-2 space-y-2">
                  {linkedRequirements.map((item) => <div key={item.requirementId} className="flex items-start gap-2 text-sm leading-6 text-slate-700"><span className="mt-0.5 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand-700">{item.requirementId.toUpperCase()}</span><span>{item.normalizedRequirement}</span></div>)}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-700">判断说明：</span>{mapping.reason}</p>
              </div>
              <div>
                <p className="metadata-label">真实事实（{facts.length} 条）</p>
                {facts.length ? <div className="mt-2 space-y-2">{facts.map((fact) => <div key={fact.factId} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700"><p>{fact.content}</p><p className="mt-0.5 text-xs text-slate-500">{fact.factId.toUpperCase()} · {fact.sourceLocation}</p></div>)}</div> : <p className="mt-2 text-sm text-slate-500">当前没有可用事实。</p>}
              </div>
            </div>
          </details>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
          {isExpressionGap && diagnosis.optimizable && <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm leading-6 text-slate-600">已有 {facts.length} 条真实事实可用于安全改写。</p><Button variant={selected ? 'secondary' : 'primary'} onClick={() => onToggleSelection(diagnosis.diagnosisId)}>{selected ? <><Minus className="h-4 w-4" />移出优化列表</> : <><Check className="h-4 w-4" />加入优化列表</>}</Button></div>}

          {isCapabilityShortfall && diagnosis.optimizable && <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2 text-sm leading-6 text-amber-800"><ShieldAlert className="mt-1 h-4 w-4 shrink-0" /><span>只能强化已有真实经历，不得提高职责或能力等级。</span></div><Button variant={selected ? 'secondary' : 'primary'} onClick={() => onToggleSelection(diagnosis.diagnosisId)}>{selected ? <><Minus className="h-4 w-4" />移出优化列表</> : <><Check className="h-4 w-4" />优化真实表达</>}</Button></div>}

          {isCapabilityMissing && <div className="flex items-start gap-2 text-sm font-medium leading-6 text-red-800"><Ban className="mt-1 h-4 w-4 shrink-0" /><span><strong>当前问题无法通过简历修改解决。</strong> 不会生成不存在的项目经历。</span></div>}

          {isFactGap && <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2 text-sm font-medium leading-6 text-orange-800"><AlertCircle className="mt-1 h-4 w-4 shrink-0" />{diagnosis.skipped ? '该项尚未确认，本次分析可能不完整。' : '需要先补充真实信息，当前不会进入 AI 改写。'}</div><Button variant="secondary" onClick={onViewFacts}>查看 / 补充事实 <ArrowUpRight className="h-4 w-4" /></Button></div>}

          {!isExpressionGap && !isFactGap && !isCapabilityShortfall && !isCapabilityMissing && <p className="text-sm text-slate-500">当前条目无需优先处理。</p>}
        </div>
      </CardContent>
    </Card>
  )
}

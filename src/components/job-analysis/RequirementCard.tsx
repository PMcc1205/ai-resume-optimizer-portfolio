import { ChevronDown, ChevronUp, FileText, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { REQUIREMENT_IMPORTANCE } from '../../constants/status'
import { cn } from '../../lib/cn'
import type { JobRequirement } from '../../types/domain'
import { Button } from '../ui/Button'

type RequirementCardProps = {
  requirement: JobRequirement
  onEdit: (requirement: JobRequirement) => void
  onDelete: (requirement: JobRequirement) => void
  onImportanceChange: (requirementId: string, importance: JobRequirement['importance']) => void
}

const importanceTone: Record<JobRequirement['importance'], string> = { '核心要求': 'border-red-200 bg-red-50 text-red-700', '一般要求': 'border-slate-200 bg-slate-50 text-slate-700', '加分项': 'border-sky-200 bg-sky-50 text-sky-700' }

function getConfidenceLabel(confidence: number) {
  if (confidence >= 0.9) return '高置信度'
  if (confidence >= 0.75) return '中置信度'
  return '低置信度'
}

export function RequirementCard({ requirement, onEdit, onDelete, onImportanceChange }: RequirementCardProps) {
  const [sourceVisible, setSourceVisible] = useState(false)
  const needsReview = requirement.confidence < 0.75

  return (
    <article className={cn('overflow-hidden rounded-2xl border bg-white shadow-card', needsReview ? 'border-amber-300' : 'border-slate-200/90')} data-requirement-id={requirement.requirementId}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-400">{requirement.requirementId.toUpperCase()}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{requirement.category}</span>
            {requirement.status === '已修改' && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">已修改</span>}
          </div>
          {needsReview && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              <TriangleAlert className="h-3.5 w-3.5" />
              建议检查
            </span>
          )}
        </div>

        <h3 className="mt-4 text-lg font-semibold leading-7 text-ink">{requirement.normalizedRequirement}</h3>

        {needsReview && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">当前岗位描述含义较模糊，请确认系统理解是否准确。</p>}

        <dl className="mt-5 grid gap-x-5 gap-y-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">重要程度</dt>
            <dd className="mt-1.5">
              <select
                aria-label={`${requirement.normalizedRequirement}的重要程度`}
                value={requirement.importance}
                onChange={(event) => onImportanceChange(requirement.requirementId, event.target.value as JobRequirement['importance'])}
                className={cn('min-h-9 w-full rounded-lg border px-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-200', importanceTone[requirement.importance])}
              >
                {Object.values(REQUIREMENT_IMPORTANCE).map((importance) => <option key={importance} value={importance}>{importance}</option>)}
              </select>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">解析置信度</dt>
            <dd className={cn('mt-2 text-sm font-semibold', needsReview ? 'text-amber-700' : 'text-ink')}>{Math.round(requirement.confidence * 100)}% · {getConfidenceLabel(requirement.confidence)}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">能力标签</dt>
            <dd className="mt-1.5 text-sm font-medium text-ink">{requirement.capability}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">要求强度</dt>
            <dd className="mt-1.5 text-sm font-medium text-ink">{requirement.requiredLevel}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {requirement.keywords.map((keyword) => <span key={keyword} className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">{keyword}</span>)}
        </div>
      </div>

      {sourceVisible && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
          <p className="text-sm font-semibold text-slate-600">原始 JD 来源 · {requirement.sourceSection}</p>
          <blockquote className="mt-2 border-l-2 border-brand-400 pl-3 text-sm leading-6 text-slate-600">{requirement.sourceText}</blockquote>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
        <Button variant="ghost" className="min-h-9 px-2.5" onClick={() => setSourceVisible((visible) => !visible)} aria-expanded={sourceVisible}>
          <FileText className="h-4 w-4" />{sourceVisible ? '收起原文' : '查看原文'}{sourceVisible ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
        <div className="flex gap-1">
          <Button variant="ghost" className="min-h-9 px-2.5" onClick={() => onEdit(requirement)}><Pencil className="h-4 w-4" />编辑</Button>
          <Button variant="ghost" className="min-h-9 px-2.5 text-red-600 hover:bg-red-50" onClick={() => onDelete(requirement)}><Trash2 className="h-4 w-4" />删除</Button>
        </div>
      </div>
    </article>
  )
}

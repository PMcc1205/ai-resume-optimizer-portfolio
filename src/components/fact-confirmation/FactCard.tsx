import {
  AlertTriangle,
  Check,
  ChevronDown,
  FileText,
  Pencil,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import type { Fact } from '../../types/domain'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { StatusBadge } from '../ui/StatusBadge'

type FactCardProps = {
  fact: Fact
  onConfirm: (factId: string) => void
  onEdit: (fact: Fact) => void
  onDelete: (fact: Fact) => void
}

const riskStyles: Record<Fact['riskLevel'], string> = {
  高: 'bg-red-50 text-red-700 ring-red-200',
  中: 'bg-amber-50 text-amber-700 ring-amber-200',
  低: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function FactCard({ fact, onConfirm, onEdit, onDelete }: FactCardProps) {
  const isPending = fact.status === '待确认'
  const isDeleted = fact.status === '已删除'
  const confidenceTone = fact.confidence < 0.6 ? 'text-red-700' : fact.confidence < 0.8 ? 'text-amber-700' : 'text-emerald-700'

  return (
    <Card className={cn('overflow-hidden', isPending && fact.riskLevel === '高' && 'border-red-200')} data-fact-id={fact.factId}>
      <CardContent className="p-0">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full bg-brand-50 px-2.5 text-xs font-semibold leading-none text-brand-700 ring-1 ring-inset ring-brand-100 sm:text-sm">{fact.type}</span>
                <span className={cn('inline-flex h-7 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold leading-none ring-1 ring-inset sm:text-sm', riskStyles[fact.riskLevel])}>{fact.riskLevel}风险</span>
                <StatusBadge status={fact.status} />
              </div>
              <h3 className="mt-3 text-lg font-semibold leading-7 tracking-tight text-ink">{fact.content}</h3>
              <p className="mt-2 text-sm text-slate-500">所属经历：<span className="font-medium text-slate-700">{fact.experienceName}</span></p>
            </div>
          </div>

          {isPending && (
            <div className={cn('mt-4 rounded-xl border px-4 py-3', fact.riskLevel === '高' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50')}>
              <div className={cn('flex items-center gap-2 text-sm font-semibold', fact.riskLevel === '高' ? 'text-red-800' : 'text-amber-800')}>
                {fact.riskLevel === '高' ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {fact.reviewReason}
              </div>
              <p className={cn('mt-1 text-sm leading-6', fact.riskLevel === '高' ? 'text-red-700' : 'text-amber-700')}>{fact.riskReason}</p>
              {fact.conflictNote && <p className="mt-2 border-t border-red-200 pt-2 text-sm font-medium leading-6 text-red-800">冲突说明：{fact.conflictNote}</p>}
            </div>
          )}

          <details className="detail-disclosure mt-4 group">
            <summary className="detail-summary">
              <span className="flex items-center gap-2"><FileText className="h-4 w-4" />查看来源与识别信息</span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="metadata-label">Fact ID</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-slate-700">{fact.factId.toUpperCase()}</dd>
                </div>
                <div>
                  <dt className="metadata-label">提取置信度</dt>
                  <dd className={cn('mt-1 text-sm font-semibold', confidenceTone)}>{Math.round(fact.confidence * 100)}%</dd>
                </div>
                <div>
                  <dt className="metadata-label">来源位置</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-700">{fact.sourceLocation}</dd>
                </div>
                {fact.projectStatus && (
                  <div>
                    <dt className="metadata-label">项目状态</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-700">{fact.projectStatus}</dd>
                  </div>
                )}
                {fact.numericDetail && (
                  <div>
                    <dt className="metadata-label">数字信息</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-700">{fact.numericDetail.value} {fact.numericDetail.unit} · {fact.numericDetail.metric}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="metadata-label">原始来源</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{fact.sourceText}</p>
              </div>
            </div>
          </details>
        </div>

        {!isDeleted && (
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            {isPending && <Button onClick={() => onConfirm(fact.factId)}><Check className="h-4 w-4" />确认事实</Button>}
            <Button variant="secondary" onClick={() => onEdit(fact)}><Pencil className="h-4 w-4" />{fact.status === '信息不足' ? '补充并修改' : '修改'}</Button>
            <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onDelete(fact)}><Trash2 className="h-4 w-4" />删除</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

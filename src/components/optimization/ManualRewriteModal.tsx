import { ChevronDown, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Fact, RewriteSuggestion } from '../../types/domain'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/FormFields'
import { Modal } from '../ui/Modal'

type ManualRewriteModalProps = {
  rewrite: RewriteSuggestion | null
  facts: Fact[]
  onClose: () => void
  onSave: (text: string) => void
}

export function ManualRewriteModal({ rewrite, facts, onClose, onSave }: ManualRewriteModalProps) {
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (rewrite) setDraft(rewrite.editedText || rewrite.optimizedText)
  }, [rewrite])

  if (!rewrite) return null

  const currentText = rewrite.editedText || rewrite.optimizedText
  const trimmed = draft.trim()
  const canSave = Boolean(trimmed) && trimmed !== currentText.trim()
  const usedFacts = rewrite.usedFactIds.map((factId) => facts.find((fact) => fact.factId === factId)).filter((fact): fact is Fact => Boolean(fact))

  return <Modal
    open
    className="max-w-3xl"
    title="手动修改优化内容"
    description="你可以调整表达，但不要添加未经确认的职责、技术、数字、结果或项目状态。"
    onClose={onClose}
    footer={<><Button variant="secondary" onClick={onClose}>取消</Button><Button disabled={!canSave} onClick={() => onSave(trimmed)}>保存修改</Button></>}
  >
    <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1">
      <ReadOnlyText title="原始简历内容" text={rewrite.originalText} className="border-slate-200 bg-slate-50 text-slate-600" />
      <ReadOnlyText title="AI 优化版本" text={rewrite.optimizedText} className="border-emerald-200 bg-emerald-50/60 text-slate-800" />
      <div>
        <Textarea id="manual-rewrite-text" label="我的修改" rows={6} value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-40" />
        <p className="mt-1.5 text-right text-xs text-slate-500">当前字数：{draft.length}</p>
      </div>
      <details className="detail-disclosure group">
        <summary className="detail-summary"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />查看可使用的事实依据（{usedFacts.length}）</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
        <div className="space-y-3 border-t border-slate-200 px-4 py-4">
          {usedFacts.map((fact) => <section key={fact.factId} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono font-semibold text-brand-700">{fact.factId.toUpperCase()}</span><span className="text-slate-500">{fact.experienceName}</span></div>
            <p className="mt-2 leading-6 text-slate-800">{fact.content}</p>
            <p className="mt-2 leading-6 text-slate-500">原始来源：{fact.sourceText}</p>
            <p className="mt-1 text-xs text-slate-400">{fact.sourceLocation}</p>
          </section>)}
          {!usedFacts.length && <p className="text-sm text-slate-500">当前没有可展示的 Fact。</p>}
        </div>
      </details>
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">保存修改后，该版本需要重新进行事实校验，校验通过后才能进入最终简历。</p>
    </div>
  </Modal>
}

function ReadOnlyText({ title, text, className }: { title: string; text: string; className: string }) {
  return <section className={`rounded-xl border p-4 ${className}`}><p className="metadata-label">{title}</p><p className="mt-2 whitespace-pre-wrap text-base leading-7">{text}</p></section>
}

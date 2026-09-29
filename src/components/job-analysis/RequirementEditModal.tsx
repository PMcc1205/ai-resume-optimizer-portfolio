import { useEffect, useState } from 'react'
import { REQUIREMENT_CATEGORY, REQUIREMENT_IMPORTANCE, REQUIREMENT_LEVEL } from '../../constants/status'
import type { JobRequirement } from '../../types/domain'
import { Button } from '../ui/Button'
import { TextInput, Textarea } from '../ui/FormFields'
import { Modal } from '../ui/Modal'

type RequirementEditModalProps = {
  requirement: JobRequirement | null
  onClose: () => void
  onSave: (requirement: JobRequirement) => void
}

export function RequirementEditModal({ requirement, onClose, onSave }: RequirementEditModalProps) {
  const [draft, setDraft] = useState<JobRequirement | null>(requirement)

  useEffect(() => setDraft(requirement), [requirement])

  if (!draft) return null

  const canSave = Boolean(draft.normalizedRequirement.trim() && draft.capability.trim())

  return (
    <Modal
      open={Boolean(requirement)}
      title="编辑岗位要求"
      description="修改后的内容将作为后续证据匹配和判断依据。"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button disabled={!canSave} onClick={() => onSave({ ...draft, normalizedRequirement: draft.normalizedRequirement.trim(), capability: draft.capability.trim(), status: '已修改' })}>保存修改</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Textarea
          id="edit-requirement-text"
          label="标准化岗位要求"
          required
          rows={3}
          value={draft.normalizedRequirement}
          onChange={(event) => setDraft({ ...draft, normalizedRequirement: event.target.value })}
        />
        <TextInput
          id="edit-capability"
          label="能力标签"
          required
          value={draft.capability}
          onChange={(event) => setDraft({ ...draft, capability: event.target.value })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            要求类型
            <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as JobRequirement['category'] })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              {Object.values(REQUIREMENT_CATEGORY).map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            重要程度
            <select value={draft.importance} onChange={(event) => setDraft({ ...draft, importance: event.target.value as JobRequirement['importance'] })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              {Object.values(REQUIREMENT_IMPORTANCE).map((importance) => <option key={importance} value={importance}>{importance}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          要求强度
          <select value={draft.requiredLevel} onChange={(event) => setDraft({ ...draft, requiredLevel: event.target.value as JobRequirement['requiredLevel'] })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            {Object.values(REQUIREMENT_LEVEL).map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-600">原始 JD 文本</p>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">{draft.sourceText}</p>
        </div>
      </div>
    </Modal>
  )
}

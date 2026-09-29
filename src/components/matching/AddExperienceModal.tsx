import { useEffect, useState } from 'react'
import type { JobRequirement } from '../../types/domain'
import { Button } from '../ui/Button'
import { TextInput, Textarea } from '../ui/FormFields'
import { Modal } from '../ui/Modal'

export type ExperienceSupplement = {
  experienceId: string
  action: string
  responsibility: string
  result: string
}

type AddExperienceModalProps = {
  requirement: JobRequirement | null
  experiences: Array<{ experienceId: string; experienceName: string }>
  onClose: () => void
  onSubmit: (supplement: ExperienceSupplement) => void
}

export function AddExperienceModal({ requirement, experiences, onClose, onSubmit }: AddExperienceModalProps) {
  const [draft, setDraft] = useState<ExperienceSupplement>(() => createInitialSupplement(experiences))

  useEffect(() => {
    if (requirement) setDraft(createInitialSupplement(experiences))
  }, [experiences, requirement])

  const canSubmit = Boolean(draft.experienceId && draft.action.trim() && draft.responsibility.trim())

  return (
    <Modal
      open={Boolean(requirement)}
      title="补充真实经历"
      description="确认后会生成 Fact，并更新当前岗位要求的证据映射。"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button disabled={!canSubmit} onClick={() => onSubmit({ ...draft, action: draft.action.trim(), responsibility: draft.responsibility.trim(), result: draft.result.trim() })}>提交真实经历</Button>
        </>
      }
    >
      <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
        <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3">
          <p className="text-sm font-semibold text-brand-700">当前岗位要求</p>
          <p className="mt-1 text-sm leading-6 text-brand-900">{requirement?.normalizedRequirement}</p>
        </div>

        <label className="block text-sm font-semibold text-slate-700">
          所属经历 <span className="text-red-500">*</span>
          <select value={draft.experienceId} onChange={(event) => setDraft({ ...draft, experienceId: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            {experiences.map((experience) => <option key={experience.experienceId} value={experience.experienceId}>{experience.experienceName}</option>)}
          </select>
        </label>

        <Textarea
          id="supplement-action"
          label="具体做了什么"
          required
          rows={3}
          placeholder="请描述真实完成的工作、使用的方法和过程"
          value={draft.action}
          onChange={(event) => setDraft({ ...draft, action: event.target.value })}
        />
        <TextInput
          id="supplement-responsibility"
          label="本人职责"
          required
          placeholder="例如：参与执行、负责记录整理"
          value={draft.responsibility}
          onChange={(event) => setDraft({ ...draft, responsibility: event.target.value })}
        />
        <Textarea
          id="supplement-result"
          label="真实结果（选填）"
          rows={2}
          placeholder="如有真实数据或结果可填写，没有则留空"
          value={draft.result}
          onChange={(event) => setDraft({ ...draft, result: event.target.value })}
        />

        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">请只填写真实发生的经历。系统会根据当前岗位要求更新证据关系，不会自动添加不存在的职责或结果。</p>
      </div>
    </Modal>
  )
}

function createInitialSupplement(experiences: Array<{ experienceId: string; experienceName: string }>): ExperienceSupplement {
  return { experienceId: experiences[0]?.experienceId ?? '', action: '', responsibility: '', result: '' }
}

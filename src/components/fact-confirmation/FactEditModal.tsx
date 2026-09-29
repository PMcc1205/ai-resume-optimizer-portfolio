import { useEffect, useState } from 'react'
import type { Fact } from '../../types/domain'
import { Button } from '../ui/Button'
import { TextInput, Textarea } from '../ui/FormFields'
import { Modal } from '../ui/Modal'

type FactEditModalProps = {
  fact: Fact | null
  experiences: Array<{ experienceId: string; experienceName: string }>
  onClose: () => void
  onSave: (fact: Fact) => void
}

const factTypes: Fact['type'][] = ['背景事实', '职责事实', '行动事实', '技术事实', '数字事实', '结果事实', '项目状态事实']
const projectStatuses: NonNullable<Fact['projectStatus']>[] = ['方案设计', '原型', '演示版本', '最小可行产品', '内部测试', '正式上线']

export function FactEditModal({ fact, experiences, onClose, onSave }: FactEditModalProps) {
  const [draft, setDraft] = useState<Fact | null>(fact)

  useEffect(() => setDraft(fact), [fact])

  if (!draft) return null

  const canSave = Boolean(draft.content.trim() && draft.experienceName.trim())
  const hasNumericDetail = Boolean(draft.numericDetail)

  const updateExperience = (experienceId: string) => {
    const experience = experiences.find((item) => item.experienceId === experienceId)
    if (!experience) return
    setDraft({ ...draft, experienceId, experienceName: experience.experienceName })
  }

  const save = () => {
    if (!canSave) return
    onSave({
      ...draft,
      content: draft.content.trim(),
      experienceName: draft.experienceName.trim(),
      sourceText: draft.sourceText.trim() || draft.content.trim(),
      previousContent: fact?.content,
      requiresConfirmation: false,
      status: '已确认',
    })
  }

  return (
    <Modal
      open={Boolean(fact)}
      title={fact?.status === '信息不足' ? '补充事实信息' : '修改事实'}
      description="请确认或修改真实信息。保存后将用于岗位匹配和 AI 改写。"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button disabled={!canSave} onClick={save}>保存并确认</Button>
        </>
      }
    >
      <div className="max-h-[62vh] space-y-5 overflow-y-auto pr-1">
        <Textarea
          id="edit-fact-content"
          label="事实内容"
          required
          rows={3}
          value={draft.content}
          onChange={(event) => setDraft({ ...draft, content: event.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            事实类型
            <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Fact['type'] })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              {factTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            所属经历
            <select value={draft.experienceId} onChange={(event) => updateExperience(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              {experiences.length > 0
                ? experiences.map((experience) => <option key={experience.experienceId} value={experience.experienceId}>{experience.experienceName}</option>)
                : <option value={draft.experienceId}>{draft.experienceName}</option>}
            </select>
          </label>
        </div>

        {draft.projectStatus && (
          <label className="block text-sm font-semibold text-slate-700">
            项目状态
            <select
              value={draft.projectStatus}
              onChange={(event) => {
                const projectStatus = event.target.value as NonNullable<Fact['projectStatus']>
                setDraft({ ...draft, projectStatus, content: `${draft.experienceName}当前处于${projectStatus}阶段。` })
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {projectStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">项目状态只使用统一阶段选项，演示版本不会自动升级为正式上线。</span>
          </label>
        )}

        {hasNumericDetail && draft.numericDetail && (
          <div>
            <p className="text-sm font-semibold text-slate-700">数字信息</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <TextInput id="edit-fact-value" label="数值" value={draft.numericDetail.value} onChange={(event) => setDraft({ ...draft, numericDetail: { ...draft.numericDetail!, value: event.target.value } })} />
              <TextInput id="edit-fact-unit" label="单位" value={draft.numericDetail.unit} onChange={(event) => setDraft({ ...draft, numericDetail: { ...draft.numericDetail!, unit: event.target.value } })} />
              <TextInput id="edit-fact-metric" label="指标" value={draft.numericDetail.metric} onChange={(event) => setDraft({ ...draft, numericDetail: { ...draft.numericDetail!, metric: event.target.value } })} />
            </div>
          </div>
        )}

        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-600">原始来源（修改前）</p>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">{draft.sourceText}</p>
          <p className="mt-1 text-xs text-slate-500">{draft.sourceLocation}</p>
        </div>
      </div>
    </Modal>
  )
}

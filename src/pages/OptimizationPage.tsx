import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Edit3, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageTitle } from '../components/layout/PageTitle'
import { TaskLayout } from '../components/layout/TaskLayout'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { EmptyState } from '../components/ui/FeedbackStates'
import { Modal } from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/StatusBadge'
import { ManualRewriteModal } from '../components/optimization/ManualRewriteModal'
import { DEMO_TASK_ID, ROUTES } from '../constants/routes'
import { DIAGNOSIS_SOURCE_KEY, DIAGNOSIS_STATE_KEY, FACTS_SOURCE_KEY, MAPPINGS_SOURCE_KEY, MATCH_GAP_SOURCE_KEY, OPTIMIZATION_SELECTION_KEY, OPTIMIZATION_STATE_KEY, REWRITE_INPUT_KEY, REWRITE_SOURCE_KEY, TASK_INPUT_STATE_KEY } from '../constants/storage'
import { generateRewriteSuggestions, rewriteSnapshot, RewriteError, type RewriteInput } from '../services/rewrite'
import { validateRewriteSuggestions, rewriteValidationSnapshot, RewriteValidationError } from '../services/rewriteValidation'
import { acceptButtonState, applyManualRewriteEdit, applyRewriteDecision, canEnterFinalResume, confirmRewriteFacts, effectiveRewriteText, hasCurrentRewriteValidation, mergeRegeneratedRewrite, mergeRewriteValidations, normalizeRewriteItems, rejectButtonState } from '../services/rewriteState'
import { diagnosisDisplayNames, stripInternalIdentifiers, validationReasonPresentation } from '../services/validationPresentation'
import type { EvidenceMapping, Fact, Gap, JobRequirement, ResumeDiagnosis, RewriteSuggestion, RewriteUserDecision, TaskInputState } from '../types/domain'
import { FACTS_STATE_KEY } from './FactConfirmationPage'
import { REQUIREMENTS_STATE_KEY } from './JobAnalysisPage'
import { GAPS_STATE_KEY, MAPPINGS_STATE_KEY } from './MatchingPage'

export function OptimizationPage() {
  const navigate = useNavigate()
  const { taskId = DEMO_TASK_ID } = useParams()
  const input = useMemo(readRewriteInput, [])
  const snapshot = input ? rewriteSnapshot(input) : ''
  const task = useMemo(() => read<TaskInputState | null>(TASK_INPUT_STATE_KEY, null), [])
  const [items, setItems] = useState<RewriteSuggestion[] | null>(() => readStoredRewrites(snapshot))
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'upstream'>(input ? items ? 'ready' : 'loading' : 'upstream')
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [sourceFact, setSourceFact] = useState<string | null>(null)
  const [editingRewrite, setEditingRewrite] = useState<RewriteSuggestion | null>(null)
  const [confirmingRewrite, setConfirmingRewrite] = useState<RewriteSuggestion | null>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [validationAttempt, setValidationAttempt] = useState(0)
  const latestRequest = useRef(0)
  const itemsRef = useRef<RewriteSuggestion[] | null>(items)

  useEffect(() => { itemsRef.current = items }, [items])

  useEffect(() => {
    if (!input) return
    const stored = readStoredRewrites(snapshot)
    if (stored) {
      itemsRef.current = stored
      setItems(stored)
      setState('ready')
      return
    }
    const requestId = ++latestRequest.current
    setState('loading')
    setError('')
    void generateRewriteSuggestions(input).then((rewrites) => {
      if (requestId !== latestRequest.current) return
      const normalized = normalizeRewriteItems(rewrites)
      persistRewrites(normalized, snapshot)
      itemsRef.current = normalized
      setItems(normalized)
      setState('ready')
    }).catch((cause: unknown) => {
      if (requestId !== latestRequest.current) return
      setError(cause instanceof RewriteError ? cause.message : 'Rewrite 生成失败，请重试。')
      setState('error')
    })
    return () => { latestRequest.current += 1 }
  }, [input, requestVersion, snapshot])

  const validationSnapshot = state === 'ready' && items && input ? rewriteValidationSnapshot({ rewrites: items, facts: input.facts, requirements: input.requirements }) : ''
  const validatedSnapshot = useRef('')
  useEffect(() => {
    if (state !== 'ready' || !items?.length || !input || !validationSnapshot || validatedSnapshot.current === validationSnapshot) return
    if (validationAttempt === 0 && items.every(hasCurrentRewriteValidation)) {
      validatedSnapshot.current = validationSnapshot
      return
    }
    const requestSnapshot = validationSnapshot
    let active = true
    setValidationError('')
    setValidationLoading(true)
    void validateRewriteSuggestions({ rewrites: items, facts: input.facts, requirements: input.requirements }).then((validations) => {
      if (!active || requestSnapshot !== rewriteValidationSnapshot({ rewrites: items, facts: input.facts, requirements: input.requirements })) return
      const byId = new Map(validations.map((validation) => [validation.rewriteId, validation]))
      setItems((current) => {
        if (!current) return current
        const next = mergeRewriteValidations(current, [...byId.values()])
        itemsRef.current = next
        sessionStorage.setItem(OPTIMIZATION_STATE_KEY, JSON.stringify(next))
        return next
      })
      validatedSnapshot.current = requestSnapshot
    }).catch((cause: unknown) => {
      if (!active) return
      setValidationError(cause instanceof RewriteValidationError ? cause.message : '事实校验失败，请重试。')
    }).finally(() => { if (active) setValidationLoading(false) })
    return () => { active = false }
  }, [state, items, input, validationSnapshot, validationAttempt])

  const updateItems = (value: RewriteSuggestion[] | ((current: RewriteSuggestion[]) => RewriteSuggestion[])) => {
    const current = itemsRef.current
    if (!current) return
    const next = typeof value === 'function' ? value(current) : value
    itemsRef.current = next
    setItems(next)
    sessionStorage.setItem(OPTIMIZATION_STATE_KEY, JSON.stringify(next))
  }

  const decide = (rewriteId: string, decision: RewriteUserDecision) => {
    updateItems((current) => applyRewriteDecision(current, rewriteId, decision))
  }

  const regenerate = async (item: RewriteSuggestion) => {
    const diagnosisIds = item.diagnosisIds?.length ? item.diagnosisIds : item.diagnosisId ? [item.diagnosisId] : []
    if (!input || regeneratingId || !diagnosisIds.length) return
    setRegeneratingId(item.rewriteId)
    setError('')
    try {
      const [regenerated] = await generateRewriteSuggestions({
        ...input,
        selectedDiagnosisIds: diagnosisIds,
        regenerateDiagnosisId: diagnosisIds[0],
        previousOptimizedText: effectiveRewriteText(item),
        existingRewrites: items?.filter((current) => current.rewriteId !== item.rewriteId && current.experienceId === item.experienceId),
      })
      if (regenerated) updateItems((current) => mergeRegeneratedRewrite(current, regenerated))
    } catch (cause) {
      setError(cause instanceof RewriteError ? cause.message : '重新生成失败，请重试。')
    } finally { setRegeneratingId(null) }
  }

  const saveManualEdit = (value: string) => {
    if (!editingRewrite) return
    updateItems((current) => applyManualRewriteEdit(current, editingRewrite.rewriteId, value))
    setEditingRewrite(null)
  }

  const confirmFacts = () => {
    if (!confirmingRewrite) return
    updateItems((current) => confirmRewriteFacts(current, confirmingRewrite.rewriteId))
    setConfirmingRewrite(null)
  }

  const activeItems = state === 'ready' ? items ?? [] : []
  const processed = activeItems.filter((item) => item.userDecision !== '待处理').length
  const canEnterResult = canEnterFinalResume(activeItems)
  const requirements = input?.requirements ?? []
  const facts = input?.facts ?? []
  const diagnoses = input?.diagnoses ?? []

  return <TaskLayout currentStep={5} maxCompletedStep={4}
    titleArea={<PageTitle eyebrow="AI 逐条优化 · 第 5 步" title="在事实边界内优化简历" description="逐条审阅真实 AI 建议，并查看每句话使用的事实来源。" />}
    footer={<div className="page-footer-actions"><Button variant="secondary" onClick={() => navigate(ROUTES.DIAGNOSIS(taskId))}><ArrowLeft className="h-4 w-4" />上一步</Button><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"><div className="text-center sm:text-right"><p className="text-sm font-semibold text-slate-600">已处理 {processed} / {activeItems.length}</p>{activeItems.some((item) => item.userDecision === '已接受' && item.validationStatus !== '校验通过') && <p className="mt-0.5 text-xs text-amber-700">已接受内容仍需事实校验，暂不能进入最终简历。</p>}</div><Button disabled={!canEnterResult} title={canEnterResult ? '查看已完成决策的优化结果' : '每条建议必须已拒绝，或已接受且校验通过'} onClick={() => { if (canEnterResult) navigate(ROUTES.RESULT(taskId)) }}>查看优化结果 <ArrowRight className="h-4 w-4" /></Button></div></div>}
  >
    <Card><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-sm font-semibold text-brand-700">当前优化任务</p><p className="mt-1 text-xl font-semibold tracking-tight text-ink">{task?.jobTitle || '未填写岗位名称'}</p></div><div className="flex items-center gap-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><span className="text-sm text-slate-500">Rewrite <strong className="ml-1 text-xl text-ink">{activeItems.length || '—'}</strong></span><span className="text-sm text-slate-500">覆盖 Diagnosis <strong className="ml-1 text-xl text-ink">{input?.selectedDiagnosisIds.length ?? 0}</strong></span></div></CardContent></Card>
    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">本页改写会基于当前有效文本和已确认 Fact 自动进行生成后事实校验；只有“已接受 + 校验通过”才会进入最终简历。</div>
    {validationLoading && state === 'ready' && <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" role="status">正在校验当前改写中的职责、数字、项目状态和结果事实…</div>}
    {state === 'upstream' && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">当前没有有效的真实 Diagnosis 或可优化选择，请返回问题诊断页。</div>}
    {state === 'loading' && <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700" role="status">正在根据真实 Diagnosis 与 Fact 白名单生成改写建议…</div>}
    {(error || validationError) && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error || validationError}</span>{state === 'error' ? <Button variant="secondary" onClick={() => setRequestVersion((value) => value + 1)}>重试 Rewrite</Button> : validationError ? <Button variant="secondary" onClick={() => setValidationAttempt((value) => value + 1)}>重试事实校验</Button> : null}</div>}
    {state === 'ready' && <div className="mt-5 space-y-5">{activeItems.map((item, index) => <RewriteCard key={item.rewriteId} item={item} index={index} requirements={requirements} diagnoses={diagnoses} facts={facts} regenerating={regeneratingId === item.rewriteId} onDecision={(decision) => decide(item.rewriteId, decision)} onRegenerate={() => void regenerate(item)} onEdit={() => setEditingRewrite(item)} onConfirm={() => setConfirmingRewrite(item)} onSource={setSourceFact} />)}</div>}
    {state === 'ready' && activeItems.length === 0 && <EmptyState title="没有可生成的改写建议" description="事实缺口、能力缺失或未允许优化的 Diagnosis 不会进入 Rewrite。" />}
    <Modal open={Boolean(sourceFact)} title="Fact 来源" description="查看这条改写实际引用的真实事实。" onClose={() => setSourceFact(null)} footer={<Button onClick={() => setSourceFact(null)}>关闭</Button>}>{sourceFact && (() => { const fact = facts.find((item) => item.factId === sourceFact); return fact ? <div className="space-y-3 text-sm"><p className="font-mono font-semibold text-brand-700">{fact.factId.toUpperCase()}</p><p className="rounded-xl border border-slate-200 bg-slate-50 p-3 leading-6">{fact.content}</p><p>所属经历：{fact.experienceName}</p><p>来源：{fact.sourceLocation}</p><p>原文：{fact.sourceText}</p></div> : <p>当前 Fact 不存在。</p> })()}</Modal>
    <ManualRewriteModal rewrite={editingRewrite} facts={facts} onClose={() => setEditingRewrite(null)} onSave={saveManualEdit} />
    <Modal open={Boolean(confirmingRewrite)} title="手动确认事实声明" description="仅当你确认红色标记内容来自真实经历且表述准确时才能通过。" onClose={() => setConfirmingRewrite(null)} footer={<><Button variant="secondary" onClick={() => setConfirmingRewrite(null)}>取消</Button><Button onClick={confirmFacts}><ShieldCheck className="h-4 w-4" />确认内容真实</Button></>}>
      {confirmingRewrite && <div className="space-y-3 text-sm leading-6"><p className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">{effectiveRewriteText(confirmingRewrite)}</p><p className="text-slate-700">确认后，该版本会记录为“用户手动确认”并标记校验通过。若该项尚未接受，仍需点击“接受”才能进入优化结果。</p></div>}
    </Modal>
  </TaskLayout>
}

function RewriteCard({ item, index, requirements, diagnoses, facts, regenerating, onDecision, onRegenerate, onEdit, onConfirm, onSource }: { item: RewriteSuggestion; index: number; requirements: JobRequirement[]; diagnoses: ResumeDiagnosis[]; facts: Fact[]; regenerating: boolean; onDecision: (value: RewriteUserDecision) => void; onRegenerate: () => void; onEdit: () => void; onConfirm: () => void; onSource: (id: string) => void }) {
  const invalid = item.validationStatus === '校验不通过'
  const accepted = item.userDecision === '已接受'
  const rejected = item.userDecision === '已拒绝'
  const acceptState = acceptButtonState(item, regenerating)
  const rejectState = rejectButtonState(item, regenerating)
  const diagnosisIds = item.diagnosisIds?.length ? item.diagnosisIds : item.diagnosisId ? [item.diagnosisId] : []
  const manual = Boolean(item.editedText)
  const currentText = effectiveRewriteText(item)
  const issueNames = diagnosisDisplayNames(diagnosisIds, diagnoses, requirements)
  const validationMessage = validationReasonPresentation(item.validation?.reason, item.validation?.unsupportedClaims)
  const linkedRequirements = item.requirementIds.map((id) => requirements.find((requirement) => requirement.requirementId === id)).filter((requirement): requirement is JobRequirement => Boolean(requirement))
  const linkedFacts = item.usedFactIds.map((id) => facts.find((fact) => fact.factId === id)).filter((fact): fact is Fact => Boolean(fact))
  return <Card data-diagnosis-id={diagnosisIds.join(',')} className={accepted ? 'border-emerald-300 ring-2 ring-emerald-100' : rejected ? 'border-slate-300 bg-slate-50/30' : undefined}><CardContent className="p-0">
    <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6 ${accepted ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100'}`}><div className="flex items-center gap-3"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">建议 {index + 1}</span><span className="text-sm font-semibold text-slate-600">第 {index + 1} 条优化建议</span></div><div className="flex flex-wrap items-center gap-2">{manual && <span className="inline-flex min-h-7 items-center rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200 sm:text-sm">手动修改</span>}<StatusBadge status={item.validationStatus} /><span className={`inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset sm:text-sm ${accepted ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : rejected ? 'bg-slate-100 text-slate-700 ring-slate-300' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>{item.userDecision}</span></div></div>
    <div className="p-5 sm:p-6"><div className="grid gap-4 lg:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5"><p className="metadata-label">原始简历内容</p><p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-700">{item.originalText}</p></section><section className={`rounded-xl border p-4 sm:p-5 ${invalid ? 'border-red-300 bg-red-50/60' : manual ? 'border-violet-200 bg-violet-50/50' : 'border-brand-200 bg-brand-50/60'}`}><p className={`metadata-label ${invalid ? 'text-red-700' : manual ? 'text-violet-700' : 'text-brand-700'}`}>{manual ? '我的修改版本' : 'AI 优化版本'}</p><p className={`mt-2 whitespace-pre-wrap text-base font-medium leading-7 ${invalid ? 'text-red-900' : 'text-ink'}`}>{invalid ? highlightUnsupportedText(currentText, item.validation?.unsupportedClaims ?? []) : currentText}</p>{invalid && <p className="mt-2 text-xs font-medium text-red-700">红色文字表示未能从已确认 Fact 中追溯的内容。</p>}{manual && <p className="mt-2 text-xs text-slate-500">AI 原始 Rewrite 已保留，可在“手动修改”中对照查看。</p>}</section></div>
      {invalid && <section className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-semibold text-red-900">{validationMessage.title}</p><p className="mt-1 text-sm leading-6 text-red-800">{validationMessage.explanation}</p>{issueNames.length > 0 && <div className="mt-3"><p className="text-xs font-semibold text-red-800">涉及问题</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-red-800">{issueNames.map((name) => <li key={name}>{name}</li>)}</ul></div>}</section>}
      <details className="detail-disclosure mt-4 group"><summary className="detail-summary"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />查看详细依据</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary><div className="grid gap-4 border-t border-slate-200 px-4 py-4 lg:grid-cols-2"><Info title="涉及问题">{issueNames.map((name) => <span key={name} className="mr-2 inline-block rounded-lg bg-white px-2.5 py-1.5 text-sm ring-1 ring-slate-200">{name}</span>)}</Info><Info title="对应岗位要求">{linkedRequirements.length ? linkedRequirements.map((requirement) => <p key={requirement.requirementId}>{requirement.normalizedRequirement}</p>) : <p>当前岗位要求信息暂不可用。</p>}</Info><Info title="原始事实">{linkedFacts.length ? linkedFacts.map((fact, factIndex) => <button key={fact.factId} type="button" onClick={() => onSource(fact.factId)} className="mb-2 block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left text-sm text-emerald-900 transition hover:bg-emerald-50"><span className="font-semibold">事实来源 {factIndex + 1}</span><span className="mt-1 block text-slate-700">{fact.content}</span></button>) : <p>当前没有可展示的事实来源。</p>}</Info><Info title="有问题的优化内容">{item.validation?.unsupportedClaims?.length ? item.validation.unsupportedClaims.map((claim) => <p key={claim} className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-red-800">{claim}</p>) : <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{currentText}</p>}</Info><Info title="具体校验原因"><p className="font-medium text-slate-800">{validationMessage.title}</p><p className="mt-1">{validationMessage.explanation}</p></Info><Info title="优化目的">{stripInternalIdentifiers(item.reason)}</Info><p className="lg:col-span-2 border-t border-slate-200 pt-3 text-xs text-slate-400">内部编号：{diagnosisIds.map((id) => id.toUpperCase()).join('、')}；{item.rewriteId.toUpperCase()}；{item.usedFactIds.map((id) => id.toUpperCase()).join('、')}</p></div></details>
    </div>
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6"><div className="flex flex-wrap gap-2"><Button disabled={acceptState.disabled} title={acceptState.title} aria-label={acceptState.label} className={accepted ? 'border-emerald-600 bg-emerald-600 text-white disabled:border-emerald-600 disabled:bg-emerald-600 disabled:text-white disabled:opacity-100' : invalid && rejected ? 'border-red-300 bg-red-100 text-red-800 disabled:border-red-300 disabled:bg-red-100 disabled:text-red-800 disabled:opacity-100' : undefined} onClick={() => onDecision('已接受')}><Check className="h-4 w-4" />{acceptState.label}</Button><Button variant="secondary" disabled={regenerating} onClick={onEdit}><Edit3 className="h-4 w-4" />手动修改</Button><Button variant="ghost" disabled={regenerating} onClick={onRegenerate}><RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />{regenerating ? '生成中' : '重新生成'}</Button>{invalid && <Button variant="secondary" disabled={regenerating} onClick={onConfirm}><ShieldCheck className="h-4 w-4" />手动确认事实</Button>}<Button variant="ghost" disabled={rejectState.disabled} title={rejectState.title} className={rejected ? 'border-slate-300 bg-slate-200 text-slate-700 disabled:opacity-100' : 'text-slate-500'} onClick={() => onDecision('已拒绝')}>{rejected ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}{rejectState.label}</Button></div>{invalid && <p className="mt-2 text-sm font-medium text-red-700" role="status" aria-live="polite">该版本存在未通过的事实声明，请手动修改、重新生成，或在确认内容真实后手动通过。</p>}{item.validation?.confirmationMode === 'user-confirmed' && <p className="mt-2 text-sm font-medium text-emerald-700">该版本已由用户手动确认事实。</p>}{manual && item.validationStatus === '待事实校验' && <p className="mt-2 text-sm font-medium text-violet-700" role="status" aria-live="polite">修改已保存，正在等待当前版本的事实校验。</p>}{accepted && item.validationStatus === '待事实校验' && <p className="mt-2 text-sm font-medium text-amber-700" role="status" aria-live="polite">已接受该优化，但仍在等待事实校验，暂不能进入最终简历。</p>}{accepted && item.validationStatus === '校验通过' && <p className="mt-2 text-sm font-medium text-emerald-700" role="status" aria-live="polite">已接受且事实校验通过，将采用当前有效优化文本。</p>}{accepted && invalid && <p className="mt-2 text-sm font-medium text-red-700" role="status" aria-live="polite">已接受，但事实校验未通过，暂不能进入最终简历。</p>}{rejected && <p className="mt-2 text-sm font-medium text-slate-600" role="status" aria-live="polite">已拒绝该优化，最终简历将保留原始内容；事实校验状态保持不变。</p>}</div>
  </CardContent></Card>
}

function Info({ title, children }: { title: string; children: React.ReactNode }) { return <section><p className="metadata-label">{title}</p><div className="mt-2 text-sm leading-6 text-slate-700">{children}</div></section> }
function highlightUnsupportedText(text: string, unsupportedClaims: string[]): React.ReactNode {
  const claims = unsupportedClaims.filter((claim) => typeof claim === 'string' && claim.trim()).sort((a, b) => b.length - a.length)
  if (!claims.length) return <span className="rounded bg-red-100 px-1 text-red-900">{text}</span>
  const escaped = claims.map((claim) => claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const matcher = new RegExp(`(${escaped.join('|')})`, 'g')
  return text.split(matcher).map((part, index) => claims.includes(part)
    ? <mark key={`${part}-${index}`} className="rounded bg-red-200 px-0.5 text-red-950" title="事实校验未通过">{part}</mark>
    : <span key={`${part}-${index}`}>{part}</span>)
}
function read<T>(key: string, fallback: T): T { try { const value = sessionStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }

function readRewriteInput(): RewriteInput | null {
  if (sessionStorage.getItem(DIAGNOSIS_SOURCE_KEY) !== 'real-ai' || sessionStorage.getItem(FACTS_SOURCE_KEY) !== 'real-ai' || sessionStorage.getItem(MAPPINGS_SOURCE_KEY) !== 'real-ai' || sessionStorage.getItem(MATCH_GAP_SOURCE_KEY) !== 'rules-v1') return null
  const diagnoses = read<ResumeDiagnosis[]>(DIAGNOSIS_STATE_KEY, [])
  const selected = read<string[]>(OPTIMIZATION_SELECTION_KEY, [])
  const requirements = read<JobRequirement[]>(REQUIREMENTS_STATE_KEY, [])
  const mappings = read<EvidenceMapping[]>(MAPPINGS_STATE_KEY, [])
  const gaps = read<Gap[]>(GAPS_STATE_KEY, [])
  const facts = read<Fact[]>(FACTS_STATE_KEY, [])
  const selectedDiagnosisIds = selected.filter((id) => diagnoses.some((item) => item.diagnosisId === id && item.optimizable === true && item.skipped !== true))
  if (!selectedDiagnosisIds.length || !requirements.length || !mappings.length || !gaps.length || !facts.length) return null
  return { diagnoses, requirements, mappings, gaps, facts, selectedDiagnosisIds }
}

function readStoredRewrites(snapshot: string): RewriteSuggestion[] | null {
  if (!snapshot || sessionStorage.getItem(REWRITE_SOURCE_KEY) !== 'real-ai' || sessionStorage.getItem(REWRITE_INPUT_KEY) !== snapshot) return null
  const saved = read<RewriteSuggestion[]>(OPTIMIZATION_STATE_KEY, [])
  if (!saved.length) return null
  const normalized = normalizeRewriteItems(saved)
  sessionStorage.setItem(OPTIMIZATION_STATE_KEY, JSON.stringify(normalized))
  return normalized
}

function persistRewrites(items: RewriteSuggestion[], snapshot: string) {
  sessionStorage.setItem(OPTIMIZATION_STATE_KEY, JSON.stringify(items))
  sessionStorage.setItem(REWRITE_INPUT_KEY, snapshot)
  sessionStorage.setItem(REWRITE_SOURCE_KEY, 'real-ai')
}

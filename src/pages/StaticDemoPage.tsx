import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FileCheck2,
  FileText,
  Home,
  Info,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const steps = ['岗位解析', '事实确认', '匹配分析', '问题诊断', 'AI 优化', '优化结果']

const requirements = [
  { title: 'AI 产品需求与方案设计', level: '核心要求', source: '负责 AI 产品需求分析、方案设计与迭代落地', category: '产品能力' },
  { title: '用户研究与问题洞察', level: '核心要求', source: '结合用户场景识别核心需求', category: '用户研究' },
  { title: '大语言模型能力边界理解', level: '核心要求', source: '理解大语言模型基本原理与能力边界', category: 'AI 能力' },
  { title: '跨团队协作推进', level: '一般要求', source: '推动算法、设计和研发协作', category: '通用能力' },
  { title: 'Agent 产品实践', level: '加分项', source: '有 Agent 产品实践优先', category: 'AI 实践' },
]

const initialFacts = [
  { id: 1, title: '完成 AI 简历工具的需求梳理与核心流程设计', source: '个人项目 · 项目经历第 1 条', risk: '低风险', checked: true },
  { id: 2, title: '参与课程项目用户访谈并整理需求', source: '智能知识助手 · 项目经历第 2 条', risk: '需确认职责', checked: true },
  { id: 3, title: '在 RAG 方案设计中分析过模型能力边界', source: '智能知识助手 · 项目经历第 1 条', risk: '低风险', checked: true },
  { id: 4, title: '没有 Agent 项目实践', source: '演示用户补充确认', risk: '用户确认', checked: true },
]

const mappings = [
  { requirement: 'AI 产品需求与方案设计', status: '满足', strength: '强支持', fact: '完成需求梳理、证据映射与核心流程原型设计', reason: '存在完整、可追溯的产品方案实践。' },
  { requirement: '用户研究与问题洞察', status: '部分满足', strength: '部分支持', fact: '参与课程项目用户访谈并整理需求', reason: '能证明参与，但不足以证明独立负责用户研究。' },
  { requirement: '大语言模型能力边界理解', status: '满足', strength: '强支持', fact: '在 RAG 方案中分析模型能力边界', reason: '有具体项目语境，不只停留在概念了解。' },
  { requirement: 'Agent 产品实践', status: '未满足', strength: '无有效支持', fact: '用户确认没有相关实践', reason: '保持真实差距，不通过改写制造经历。' },
]

const diagnoses = [
  { priority: '高', type: '表达过于泛化', original: '负责 AI 简历优化助手产品设计', problem: '没有呈现具体用户问题、核心机制和本人行动。', action: '使用已确认事实补充需求梳理、证据映射和流程设计。', permission: '可直接改写' },
  { priority: '高', type: '职责边界不清', original: '参与用户访谈及需求整理', problem: '当前事实只支持参与，不能证明独立负责。', action: '强化真实参与动作，但保留“参与”的职责等级。', permission: '有限改写' },
  { priority: '高', type: '能力缺失', original: '暂无 Agent 项目实践', problem: '用户已明确确认没有相关经历。', action: '保留能力差距，不生成不存在的 Agent 项目。', permission: '不可改写' },
]

const rewrites = [
  {
    id: 1,
    original: '负责 AI 简历优化助手产品设计',
    optimized: '围绕求职者岗位针对性与真实性风险，完成 AI 简历优化助手的需求梳理、证据映射与核心流程原型设计。',
    reason: '补充已确认的用户问题、核心机制与具体行动，没有新增结果或职责等级。',
    facts: ['需求梳理', '证据映射', '核心流程原型'],
  },
  {
    id: 2,
    original: '参与用户访谈及需求整理',
    optimized: '参与课程项目用户访谈，整理高频需求与使用障碍，为知识助手的功能设计提供输入。',
    reason: '增强行动与用途，但保留“参与”边界，未升级为独立负责或主导。',
    facts: ['参与访谈', '整理需求', '课程项目'],
  },
]

type Decision = 'accepted' | 'original'

function Pill({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

function StepOne() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-semibold text-slate-500">演示目标岗位</p><div className="mt-4 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><BriefcaseBusiness className="h-5 w-5" /></span><div><h3 className="font-bold text-ink">AI 产品经理（校招）</h3><p className="mt-1 text-xs text-slate-500">虚构公司 · 固定 JD</p></div></div><p className="mt-5 text-sm leading-6 text-slate-600">负责 AI 产品需求分析、方案设计与迭代落地；结合用户场景识别需求；理解大语言模型能力边界；推动算法、设计和研发协作。有 Agent 产品实践优先。</p></div>
        <div className="space-y-3">{requirements.map((item, index) => <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{item.title}</h3><Pill tone={item.level === '核心要求' ? 'green' : item.level === '加分项' ? 'blue' : 'slate'}>{item.level}</Pill><Pill>{item.category}</Pill></div><p className="mt-2 text-sm text-slate-500">原文：{item.source}</p></div></div></article>)}</div>
      </div>
    </div>
  )
}

function StepTwo({ facts, onToggle }: { facts: typeof initialFacts; onToggle: (id: number) => void }) {
  return (
    <div>
      <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><div className="flex gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0" /><p>请确认哪些事实可以进入后续匹配。演示中的所有信息均为虚构固定内容，不包含真实简历或个人隐私。</p></div></div>
      <div className="grid gap-4 md:grid-cols-2">{facts.map((fact) => <button key={fact.id} onClick={() => onToggle(fact.id)} className={`rounded-2xl border p-5 text-left transition ${fact.checked ? 'border-brand-300 bg-brand-50/60 shadow-sm' : 'border-slate-200 bg-white opacity-70'}`}><div className="flex items-start gap-4"><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${fact.checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'}`}>{fact.checked && <Check className="h-4 w-4" />}</span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold leading-6 text-ink">{fact.title}</h3><Pill tone={fact.risk.includes('确认') ? 'amber' : 'green'}>{fact.risk}</Pill></div><p className="mt-3 text-xs text-slate-500">来源：{fact.source}</p></div></div></button>)}</div>
    </div>
  )
}

function StepThree() {
  return (
    <div className="space-y-4">{mappings.map((item) => <article key={item.requirement} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold text-slate-400">岗位要求</p><h3 className="mt-1 font-bold text-ink">{item.requirement}</h3></div><div className="flex gap-2"><Pill tone={item.status === '满足' ? 'green' : item.status === '未满足' ? 'red' : 'amber'}>{item.status}</Pill><Pill>{item.strength}</Pill></div></div><div className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-2"><div><p className="text-xs font-semibold text-slate-400">支持事实</p><p className="mt-2 text-sm leading-6 text-slate-700">{item.fact}</p></div><div><p className="text-xs font-semibold text-slate-400">判断理由</p><p className="mt-2 text-sm leading-6 text-slate-700">{item.reason}</p></div></div></article>)}</div>
  )
}

function StepFour() {
  return (
    <div className="space-y-4">{diagnoses.map((item) => <article key={item.type} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center gap-2"><Pill tone="red">{item.priority}优先级</Pill><Pill tone={item.permission === '不可改写' ? 'red' : item.permission === '有限改写' ? 'amber' : 'green'}>{item.permission}</Pill></div><h3 className="mt-4 text-lg font-bold text-ink">{item.type}</h3><p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">原文：{item.original}</p><div className="mt-4 grid gap-4 md:grid-cols-2"><div><p className="text-xs font-semibold text-slate-400">问题诊断</p><p className="mt-2 text-sm leading-6 text-slate-700">{item.problem}</p></div><div><p className="text-xs font-semibold text-slate-400">下一步动作</p><p className="mt-2 text-sm leading-6 text-slate-700">{item.action}</p></div></div></article>)}</div>
  )
}

function StepFive({ decisions, setDecision }: { decisions: Record<number, Decision>; setDecision: (id: number, decision: Decision) => void }) {
  return (
    <div className="space-y-5">
      {rewrites.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid lg:grid-cols-2"><div className="border-b border-slate-200 bg-slate-50 p-5 lg:border-b-0 lg:border-r sm:p-6"><p className="text-xs font-semibold text-slate-400">原始表述</p><p className="mt-4 text-sm leading-7 text-slate-700">{item.original}</p></div><div className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-brand-700">固定演示优化建议</p><Pill tone="green">事实校验通过</Pill></div><p className="mt-4 text-sm font-medium leading-7 text-ink">{item.optimized}</p></div></div><div className="border-t border-slate-200 p-5 sm:p-6"><details className="group"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-600"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-600" />查看事实校验依据</span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary><div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4"><p className="text-sm leading-6 text-brand-900">{item.reason}</p><div className="mt-3 flex flex-wrap gap-2">{item.facts.map((fact) => <Pill key={fact} tone="green">{fact}</Pill>)}</div></div></details><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button onClick={() => setDecision(item.id, 'accepted')} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition ${decisions[item.id] === 'accepted' ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}><Check className="h-4 w-4" />接受优化</button><button onClick={() => setDecision(item.id, 'original')} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition ${decisions[item.id] === 'original' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}><X className="h-4 w-4" />保留原文</button></div></div></article>)}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="font-semibold text-amber-950">Agent 经历不进入改写列表</p><p className="mt-1 text-sm leading-6 text-amber-800">事实已确认不存在，系统保留能力差距，不通过生成制造岗位匹配。</p></div></div></div>
    </div>
  )
}

function StepSix({ decisions }: { decisions: Record<number, Decision> }) {
  const accepted = rewrites.filter((item) => decisions[item.id] === 'accepted').length
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm"><p className="text-3xl font-bold text-ink">{rewrites.length}</p><p className="mt-1 text-xs text-slate-500">已审阅建议</p></div><div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-center"><p className="text-3xl font-bold text-brand-700">{accepted}</p><p className="mt-1 text-xs text-brand-700">采用优化</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm"><p className="text-3xl font-bold text-ink">{rewrites.length - accepted}</p><p className="mt-1 text-xs text-slate-500">保留原文</p></div></div>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold text-brand-700">最终简历片段 · 虚构演示</p><h3 className="mt-2 text-xl font-bold text-ink">AI 产品项目经历</h3></div><Pill tone="green"><span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />均已通过事实校验</span></Pill></div><div className="mt-6 space-y-5">{rewrites.map((item) => <div key={item.id} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" /><p className="text-sm leading-7 text-slate-700">{decisions[item.id] === 'accepted' ? item.optimized : item.original}</p></div>)}</div><div className="mt-7 rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">仍需通过真实经历补足</p><p className="mt-2 text-sm leading-6 text-slate-700">Agent 产品实践当前未满足；简历优化不能替代真实能力建设。</p></div></div>
    </div>
  )
}

export function StaticDemoPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [facts, setFacts] = useState(initialFacts)
  const [decisions, setDecisions] = useState<Record<number, Decision>>({ 1: 'accepted', 2: 'accepted' })

  const confirmedCount = useMemo(() => facts.filter((fact) => fact.checked).length, [facts])
  const reset = () => {
    setCurrentStep(0)
    setFacts(initialFacts)
    setDecisions({ 1: 'accepted', 2: 'accepted' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const goTo = (step: number) => {
    setCurrentStep(Math.max(0, Math.min(steps.length - 1, step)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <header className="border-b border-slate-800 bg-ink text-white">
        <div className="mx-auto flex h-[64px] max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8"><Link to="/" className="flex items-center gap-3 font-semibold"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-brand-500"><FileCheck2 className="h-5 w-5" /></span><span>AI 简历优化助手</span></Link><div className="flex items-center gap-2"><button onClick={reset} className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 sm:flex"><RotateCcw className="h-4 w-4" />重新体验</button><Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"><Home className="h-4 w-4" /><span className="hidden sm:inline">返回作品集</span></Link></div></div>
      </header>
      <div className="border-b border-amber-200 bg-amber-50"><div className="mx-auto flex max-w-[1320px] items-center gap-3 px-4 py-3 text-sm text-amber-900 sm:px-6 lg:px-8"><CircleAlert className="h-5 w-5 shrink-0 text-amber-700" /><p><strong>演示数据，非实时模型生成。</strong> 本页不调用 DeepSeek 或后端，不包含 API Key、真实简历或用户隐私数据。</p></div></div>

      <main className="mx-auto max-w-[1320px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-brand-700">STATIC INTERACTIVE DEMO</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{steps[currentStep]}</h1><p className="mt-2 text-sm text-slate-500">虚构求职者 · AI 产品经理岗位 · 固定演示任务</p></div><div className="flex items-center gap-2 text-xs text-slate-500"><FileText className="h-4 w-4" />已确认 {confirmedCount}/{facts.length} 条演示事实</div></div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-card"><ol className="flex min-w-[760px] items-center">{steps.map((step, index) => <li key={step} className="flex flex-1 items-center"><button onClick={() => goTo(index)} className="group flex items-center gap-3 text-left"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold transition ${index === currentStep ? 'border-brand-600 bg-brand-600 text-white' : index < currentStep ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-400'}`}>{index < currentStep ? <Check className="h-4 w-4" /> : index + 1}</span><span className={`text-xs font-semibold ${index === currentStep ? 'text-ink' : 'text-slate-500'}`}>{step}</span></button>{index < steps.length - 1 && <span className={`mx-3 h-px flex-1 ${index < currentStep ? 'bg-brand-300' : 'bg-slate-200'}`} />}</li>)}</ol></div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-7 lg:p-8">
          {currentStep === 0 && <StepOne />}
          {currentStep === 1 && <StepTwo facts={facts} onToggle={(id) => setFacts((current) => current.map((fact) => fact.id === id ? { ...fact, checked: !fact.checked } : fact))} />}
          {currentStep === 2 && <StepThree />}
          {currentStep === 3 && <StepFour />}
          {currentStep === 4 && <StepFive decisions={decisions} setDecision={(id, decision) => setDecisions((current) => ({ ...current, [id]: decision }))} />}
          {currentStep === 5 && <StepSix decisions={decisions} />}
        </section>

        <div className="mt-6 flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center"><button disabled={currentStep === 0} onClick={() => goTo(currentStep - 1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="h-4 w-4" />上一步</button>{currentStep < steps.length - 1 ? <button onClick={() => goTo(currentStep + 1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">继续：{steps[currentStep + 1]}<ArrowRight className="h-4 w-4" /></button> : <div className="flex flex-col gap-3 sm:flex-row"><button onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"><RotateCcw className="h-4 w-4" />重新体验</button><Link to="/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white">返回作品集<ArrowRight className="h-4 w-4" /></Link></div>}</div>
      </main>
    </div>
  )
}

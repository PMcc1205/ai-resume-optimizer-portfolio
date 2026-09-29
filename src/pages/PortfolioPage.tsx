import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleUserRound,
  FileCheck2,
  GitCompareArrows,
  Layers3,
  LockKeyhole,
  Menu,
  Quote,
  Route,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UsersRound,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import matchingScreenshot from '../../portfolio/screenshots/证据匹配_1440.png'
import diagnosisScreenshot from '../../portfolio/screenshots/缺口诊断_1440.png'
import rewriteScreenshot from '../../portfolio/screenshots/事实改写_1440.png'

const navItems = [
  { label: '项目概览', id: 'overview' },
  { label: '核心机制', id: 'mechanism' },
  { label: 'AI Evaluation', id: 'evaluation' },
  { label: '项目反思', id: 'reflection' },
]

const mechanisms = [
  { index: '01', title: 'JD 解析', copy: '把非结构化岗位描述拆成可确认的岗位要求，保留原文来源与能力层级。' },
  { index: '02', title: '事实结构化', copy: '从简历提取原子事实，绑定原文、所属经历、风险和用户确认状态。' },
  { index: '03', title: '证据映射', copy: '连接岗位要求与真实事实；关键词只召回候选，不直接等于匹配。' },
  { index: '04', title: '缺口分类', copy: '区分表达缺口、事实缺口、能力程度不足与能力缺失。' },
  { index: '05', title: '事实约束改写', copy: '只允许重组和强化已有事实，不新增职责、数字、技术或结果。' },
  { index: '06', title: '生成后校验', copy: '逐条声明核对支持事实；未通过的文本不能进入最终结果。' },
]

const constraints = [
  ['职责', '参与', '主导'],
  ['能力', '熟悉', '精通'],
  ['阶段', 'MVP', '正式上线'],
  ['数字', '无量化结果', '新增提升 30%'],
  ['技术', '无相关实践', '新增技术经历'],
  ['归属', '项目 A 事实', '迁移到项目 B'],
]

const evalRows = [
  { label: '正常案例', total: 12, v1: 11, v2: 12 },
  { label: '单风险案例', total: 17, v1: 8, v2: 13 },
  { label: '多风险完整匹配', total: 7, v1: 3, v2: 4 },
  { label: '边界案例', total: 16, v1: 11, v2: 15 },
  { label: '对抗案例', total: 9, v1: 2, v2: 6 },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="portfolio-eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-ink sm:text-4xl">{title}</h2>
      {copy && <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{copy}</p>}
    </div>
  )
}

export function PortfolioPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-ink">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <button className="flex items-center gap-3 text-left" onClick={() => scrollTo('top')} aria-label="回到顶部">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white"><FileCheck2 className="h-5 w-5" /></span>
            <span><span className="block text-sm font-bold">AI 简历优化助手</span><span className="block text-[11px] text-slate-500">PRODUCT CASE STUDY</span></span>
          </button>
          <nav className="hidden items-center gap-1 md:flex" aria-label="作品集导航">
            {navItems.map((item) => <button key={item.id} onClick={() => scrollTo(item.id)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-ink">{item.label}</button>)}
          </nav>
          <div className="hidden md:block"><Link to="/demo" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">体验 Demo<ArrowRight className="h-4 w-4" /></Link></div>
          <button className="rounded-lg p-2 text-slate-600 md:hidden" onClick={() => setMenuOpen((value) => !value)} aria-label="打开导航">{menuOpen ? <X /> : <Menu />}</button>
        </div>
        {menuOpen && <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">{navItems.map((item) => <button key={item.id} onClick={() => { scrollTo(item.id); setMenuOpen(false) }} className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-700">{item.label}</button>)}<Link to="/demo" className="mt-2 flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">体验交互 Demo</Link></div>}
      </header>

      <main id="top">
        <section id="overview" className="relative overflow-hidden border-b border-slate-200 bg-ink text-white">
          <div className="portfolio-grid absolute inset-0 opacity-20" />
          <div className="absolute -right-28 top-6 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-[1240px] gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-32">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-brand-200"><Sparkles className="h-3.5 w-3.5" />AI PRODUCT CASE STUDY · 2026</div>
              <h1 className="mt-7 max-w-3xl text-[2.8rem] font-bold leading-[1.07] tracking-[-0.05em] sm:text-6xl lg:text-[4.4rem]">让每一次简历优化<br /><span className="text-brand-300">都有事实依据</span></h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">面向校招、实习与应届求职者的 JD 驱动型 AI 简历优化助手。通过真实经历结构化、岗位要求—证据映射和生成后事实校验，在提升岗位针对性的同时降低过度包装风险。</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link to="/demo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-400">体验交互 Demo<ArrowRight className="h-4 w-4" /></Link>
                <button onClick={() => scrollTo('research')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/10">阅读项目复盘<ArrowDown className="h-4 w-4" /></button>
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 text-brand-300" />Demo 使用固定虚构数据，不上传文件、不调用模型或后端</p>
            </div>
            <div className="relative self-center">
              <div className="absolute -left-7 -top-7 h-24 w-24 rounded-3xl border border-white/10" />
              <div className="relative rounded-[1.75rem] border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/10 pb-4"><div><p className="text-xs font-semibold text-brand-300">核心链路</p><p className="mt-1 text-sm text-slate-300">从理解岗位到可信改写</p></div><Route className="h-6 w-6 text-brand-300" /></div>
                <div className="mt-5 space-y-3">
                  {['理解岗位要求', '确认真实事实', '建立证据映射', '诊断问题类型', '约束生成并校验'].map((item, index) => <div key={item} className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-950/20 p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-xs font-bold text-brand-200">{String(index + 1).padStart(2, '0')}</span><span className="text-sm font-medium text-slate-100">{item}</span>{index < 4 ? <ChevronRight className="ml-auto h-4 w-4 text-slate-500" /> : <Check className="ml-auto h-4 w-4 text-brand-300" />}</div>)}
                </div>
              </div>
              <div className="absolute -bottom-7 -right-3 rounded-2xl border border-brand-300/30 bg-[#103d39] px-5 py-4 shadow-xl"><p className="text-2xl font-bold text-white">81.97%</p><p className="mt-1 text-xs text-brand-100">V2 冻结评测集案例通过率</p></div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[1240px] grid-cols-2 divide-x divide-y divide-slate-200 px-4 sm:grid-cols-4 sm:divide-y-0 sm:px-6 lg:px-8">
            {[['6 名','目标用户访谈'],['47 / 42','回收 / 有效问卷'],['61 条','冻结自动评测案例'],['+24.59pp','V1 → V2 提升']].map(([value,label]) => <div key={label} className="px-4 py-7 text-center"><p className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{value}</p><p className="mt-1 text-xs text-slate-500 sm:text-sm">{label}</p></div>)}
          </div>
        </section>

        <section id="research" className="portfolio-section bg-[#f6f8fb]">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="01 · 用户研究" title="用户缺的不是一句更漂亮的话" copy="研究对象是已有基础简历、正在准备校招、实习或应届求职的大学生。表面上是“不会写”，更深层的问题是岗位要求与个人证据之间缺少连接。" />
            <div className="mt-12 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
              <div className="rounded-3xl bg-ink p-7 text-white shadow-card sm:p-9"><Quote className="h-8 w-8 text-brand-300" /><blockquote className="mt-6 text-2xl font-semibold leading-relaxed tracking-[-0.02em]">“看懂岗位要求以后，我应该用自己的哪段经历证明？当前简历真的写清楚了吗？”</blockquote><p className="mt-8 border-l-2 border-brand-400 pl-4 text-sm leading-6 text-slate-300">项目最终将“简历不好写”收敛为一个可设计、可验证的问题：岗位要求与真实经历之间缺少可靠、可解释的映射。</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[['5/6','不知道面对具体 JD 应突出什么'],['5/6','不知道项目经历应该怎么写'],['4/6','不确定自己与岗位的匹配程度'],['4/6','不知道修改后是否真的更好'],['4/5','用过 AI 的用户认为建议泛化'],['3/5','用过 AI 的用户遇到事实失真']].map(([value, label]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><p className="text-2xl font-bold text-brand-700">{value}</p><p className="mt-2 text-sm leading-6 text-slate-600">{label}</p></div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="portfolio-section border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="02 · 核心判断" title="先诊断问题，再决定是否改写" copy="一次直接生成，会把表达不足、信息不足、能力不足和能力缺失混在一起。产品先判断真实支持程度，再为不同问题分配不同动作与权限。" />
            <div className="mt-12 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-card">
              <div className="grid lg:grid-cols-2">
                <div className="border-b border-slate-200 p-7 lg:border-b-0 lg:border-r sm:p-9"><p className="text-xs font-bold uppercase tracking-[.16em] text-red-600">直接生成的风险</p><div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-5 font-mono text-sm leading-7 text-red-900">JD + 简历 → 大模型直接改写</div><ul className="mt-6 space-y-4 text-sm leading-6 text-slate-600">{['把“没写”误判为“没做”','用更强文案掩盖事实不足','职责、能力和项目阶段被无依据升级'].map((item) => <li key={item} className="flex gap-3"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />{item}</li>)}</ul></div>
                <div className="bg-white p-7 sm:p-9"><p className="text-xs font-bold uppercase tracking-[.16em] text-brand-700">本项目的判断链路</p><div className="mt-5 flex flex-wrap gap-2">{['岗位要求','真实事实','证据映射','匹配状态','缺口分类','问题诊断','约束改写','事实校验'].map((item, index) => <div key={item} className="flex items-center gap-2"><span className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">{item}</span>{index < 7 && <ChevronRight className="h-4 w-4 text-slate-300" />}</div>)}</div><p className="mt-7 text-base leading-7 text-slate-600">“暂无证据”只说明当前信息不足，不等于能力缺失。只有用户补充后仍无法支持，或明确确认没有相关经历，系统才允许作出能力不足或缺失的判断。</p></div>
              </div>
            </div>
          </div>
        </section>

        <section id="mechanism" className="portfolio-section bg-[#f6f8fb]">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="03 · 核心机制" title="把“可信”设计进完整链路" copy="真实性不是提示词末尾的一句要求，而是事实对象、证据关系、改写权限、校验状态与用户决策共同组成的系统约束。" />
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{mechanisms.map((item) => <article key={item.index} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift"><div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[.15em] text-brand-600">{item.index}</span><span className="h-2 w-2 rounded-full bg-brand-300 transition group-hover:bg-brand-600" /></div><h3 className="mt-8 text-xl font-bold text-ink">{item.title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p></article>)}</div>
            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {[{icon:BrainCircuit,title:'大语言模型',tag:'理解与生成',items:['理解非结构化 JD','提取候选事实','语义匹配与诊断','生成候选改写']},{icon:Layers3,title:'规则层',tag:'稳定与约束',items:['状态与权限控制','层级与结构约束','错误处理','最终采用条件']},{icon:CircleUserRound,title:'用户',tag:'确认与决策',items:['确认事实真实性','补充或纠正经历','接受或拒绝建议','承担最终表述责任']}].map(({icon:Icon,title,tag,items}) => <div key={title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-card"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{tag}</span></div><h3 className="mt-6 text-xl font-bold">{title}</h3><ul className="mt-5 space-y-3">{items.map((item) => <li key={item} className="flex items-center gap-3 text-sm text-slate-600"><Check className="h-4 w-4 text-brand-600" />{item}</li>)}</ul></div>)}
            </div>
          </div>
        </section>

        <section className="portfolio-section overflow-hidden bg-ink text-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="portfolio-eyebrow !text-brand-300">04 · 真实性约束</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">不允许文案越过事实边界</h2><p className="mt-5 text-base leading-7 text-slate-300">生成前建立白名单，生成中限定改写权限，生成后逐条声明核验。文本变化后，旧校验结论自动失效。</p><div className="mt-7 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"><LockKeyhole className="h-5 w-5 text-brand-300" /><p className="text-sm text-slate-200">只有“用户接受 + 校验通过”的当前版本，才能进入最终结果。</p></div></div><div className="grid gap-3 sm:grid-cols-2">{constraints.map(([type,from,to]) => <div key={type} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs font-semibold text-brand-300">{type}风险</p><div className="mt-3 flex items-center gap-2 text-sm"><span className="rounded-lg bg-white/10 px-2.5 py-1.5 text-slate-200">{from}</span><ArrowRight className="h-4 w-4 text-red-300" /><span className="rounded-lg bg-red-400/10 px-2.5 py-1.5 text-red-200 line-through decoration-red-300/60">{to}</span></div></div>)}</div></div>
          </div>
        </section>

        <section className="portfolio-section bg-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><SectionHeading eyebrow="05 · 产品 Demo" title="从岗位解析到最终结果" copy="完整体验需求理解、事实确认、证据判断、问题诊断和受约束的内容优化。" /><Link to="/demo" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700">体验交互 Demo<ArrowRight className="h-4 w-4" /></Link></div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">{[{image:matchingScreenshot,number:'01',title:'证据匹配',copy:'查看每项岗位要求由哪些事实支持，以及为什么只达到当前匹配状态。'},{image:diagnosisScreenshot,number:'02',title:'问题诊断',copy:'把表达问题、事实不足和能力差距拆开，给出不同后续动作。'},{image:rewriteScreenshot,number:'03',title:'事实约束改写',copy:'对比原文与建议，查看事实校验依据，再决定接受或保留。'}].map((item) => <article key={item.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"><div className="aspect-[16/10] overflow-hidden border-b border-slate-200 bg-slate-100"><img src={item.image} alt={`${item.title}界面`} className="h-full w-full object-cover object-top transition duration-500 hover:scale-[1.02]" /></div><div className="p-5"><p className="text-xs font-bold tracking-[.12em] text-brand-600">{item.number}</p><h3 className="mt-2 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p></div></article>)}</div>
            <p className="mt-5 text-center text-xs text-slate-500">界面截图来自已完成的真实端到端演示；网页版 Demo 使用独立的固定虚构数据，不调用 DeepSeek 或后端。</p>
          </div>
        </section>

        <section id="evaluation" className="portfolio-section border-y border-slate-200 bg-[#f6f8fb]">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="06 · AI Evaluation" title="跑通流程，不等于判断可靠" copy="评测同时关注漏报与误报：既要拦截非法事实升级，也要避免误杀合法专业化表达。调优前先审计标准答案并冻结 61 条自动评测案例。" />
            <div className="mt-12 grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
              <div className="rounded-3xl bg-ink p-7 text-white shadow-lift sm:p-9"><p className="text-sm font-semibold text-brand-300">冻结评测集案例通过率</p><div className="mt-8 flex items-end gap-5"><div><p className="text-xs text-slate-400">V1 基线</p><p className="mt-1 text-4xl font-bold">57.38%</p></div><ArrowRight className="mb-3 h-6 w-6 text-slate-500" /><div><p className="text-xs text-brand-200">V2</p><p className="mt-1 text-5xl font-bold text-brand-300">81.97%</p></div></div><div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[81.97%] rounded-full bg-brand-400" /></div><p className="mt-5 text-sm leading-6 text-slate-300">提升 24.59 个百分点。数据集、标准答案、结构约束与模型配置保持不变，且没有按案例编号特判。</p><div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-6 text-center"><div><p className="text-xl font-bold">50</p><p className="mt-1 text-[11px] text-slate-400">V2 通过</p></div><div><p className="text-xl font-bold">11</p><p className="mt-1 text-[11px] text-slate-400">V2 失败</p></div><div><p className="text-xl font-bold">0</p><p className="mt-1 text-[11px] text-slate-400">执行错误</p></div></div></div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8"><div className="flex items-center justify-between"><div><h3 className="text-lg font-bold">分类型对照</h3><p className="mt-1 text-sm text-slate-500">通过案例数 / 类型总数</p></div><div className="flex gap-4 text-xs"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-slate-300" />V1</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-brand-500" />V2</span></div></div><div className="mt-8 space-y-6">{evalRows.map((row) => <div key={row.label}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-slate-700">{row.label}</span><span className="font-mono text-xs text-slate-500">{row.v1}/{row.total} → <b className="text-brand-700">{row.v2}/{row.total}</b></span></div><div className="relative h-3 overflow-hidden rounded-full bg-slate-100"><div className="absolute inset-y-0 left-0 rounded-full bg-slate-300" style={{ width: `${row.v1 / row.total * 100}%` }} /><div className="absolute inset-y-0 left-0 rounded-full bg-brand-500/85" style={{ width: `${row.v2 / row.total * 100}%` }} /></div></div>)}</div></div>
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">{[{title:'Prompt',copy:'按职责、能力、数字、技术、实验、阶段、归属和结果逐条扫描；发现风险后继续检查。'},{title:'Normalizer',copy:'仅对模型已识别的无事实支撑声明做通用类型归一化，并聚合全部声明。'},{title:'Rules + Guardrail',copy:'补充职责、能力、阶段层级规则，同时保护同义改写、保守表达和内容压缩。'}].map((item,index) => <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">0{index+1}</span><h3 className="font-bold">{item.title}</h3></div><p className="mt-4 text-sm leading-6 text-slate-600">{item.copy}</p></div>)}</div>
          </div>
        </section>

        <section className="portfolio-section bg-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="07 · 失败案例" title="“熟悉 SQL”为什么不能写成“掌握 SQL”" copy="这个案例把一次错误放行，转化成可泛化的产品规则：技能是否存在，与同一技能的能力程度，是两个必须独立检查的维度。" />
            <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch"><div className="rounded-3xl border border-slate-200 bg-slate-50 p-7"><span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">已确认事实</span><p className="mt-6 text-xl font-semibold leading-8">熟悉 SQL 基础语法，能够阅读基础查询。</p><p className="mt-6 text-sm leading-6 text-slate-500">V1 只确认了“SQL 技能存在”，没有稳定比较表达强度。</p></div><div className="hidden items-center lg:flex"><GitCompareArrows className="h-7 w-7 text-brand-600" /></div><div className="rounded-3xl border border-red-200 bg-red-50 p-7"><span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">候选改写 · 已拦截</span><p className="mt-6 text-xl font-semibold leading-8 text-red-950"><span className="rounded bg-red-200/70 px-1.5">掌握</span> SQL 基础语法，能够阅读基础查询。</p><p className="mt-6 flex gap-2 text-sm leading-6 text-red-800"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />V2 通过通用能力程度层级识别无依据升级，不绑定 SQL 或具体案例编号。</p></div></div>
          </div>
        </section>

        <section id="reflection" className="portfolio-section border-t border-slate-200 bg-[#f6f8fb]">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="08 · 项目反思" title="可信，不意味着已经完全准确" copy="V2 达到了投递版项目的收口目标，但 81.97% 只是固定冻结评测集上的案例通过率，不是覆盖所有真实场景的模型准确率。" />
            <div className="mt-12 grid gap-5 md:grid-cols-2">{[['多风险仍会漏识别','7 条多风险案例中，V2 仍有 3 条只能部分匹配。下一步应优先改善逐条声明聚合。'],['数字与指标仍需绑定','“无事实支撑数字”的召回率仍为 75%，数字不能脱离指标语义和项目归属。'],['标签优先级仍有冲突','具体违规与通用兜底标签之间仍存在误报，需要明确分类优先级，而不是继续堆关键词。'],['真实演示不等于上线','当前结果验证了核心链路可行，但没有用户增长、投递成功率或商业结果数据。']].map(([title,copy], index) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"><div className="flex gap-5"><span className="text-3xl font-bold text-slate-200">0{index+1}</span><div><h3 className="text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p></div></div></article>)}</div>
            <div className="mt-10 rounded-3xl bg-brand-700 px-6 py-9 text-white sm:px-10 lg:flex lg:items-center lg:justify-between"><div><p className="text-sm font-semibold text-brand-100">最终沉淀</p><h3 className="mt-2 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">把“感觉更好”变成可追溯、可评测、可迭代的产品结果</h3></div><Link to="/demo" className="mt-7 inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-brand-800 transition hover:bg-brand-50 lg:mt-0">进入交互 Demo<ArrowRight className="h-4 w-4" /></Link></div>
          </div>
        </section>
      </main>

      <footer className="bg-ink text-slate-400"><div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-4 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><p>AI 简历优化助手 · 产品作品集</p><p className="flex items-center gap-2"><UsersRound className="h-4 w-4" />研究数据与评测结论来自项目文档 18 / 19 / 20</p></div></footer>
    </div>
  )
}

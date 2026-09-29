import { FileCheck2, HelpCircle } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { cn } from '../../lib/cn'
import { PageContainer } from './PageContainer'

export function TopNavigation() {
  return (
    <header className="border-b border-slate-800 bg-ink text-white">
      <PageContainer className="flex h-[60px] items-center justify-between">
        <Link to={ROUTES.HOME} className="flex min-w-0 items-center gap-3 font-semibold tracking-tight" aria-label="AI 简历优化助手首页">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-brand-500 shadow-sm"><FileCheck2 className="h-5 w-5" /></span>
          <span className="whitespace-nowrap text-sm sm:text-base">AI 简历优化助手</span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="主导航">
          <NavLink to={ROUTES.NEW_TASK} className={({ isActive }) => cn('whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white', isActive && 'bg-white/10 text-white')}>新建任务</NavLink>
          <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"><HelpCircle className="h-4 w-4" />使用说明</button>
        </nav>
      </PageContainer>
    </header>
  )
}

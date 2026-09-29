import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/FeedbackStates'
import { PageContainer } from '../components/layout/PageContainer'
import { TopNavigation } from '../components/layout/TopNavigation'
import { ROUTES } from '../constants/routes'

export function NotFoundPage() {
  return <div className="min-h-screen bg-slate-50"><TopNavigation /><PageContainer className="py-16"><EmptyState title="页面不存在" description="该地址不在当前原型的页面范围内。" action={<Link to={ROUTES.HOME}><Button>返回首页</Button></Link>} /></PageContainer></div>
}

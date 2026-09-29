import { Navigate, Route, Routes } from 'react-router-dom'
import { PortfolioPage } from './pages/PortfolioPage'
import { StaticDemoPage } from './pages/StaticDemoPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PortfolioPage />} />
      <Route path="/demo" element={<StaticDemoPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

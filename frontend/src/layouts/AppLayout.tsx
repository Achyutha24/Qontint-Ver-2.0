/**
 * AppLayout — Wraps all application workspace pages.
 * Contains: AppNavbar + pt-24 padding + <Outlet />.
 * No footer.
 */
import { Outlet } from 'react-router-dom'
import AppNavbar from '../components/app/AppNavbar'
import AIAssistantWidget from '../components/automation/AIAssistantWidget'

export default function AppLayout() {
  return (
    <div className="text-[var(--text-primary)] transition-colors duration-300 min-h-screen relative">
      <AppNavbar />
      <main className="pt-24 relative h-full min-h-screen">
        <Outlet />
      </main>
      {/* Phase 7 Continuous AI Project Assistant */}
      <AIAssistantWidget />
    </div>
  )
}

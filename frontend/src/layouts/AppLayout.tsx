/**
 * AppLayout — Wraps all application workspace pages.
 *
 * Structure:
 *  NavigationProvider
 *   └─ AppNavbar (sticky clean header)
 *   └─ AppSidebar (overlay, ChatGPT-style)
 *   └─ CommandPalette (global Ctrl+K)
 *   └─ <main> (full width, pt-14 matching header height)
 *       └─ <Outlet /> (page content)
 *   └─ AIAssistantWidget (floating)
 */
import { Outlet } from 'react-router-dom'
import AppNavbar from '../components/app/AppNavbar'
import AppSidebar from '../components/navigation/AppSidebar'
import CommandPalette from '../components/navigation/CommandPalette'
import AIAssistantWidget from '../components/automation/AIAssistantWidget'
import ErrorBoundary from '../components/layout/ErrorBoundary'
import StatusBar from '../components/layout/StatusBar'
import { NavigationProvider } from '../context/NavigationContext'

export default function AppLayout() {
  return (
    <NavigationProvider>
      <div className="text-[var(--text-primary)] transition-colors duration-300 min-h-screen relative flex flex-col justify-between">
        {/* Sticky clean header */}
        <AppNavbar />

        {/* Overlay sidebar (slides from left, never resizes page) */}
        <AppSidebar />

        {/* Global Command Palette (Ctrl+K) */}
        <CommandPalette />

        {/* Page content with Error Boundary */}
        <main className="relative flex-1 min-h-[calc(100vh-6rem)]">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Enterprise Bottom Status Bar */}
        <StatusBar />

        {/* Floating AI Assistant */}
        <AIAssistantWidget />
      </div>
    </NavigationProvider>
  )
}

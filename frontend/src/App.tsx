/**
 * App — Root application component.
 *
 * Responsibilities:
 *  - BrowserRouter setup
 *  - Global UI layers: CustomCursor, ScanLine, AmbientBackground
 *  - Delegates all routing to AppRoutes
 *
 * Architecture:
 *  - Landing website: / /pricing /login /register  → LandingLayout
 *  - App workspace:   /app/*                       → AppLayout + DomainGuard
 */
import { BrowserRouter } from 'react-router-dom'
import CustomCursor from './components/CustomCursor'
import AmbientBackground from './components/ambient/AmbientBackground'
import { useTheme } from './hooks/useTheme'
import AppRoutes from './AppRoutes'
import './App.css'

function ScanLine() {
  const { theme } = useTheme()
  if (theme === 'light') return null
  return <div className="scan-line pointer-events-none" />
}

export default function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <ScanLine />
      {/* Cinematic ambient background — behind everything */}
      <AmbientBackground variant="default" opacity={0.7} />
      <div className="min-h-screen transition-colors duration-300 relative z-10">
        <AppRoutes />
      </div>
    </BrowserRouter>
  )
}

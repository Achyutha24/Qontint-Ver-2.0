// @ts-nocheck
/**
 * AppNavbar — Clean Global Enterprise Header
 *
 * Layout (left → right):
 *   ☰ Hamburger  |  Qontint Logo + Engine v1.0  |  [flex spacer]  |  ⌘K Search  |  Workspace  |  🔔  |  LIVE  |  User
 *
 * Zero nav items in header — all pages live in AppSidebar.
 * Sticky top-0, backdrop-blur, shadow appears only while scrolling.
 */
import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Network, Menu, Search, Command, User, Settings, HelpCircle, LogOut, Shield } from 'lucide-react'
import WorkspaceDropdown from '../ui/WorkspaceDropdown'
import GlobalNotificationCenter from '../automation/GlobalNotificationCenter'
import { useNavigation } from '../../context/NavigationContext'

export default function AppNavbar() {
  const navigate = useNavigate()
  const { toggleSidebar, toggleCommandPalette } = useNavigation()
  const [isScrolled, setIsScrolled] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 6)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Listen for '/' key to trigger command palette search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        toggleCommandPalette()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleCommandPalette])

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-[60] bg-[var(--bg-card)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] transition-shadow duration-200 ${
        isScrolled ? 'shadow-sm shadow-black/8' : ''
      }`}
    >
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 flex items-center gap-3 h-14">

        {/* ── Hamburger ─────────────────────────────────────────────────────── */}
        <button
          onClick={toggleSidebar}
          aria-label="Open navigation menu (Press Esc to close)"
          className="flex-none p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-depth)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aurora)]"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* ── Logo + Engine Version Badge ───────────────────────────────────── */}
        <NavLink
          to="/app/dashboard"
          aria-label="Qontint Enterprise Dashboard"
          className="flex-none flex items-center gap-2.5 no-underline group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aurora)] rounded-lg p-0.5"
        >
          <div className="w-7 h-7 flex items-center justify-center border border-[var(--aurora)] rounded-full transition-all duration-300 group-hover:shadow-[0_0_10px_var(--glow-aurora)]">
            <Network className="w-3.5 h-3.5 text-[var(--aurora)]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-black text-base text-[var(--text-primary)] tracking-tighter leading-none">Qontint</span>
              <span className="px-1.5 py-0.2 text-[8px] font-mono font-bold bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/20 rounded uppercase tracking-wider">v2.4</span>
            </div>
            <span className="font-mono text-[7px] text-[var(--text-muted)] opacity-80 uppercase tracking-[0.15em] mt-0.5">Enterprise Platform</span>
          </div>
        </NavLink>

        {/* ── Spacer ────────────────────────────────────────────────────────── */}
        <div className="flex-1" />

        {/* ── Command Palette trigger ───────────────────────────────────────── */}
        <button
          onClick={toggleCommandPalette}
          aria-label="Open global search command palette (Ctrl+K or /)"
          title="Search pages, reports, keywords or run commands (Ctrl+K or /)"
          className="hidden sm:flex flex-none items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-depth)] border border-[var(--border-subtle)] hover:border-[var(--aurora)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aurora)]"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs font-medium hidden md:block">Search app...</span>
          <kbd className="hidden md:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] ml-1">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>

        {/* ── Workspace Selector ─────────────────────────────────────────────── */}
        <WorkspaceDropdown />

        {/* ── Notification Center ───────────────────────────────────────────── */}
        <GlobalNotificationCenter />

        {/* ── LIVE Status Badge ─────────────────────────────────────────────── */}
        <div className="hidden md:flex flex-none items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>LIVE</span>
        </div>

        {/* ── User Profile Menu ─────────────────────────────────────────────── */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User Profile Options"
            className="flex items-center gap-2 p-1 rounded-full border border-[var(--border-subtle)] hover:border-[var(--aurora)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aurora)]"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[var(--aurora)] to-[var(--plasma)] text-white text-xs font-bold flex items-center justify-center shadow-sm">
              EX
            </div>
          </button>

          {showUserMenu && (
            <div
              onMouseLeave={() => setShowUserMenu(false)}
              className="absolute right-0 top-10 z-50 w-56 p-2 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl text-xs space-y-1 font-sans"
            >
              <div className="px-3 py-2 border-b border-[var(--border-subtle)] mb-1">
                <p className="font-bold text-[var(--text-primary)]">Enterprise Executive</p>
                <p className="text-[10px] text-[var(--text-muted)] font-mono">admin@qontint.io</p>
              </div>
              <button
                onClick={() => { navigate('/app/workspace'); setShowUserMenu(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors text-left"
              >
                <Shield size={14} className="text-[var(--aurora)]" /> Workspace Settings
              </button>
              <button
                onClick={() => { navigate('/app/reports'); setShowUserMenu(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors text-left"
              >
                <Settings size={14} className="text-[var(--text-muted)]" /> Platform Settings
              </button>
              <button
                onClick={() => { navigate('/'); setShowUserMenu(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors text-left font-medium"
              >
                <LogOut size={14} /> Exit Platform
              </button>
            </div>
          )}
        </div>

        {/* ── Mobile search icon ─────────────────────────────────────────────── */}
        <button
          onClick={toggleCommandPalette}
          aria-label="Search"
          className="sm:hidden flex-none p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-depth)] transition-colors"
        >
          <Search className="w-4.5 h-4.5" />
        </button>
      </div>
    </header>
  )
}

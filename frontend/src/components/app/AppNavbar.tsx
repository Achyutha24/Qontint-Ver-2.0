// @ts-nocheck
/**
 * AppNavbar — Production-Ready Global Enterprise Navigation System
 *
 * Layout Architecture:
 *  - Left Section: flex-none (Natural width of logo + Engine v1.0 badge, 0 empty gap)
 *  - Center Section: flex-1 flex justify-center min-w-0 (Fills remaining space, centered, zero collision)
 *  - Right Section: flex-none (Natural width of controls, workspace dropdown, notifications, LIVE badge)
 *  - Centered Enterprise Container: max-w-[1536px] mx-auto px-4 sm:px-6
 *  - Scroll-Aware Sticky Header: Sticky top-0, backdrop-blur-md, shadow-md appears ONLY while scrolling
 *  - Dynamic Spacing: gap-0.5 on laptops → gap-1.5 on desktop to eliminate overlap with Workspace controls
 */
import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, Zap, Brain, Network, Video, BarChart3, LayoutDashboard, Menu, X, Globe, FileText } from 'lucide-react'
import WorkspaceDropdown from '../ui/WorkspaceDropdown'
import GlobalNotificationCenter from '../automation/GlobalNotificationCenter'

const APP_NAV_ITEMS = [
  { to: '/app/analyze',      label: 'Analyze',      icon: Cpu },
  { to: '/app/generate',     label: 'Generate',     icon: Zap },
  { to: '/app/intelligence', label: 'Intelligence', icon: Brain },
  { to: '/app/serp-intel',   label: 'SERP Intelligence', icon: Globe },
  { to: '/app/graph',        label: 'Graph',        icon: Network },
  { to: '/app/reports',      label: 'Reports',      icon: FileText },
  { to: '/app/youtube',      label: 'YouTube',      icon: Video },
  { to: '/app/keywords',     label: 'Keywords',     icon: BarChart3 },
  { to: '/app/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
]

export default function AppNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  // Scroll listener to toggle sticky header shadow dynamically
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={`sticky top-0 left-0 right-0 z-[60] bg-[var(--bg-card)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] transition-shadow duration-300 ${
      isScrolled ? 'shadow-md shadow-black/5' : ''
    }`}>
      {/* Centered Enterprise Max-Width Container (1536px) */}
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 min-h-[58px]">

        {/* ── 1. LEFT SECTION: flex-none (ONLY NATURAL LOGO WIDTH) ─────────────── */}
        <div className="flex-none flex items-center">
          <NavLink
            to="/"
            className="flex items-center gap-2 no-underline group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aurora)] rounded-lg p-0.5"
            onClick={() => setMobileOpen(false)}
            aria-label="Qontint Home"
          >
            <div className="relative w-8 h-8 flex items-center justify-center border border-[var(--aurora)] rounded-full transition-all duration-300 group-hover:shadow-[0_0_12px_var(--glow-aurora)]">
              <Network className="w-4 h-4 text-[var(--aurora)]" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-lg text-[var(--text-primary)] tracking-tighter leading-none">Qontint</span>
              <span className="font-mono text-[8px] text-[var(--aurora)] opacity-80 uppercase tracking-[0.2em] mt-0.5">Engine v1.0</span>
            </div>
          </NavLink>
        </div>

        {/* ── 2. CENTER SECTION: flex-1 flex justify-center (DYNAMIC REMAINING SPACE) ── */}
        <nav
          className="hidden lg:flex flex-1 items-center justify-center gap-0.5 xl:gap-1 2xl:gap-1.5 px-2 min-w-0"
          aria-label="Main Navigation"
        >
          {APP_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1 xl:gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-xl text-[12px] xl:text-xs font-bold transition-all duration-200 no-underline whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aurora)] ${
                  isActive
                    ? 'bg-[#FFEDD5] text-[#F97316] border border-[#FED7AA] shadow-2xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-depth)] border border-transparent'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ── 3. RIGHT SECTION: flex-none (ONLY NATURAL CONTROLS WIDTH) ────────── */}
        <div className="flex-none flex items-center justify-end gap-2.5 sm:gap-3">
          <WorkspaceDropdown />
          <GlobalNotificationCenter />

          <div className="live-badge hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--bg-depth)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--aurora)] uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--aurora)] animate-pulse" />
            <span>LIVE</span>
          </div>

          {/* Mobile Navigation Drawer Toggle */}
          <button
            className="lg:hidden p-1.5 text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-depth)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aurora)]"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── MOBILE RESPONSIVE DRAWER ─────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden overflow-hidden border-t border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-4"
          >
            <div className="grid grid-cols-2 gap-2">
              {APP_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold no-underline transition-all ${
                      isActive
                        ? 'bg-[#FFEDD5] text-[#F97316] border border-[#FED7AA]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-depth)] border border-transparent'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

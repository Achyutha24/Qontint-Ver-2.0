/**
 * AppNavbar — Application workspace navigation.
 * Contains: Logo (→/), Analyze, Generate, Intelligence, Competitor, Graph,
 *           YouTube, Keywords, Dashboard, WorkspaceDropdown, LIVE badge.
 * No Home or Pricing links.
 */
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, Zap, Brain, Network, Video, BarChart3, LayoutDashboard, Menu, X } from 'lucide-react'
import WorkspaceDropdown from '../ui/WorkspaceDropdown'

const APP_NAV_ITEMS = [
  { to: '/app/analyze',      label: 'Analyze',      icon: Cpu },
  { to: '/app/generate',     label: 'Generate',     icon: Zap },
  { to: '/app/intelligence', label: 'Intelligence', icon: Brain },
  { to: '/app/graph',        label: 'Graph',        icon: Network },
  { to: '/app/youtube',      label: 'YouTube',      icon: Video },
  { to: '/app/keywords',     label: 'Keywords',     icon: BarChart3 },
  { to: '/app/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
]

export default function AppNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="glass-nav fixed top-0 left-0 right-0 z-[60] px-5 py-3 border-b border-[var(--border-subtle)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between w-full relative">

        {/* Logo — clicking returns to landing */}
        <NavLink
          to="/"
          className="flex items-center gap-2 no-underline flex-shrink-0 group"
          onClick={() => setMobileOpen(false)}
        >
          <div className="relative w-9 h-9 flex items-center justify-center border border-[var(--aurora)] rounded-full transition-all duration-300 group-hover:shadow-[0_0_15px_var(--glow-aurora)]">
            <Network className="w-5 h-5 text-[var(--aurora)]" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-black text-xl text-[var(--text-primary)] tracking-tighter leading-none">Qontint</span>
            <span className="font-mono text-[9px] text-[var(--aurora)] opacity-80 uppercase tracking-[0.2em] mt-0.5">Engine v1.0</span>
          </div>
        </NavLink>

        {/* Desktop links */}
        <div className="hidden lg:flex flex-1 items-center justify-center gap-0.5 px-4">
          {APP_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-300 no-underline border ${
                  isActive ? 'nav-link-active' : 'nav-link-base'
                } whitespace-nowrap`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center justify-end gap-3 flex-shrink-0">
          <WorkspaceDropdown />

          <div className="live-badge hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-depth)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--aurora)] uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--aurora)] animate-pulse" />
            <span>LIVE</span>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 text-[var(--text-primary)] nav-link-base rounded-lg transition-colors"
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden overflow-hidden border-t border-[var(--border-subtle)] mt-3 pt-3"
          >
            <div className="grid grid-cols-2 gap-2 pb-2">
              {APP_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-bold no-underline transition-all border ${
                      isActive ? 'nav-link-active' : 'nav-link-base'
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
    </nav>
  )
}

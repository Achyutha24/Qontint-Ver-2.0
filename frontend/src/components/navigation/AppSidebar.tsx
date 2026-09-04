// @ts-nocheck
/**
 * AppSidebar — Overlay Sidebar Navigation
 *
 * Features:
 *  - Slides in from left (ChatGPT-style overlay, never resizes page)
 *  - Auto-closes after navigation unless pinned
 *  - Click-outside closes (handled by overlay)
 *  - Escape closes (handled in NavigationContext)
 *  - Pin mode remembered in localStorage
 *  - Workspace-centric recent items section
 *  - Clean two-level structure: Main Nav + Recent + Tools
 */
import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Cpu, Zap, Brain, Network, Video, BarChart3,
  Globe, FileText, Briefcase, Sparkles, Settings, HelpCircle,
  Info, Pin, PinOff, X, Clock, TrendingUp, FolderOpen, ChevronRight
} from 'lucide-react'
import { useNavigation } from '../../context/NavigationContext'
import { useDomain } from '../../context/DomainContext'

const MAIN_NAV = [
  { to: '/app/dashboard',    label: 'Dashboard',         icon: LayoutDashboard },
  { to: '/app/analyze',      label: 'Analyze',            icon: Cpu },
  { to: '/app/generate',     label: 'Generate',           icon: Zap },
  { to: '/app/intelligence', label: 'Intelligence',       icon: Brain },
  { to: '/app/serp-intel',   label: 'SERP Intelligence',  icon: Globe },
  { to: '/app/graph',        label: 'ERP Graph',          icon: Network },
  { to: '/app/reports',      label: 'Reports',            icon: FileText },
  { to: '/app/workspace',    label: 'Workspace',          icon: Briefcase },
  { to: '/app/youtube',      label: 'YouTube',            icon: Video },
  { to: '/app/keywords',     label: 'Keywords',           icon: BarChart3 },
]

const RECENT_ITEMS = [
  { label: 'ERP System Architecture',      icon: FolderOpen,  route: '/app/graph',     type: 'Graph' },
  { label: 'Cloud ERP Procurement Audit',  icon: Clock,       route: '/app/analyze',   type: 'Analysis' },
  { label: 'Grade A+ Executive Report',    icon: FileText,    route: '/app/reports',   type: 'Report' },
  { label: 'Enterprise SERP Scan',         icon: TrendingUp,  route: '/app/serp-intel',type: 'SERP' },
]


const TOOLS = [
  { label: 'Settings',      icon: Settings,    route: '/app/settings' },
  { label: 'Help & Docs',   icon: HelpCircle,  route: '/app/help' },
  { label: 'About Qontint', icon: Info,        route: '/app/about' },
]

export default function AppSidebar() {
  const navigate = useNavigate()
  const { sidebarOpen, setSidebarOpen, pinned, togglePin, closeSidebar } = useNavigation()
  const { activeDomainName } = useDomain()

  const handleNavClick = (to: string) => {
    navigate(to)
    closeSidebar()
  }

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          {/* Overlay backdrop — clicking it closes the sidebar */}
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm"
            onClick={() => { if (!pinned) setSidebarOpen(false) }}
            aria-hidden="true"
          />

          {/* Sidebar Panel */}
          <motion.aside
            key="sidebar-panel"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed top-0 left-0 bottom-0 z-[71] w-72 flex flex-col bg-[var(--bg-card)] border-r border-[var(--border-subtle)] shadow-2xl overflow-hidden"
            aria-label="Navigation Sidebar"
          >
            {/* ── Sidebar Header ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-depth)] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 flex items-center justify-center border border-[var(--aurora)] rounded-full">
                  <Network className="w-3.5 h-3.5 text-[var(--aurora)]" />
                </div>
                <div>
                  <span className="font-display font-black text-base text-[var(--text-primary)] tracking-tighter leading-none">Qontint</span>
                  <span className="font-mono text-[8px] text-[var(--aurora)] opacity-70 uppercase tracking-[0.15em] block mt-0.5">Engine v2.4 Enterprise</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={togglePin}
                  title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                >
                  {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  title="Close sidebar"
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Active Workspace Badge ───────────────────────────────────── */}
            <div className="px-4 py-2.5 bg-[var(--bg-depth)] border-b border-[var(--border-subtle)] flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--aurora)]/5 border border-[var(--aurora)]/15">
                <Briefcase className="w-3.5 h-3.5 text-[var(--aurora)] flex-shrink-0" />
                <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{activeDomainName}</span>
                <span className="ml-auto text-[9px] font-mono text-[var(--aurora)] bg-[var(--aurora)]/10 px-1.5 py-0.5 rounded-full">Active</span>
              </div>
            </div>

            {/* ── Scrollable Content ──────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">

              {/* MAIN Navigation */}
              <div className="p-3">
                <p className="px-2 pb-1.5 text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  Main
                </p>
                <nav className="space-y-0.5">
                  {MAIN_NAV.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => closeSidebar()}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium no-underline transition-all duration-150 group ${
                          isActive
                            ? 'bg-[#FFEDD5] text-[#F97316] border border-[#FED7AA]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-depth)] border border-transparent'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1">{label}</span>
                    </NavLink>
                  ))}
                </nav>
              </div>

              {/* RECENT PROJECTS (Workspace-scoped) */}
              <div className="px-3 pb-3">
                <p className="px-2 pb-1.5 text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  Recent · {activeDomainName}
                </p>
                <div className="space-y-0.5">
                  {RECENT_ITEMS.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => handleNavClick(item.route)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors hover:bg-[var(--bg-depth)] group"
                    >
                      <item.icon className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{item.label}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono">{item.type}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* TOOLS */}
              <div className="px-3 pb-3 border-t border-[var(--border-subtle)] pt-3">
                <p className="px-2 pb-1.5 text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  Tools
                </p>
                <div className="space-y-0.5">
                  {TOOLS.map((tool) => (
                    <NavLink
                      key={tool.route}
                      to={tool.route}
                      onClick={closeSidebar}
                      className={({ isActive }) =>
                        `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                          isActive
                            ? 'bg-[var(--solar)] text-[var(--aurora)] border border-[var(--aurora)]/20'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-depth)] border border-transparent'
                        }`
                      }
                    >
                      <tool.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{tool.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Sidebar Footer ───────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-depth)]">
              <p className="text-[10px] font-mono text-[var(--text-muted)] text-center">
                {pinned ? '📌 Sidebar is pinned open' : 'Auto-closes after navigation'}
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

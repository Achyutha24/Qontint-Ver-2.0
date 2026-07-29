// @ts-nocheck
/**
 * CommandPalette — Global Ctrl+K Command Palette
 *
 * Features:
 *  - Opens via Ctrl+K or search icon in header
 *  - Searches pages, commands, recent items
 *  - Fuzzy search / instant filter
 *  - Keyboard navigation (↑↓ Arrow keys, Enter, Escape)
 *  - Workspace-scoped by default
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, Cpu, Zap, Brain, Network, Video, BarChart3,
  LayoutDashboard, Globe, FileText, Briefcase, Sparkles,
  ArrowRight, Command, BarChart2, BookOpen
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../../context/NavigationContext'
import { useDomain } from '../../context/DomainContext'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: any
  action: () => void
  category: string
  keywords?: string[]
}

export default function CommandPalette() {
  const navigate = useNavigate()
  const { commandPaletteOpen, setCommandPaletteOpen, closeSidebar } = useNavigation()
  const { activeDomainName } = useDomain()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const go = (route: string) => {
    navigate(route)
    setCommandPaletteOpen(false)
    setQuery('')
    closeSidebar()
  }

  const allCommands: CommandItem[] = useMemo(() => [
    // Pages
    { id: 'dashboard',   label: 'Dashboard',          description: 'Command center overview',          icon: LayoutDashboard, category: 'Pages',    action: () => go('/app/dashboard'),    keywords: ['home', 'overview', 'summary'] },
    { id: 'analyze',     label: 'Analyze',             description: 'Neural content dissection',        icon: Cpu,            category: 'Pages',    action: () => go('/app/analyze'),      keywords: ['seo', 'content', 'score', 'dissect'] },
    { id: 'generate',    label: 'Generate',            description: 'AI Content Studio',                icon: Zap,            category: 'Pages',    action: () => go('/app/generate'),     keywords: ['write', 'article', 'create', 'ai'] },
    { id: 'intelligence',label: 'Intelligence',        description: 'Query intelligence engine',        icon: Brain,          category: 'Pages',    action: () => go('/app/intelligence'), keywords: ['query', 'insight'] },
    { id: 'serp',        label: 'SERP Intelligence',   description: 'Live SERP analysis',               icon: Globe,          category: 'Pages',    action: () => go('/app/serp-intel'),   keywords: ['serp', 'search', 'rank', 'google'] },
    { id: 'graph',       label: 'Knowledge Graph',     description: 'Entity relationship visualization',icon: Network,        category: 'Pages',    action: () => go('/app/graph'),        keywords: ['entity', 'graph', 'knowledge', 'neo4j'] },
    { id: 'reports',     label: 'Reports',             description: 'Executive intelligence reports',   icon: FileText,       category: 'Pages',    action: () => go('/app/reports'),      keywords: ['report', 'executive', 'audit'] },
    { id: 'workspace',   label: 'Workspace',           description: 'Project management hub',           icon: Briefcase,      category: 'Pages',    action: () => go('/app/workspace'),    keywords: ['project', 'manage', 'workspace'] },
    { id: 'youtube',     label: 'YouTube',             description: 'YouTube content intelligence',     icon: Video,          category: 'Pages',    action: () => go('/app/youtube'),      keywords: ['video', 'youtube', 'yt'] },
    { id: 'keywords',    label: 'Keywords',            description: 'Keyword explorer & tracker',       icon: BarChart3,      category: 'Pages',    action: () => go('/app/keywords'),     keywords: ['keyword', 'kw', 'track'] },
    // Commands
    { id: 'cmd-analyze', label: 'Analyze Keyword',     description: 'Run neural content analysis',      icon: Cpu,            category: 'Commands', action: () => go('/app/analyze'),      keywords: ['run', 'analyze'] },
    { id: 'cmd-generate',label: 'Generate Article',    description: 'Create AI-powered content',        icon: Zap,            category: 'Commands', action: () => go('/app/generate'),     keywords: ['write', 'generate', 'article'] },
    { id: 'cmd-report',  label: 'Create Report',       description: 'Generate executive audit report',  icon: FileText,       category: 'Commands', action: () => go('/app/reports'),      keywords: ['create', 'report'] },
    { id: 'cmd-serp',    label: 'Run SERP Analysis',   description: 'Search live SERP competitors',     icon: Globe,          category: 'Commands', action: () => go('/app/serp-intel'),   keywords: ['serp', 'live', 'competitors'] },
    { id: 'cmd-graph',   label: 'Open Knowledge Graph',description: 'Visualize entity relationships',   icon: Network,        category: 'Commands', action: () => go('/app/graph'),        keywords: ['open', 'graph', 'entities'] },
    { id: 'cmd-ai',      label: 'Open AI Assistant',   description: 'Ask the Enterprise AI Copilot',    icon: Sparkles,       category: 'Commands', action: () => { setCommandPaletteOpen(false); setQuery('') }, keywords: ['ai', 'copilot', 'assistant', 'ask'] },
  ], [])

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands
    const q = query.toLowerCase()
    return allCommands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.description?.toLowerCase().includes(q)) ||
      (c.keywords?.some(k => k.includes(q))) ||
      c.category.toLowerCase().includes(q)
    )
  }, [query, allCommands])

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    filtered.forEach(item => {
      const cat = item.category
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    })
    return map
  }, [filtered])

  // Flat list for keyboard nav
  const flatFiltered = filtered

  useEffect(() => { setSelectedIndex(0) }, [query])

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [commandPaletteOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!commandPaletteOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, flatFiltered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (flatFiltered[selectedIndex]) flatFiltered[selectedIndex].action()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, flatFiltered, selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!commandPaletteOpen) return null

  let absoluteIdx = 0

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9000] bg-black/40 backdrop-blur-sm"
            onClick={() => setCommandPaletteOpen(false)}
          />

          {/* Palette Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[12vh] left-1/2 -translate-x-1/2 z-[9001] w-full max-w-xl mx-4"
            style={{ width: 'calc(100vw - 2rem)', maxWidth: '600px' }}
          >
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)]">
                <Search className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={`Search pages, commands… (${activeDomainName} workspace)`}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm outline-none"
                />
                <div className="flex items-center gap-1.5">
                  <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-depth)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <Command className="w-2.5 h-2.5" /> K
                  </kbd>
                  <button
                    onClick={() => setCommandPaletteOpen(false)}
                    className="p-1 rounded-lg hover:bg-[var(--bg-depth)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <div className="py-12 text-center text-sm text-[var(--text-muted)] font-mono">
                    No results for "<span className="text-[var(--text-primary)]">{query}</span>"
                  </div>
                ) : (
                  Array.from(grouped.entries()).map(([category, items]) => (
                    <div key={category} className="mb-2">
                      <div className="px-2 py-1.5 text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest">
                        {category}
                      </div>
                      {items.map(item => {
                        const idx = absoluteIdx++
                        const isSelected = idx === selectedIndex
                        return (
                          <button
                            key={item.id}
                            data-idx={idx}
                            onClick={item.action}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                              isSelected
                                ? 'bg-[#FFEDD5] text-[#F97316]'
                                : 'hover:bg-[var(--bg-depth)] text-[var(--text-primary)]'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-[#F97316]/10' : 'bg-[var(--bg-depth)]'
                            }`}>
                              <item.icon className={`w-4 h-4 ${isSelected ? 'text-[#F97316]' : 'text-[var(--aurora)]'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{item.label}</div>
                              {item.description && (
                                <div className={`text-xs truncate ${isSelected ? 'text-[#F97316]/70' : 'text-[var(--text-muted)]'}`}>
                                  {item.description}
                                </div>
                              )}
                            </div>
                            <ArrowRight className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-[#F97316]' : 'text-[var(--text-muted)]'}`} />
                          </button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-center justify-between font-mono text-[10px] text-[var(--text-muted)]">
                <span>↑↓ Navigate · Enter Select · Esc Close</span>
                <span className="hidden sm:block">Workspace: <strong className="text-[var(--aurora)]">{activeDomainName}</strong></span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

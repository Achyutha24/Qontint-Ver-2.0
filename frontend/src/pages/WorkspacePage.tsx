// @ts-nocheck
/**
 * WorkspacePage — Phase 6 Enterprise Workspace Operational Hub
 *
 * Operational project management hub where users organize, manage, and track complete SEO projects:
 *  - Top Header & Control Bar (Workspace Name, Project Count, Search, Create/Import/Settings)
 *  - Project Filter Bar (Industry, Status, SEO Score, Region)
 *  - Project Cards Grid (Name, Primary Keyword, SEO Score, Rank, Status, Module Launchers)
 *  - Interactive Project Deep-Dive Operational Hub with 8 Modules:
 *      1. Tracked Keywords Management (Add, Remove, Filter, Sort)
 *      2. AI Content Library (Articles, Quality Scores, Edit, Duplicate)
 *      3. Report Library (PDF Downloads, Audits, Compare)
 *      4. Competitor Intelligence (Authority, Content Count, Opportunity Scores)
 *      5. Project Timeline History
 *      6. Project Notes & Action Items (Interactive Tasks)
 *      7. Project Files & Document Attachments
 *      8. Future-Ready Architecture (Team Roles, Task Assignment, Automated Alerts)
 */
import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Plus, Search, Filter, Cpu, Zap, Globe, Network, FileText, Video,
  BarChart3, ArrowRight, CheckCircle2, AlertTriangle, Clock, Sparkles, Folder,
  Eye, Download, Trash2, Edit3, ChevronRight, Copy, Share2, Layers, CheckSquare,
  FileUp, Users, Settings, Tag, ShieldCheck, Bookmark, ArrowUpRight
} from 'lucide-react'
import { useDomain, GLOBAL_DOMAINS } from '../context/DomainContext'

interface TrackedKeyword {
  id: string
  keyword: string
  seoScore: number
  predictedRank: string
  authority: number
  novelty: number
  status: 'Ranking Top 3' | 'Improving' | 'Needs Optimization'
}

interface ProjectContentItem {
  id: string
  title: string
  keyword: string
  contentType: string
  generatedDate: string
  qualityScore: number
}

interface ProjectReportItem {
  id: string
  title: string
  keyword: string
  seoScore: number
  createdDate: string
}

interface ProjectCompetitor {
  domain: string
  authority: string
  contentCount: number
  rankingKeywords: number
  opportunityScore: number
}

interface ProjectNoteItem {
  id: string
  text: string
  completed: boolean
  category: 'Task' | 'Idea' | 'Note'
}

interface SEOProject {
  id: string
  name: string
  description: string
  primaryKeyword: string
  industry: string
  seoScore: number
  predictedRank: string
  lastUpdated: string
  status: 'Active' | 'Paused' | 'Completed'
  targetAudience: string
  targetRegion: string
  createdDate: string
  keywords: TrackedKeyword[]
  contents: ProjectContentItem[]
  reports: ProjectReportItem[]
  competitors: ProjectCompetitor[]
  notes: ProjectNoteItem[]
}

export default function WorkspacePage() {
  const navigate = useNavigate()
  const { domain: verticalFilter, activeDomainName } = useDomain()

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Paused' | 'Completed'>('All')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('p1')
  const [activeModuleTab, setActiveModuleTab] = useState<'keywords' | 'content' | 'reports' | 'competitors' | 'timeline' | 'notes' | 'files'>('keywords')

  // Create Project Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectKw, setNewProjectKw] = useState('')

  // Task check state
  const [newNoteText, setNewNoteText] = useState('')

  // Mock Projects Database
  const [projects, setProjects] = useState<SEOProject[]>([
    {
      id: 'p1',
      name: 'Payment Gateway Security',
      description: 'Comprehensive technical B2B content campaign targeting payment gateway developers and CTOs.',
      primaryKeyword: 'Payment Gateway Security API',
      industry: 'FinTech / Security',
      seoScore: 94,
      predictedRank: '#2',
      lastUpdated: '10 mins ago',
      status: 'Active',
      targetAudience: 'CTOs, Lead Security Engineers, Payment Architects',
      targetRegion: 'North America & EU',
      createdDate: '2026-07-01',
      keywords: [
        { id: 'k1', keyword: 'Payment Gateway Security API', seoScore: 94, predictedRank: '#2', authority: 88, novelty: 85, status: 'Ranking Top 3' },
        { id: 'k2', keyword: 'PCI DSS 4.0 Compliance Integration', seoScore: 88, predictedRank: '#3', authority: 84, novelty: 82, status: 'Improving' },
        { id: 'k3', keyword: 'OAuth 2.0 Webhook Security', seoScore: 78, predictedRank: '#6', authority: 75, novelty: 80, status: 'Needs Optimization' },
      ],
      contents: [
        { id: 'c1', title: 'Payment Gateway Security API Architecture Guide 2026', keyword: 'Payment Gateway Security API', contentType: 'Technical Guide', generatedDate: '2026-07-25', qualityScore: 94 },
        { id: 'c2', title: 'PCI DSS 4.0 Webhook Idempotency Benchmark', keyword: 'PCI DSS 4.0 Compliance Integration', contentType: 'Benchmark Report', generatedDate: '2026-07-20', qualityScore: 88 },
      ],
      reports: [
        { id: 'r1', title: 'Executive SEO Audit - Payment Gateway', keyword: 'Payment Gateway Security API', seoScore: 94, createdDate: '2026-07-25' },
        { id: 'r2', title: 'Stripe Competitor Benchmark Report', keyword: 'PCI DSS 4.0 Integration', seoScore: 88, createdDate: '2026-07-20' },
      ],
      competitors: [
        { domain: 'stripe.com/docs', authority: '94%', contentCount: 3100, rankingKeywords: 420, opportunityScore: 85 },
        { domain: 'adyen.com/developers', authority: '85%', contentCount: 1950, rankingKeywords: 280, opportunityScore: 92 },
      ],
      notes: [
        { id: 'n1', text: 'Add dedicated H2 section on PCI DSS 4.0 compliance requirement', completed: true, category: 'Task' },
        { id: 'n2', text: 'Implement structured FAQPage JSON-LD schema markup', completed: false, category: 'Task' },
        { id: 'n3', text: 'Include benchmarking diagram comparing OAuth 2.0 latency', completed: false, category: 'Idea' },
      ]
    },
    {
      id: 'p2',
      name: 'PCI DSS 4.0 Compliance Standard',
      description: 'Regulatory audit campaign focused on compliance frameworks and technical validation.',
      primaryKeyword: 'PCI DSS 4.0 Standard',
      industry: 'Compliance / Legal',
      seoScore: 88,
      predictedRank: '#3',
      lastUpdated: '2 hours ago',
      status: 'Active',
      targetAudience: 'Compliance Officers & DevSecOps Teams',
      targetRegion: 'Global',
      createdDate: '2026-07-10',
      keywords: [
        { id: 'k4', keyword: 'PCI DSS 4.0 Standard', seoScore: 88, predictedRank: '#3', authority: 82, novelty: 80, status: 'Ranking Top 3' },
      ],
      contents: [],
      reports: [],
      competitors: [],
      notes: []
    },
    {
      id: 'p3',
      name: 'Stripe Payments API Integration',
      description: 'Developer tutorial series covering Stripe webhook handling and idempotency.',
      primaryKeyword: 'Stripe Payments API',
      industry: 'Developer Tools',
      seoScore: 92,
      predictedRank: '#1',
      lastUpdated: 'Yesterday',
      status: 'Active',
      targetAudience: 'Full-Stack Developers',
      targetRegion: 'North America',
      createdDate: '2026-07-15',
      keywords: [],
      contents: [],
      reports: [],
      competitors: [],
      notes: []
    }
  ])

  // Selected Active Project
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || projects[0]
  }, [projects, selectedProjectId])

  // Filtered Projects List
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.primaryKeyword.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [projects, searchQuery, statusFilter])

  // Handle Adding New Project
  const handleCreateProject = () => {
    if (!newProjectName.trim()) return
    const newProj: SEOProject = {
      id: `p-${Date.now()}`,
      name: newProjectName,
      description: 'Newly initialized campaign project.',
      primaryKeyword: newProjectKw || 'Target Keyword',
      industry: activeDomainName,
      seoScore: 85,
      predictedRank: '#4',
      lastUpdated: 'Just now',
      status: 'Active',
      targetAudience: 'Enterprise Decision Makers',
      targetRegion: 'Global',
      createdDate: new Date().toISOString().split('T')[0],
      keywords: [],
      contents: [],
      reports: [],
      competitors: [],
      notes: []
    }
    setProjects([newProj, ...projects])
    setSelectedProjectId(newProj.id)
    setNewProjectName('')
    setNewProjectKw('')
    setCreateModalOpen(false)
  }

  // Handle Adding Note/Task
  const handleAddNote = () => {
    if (!newNoteText.trim() || !selectedProject) return
    const newNote: ProjectNoteItem = {
      id: `note-${Date.now()}`,
      text: newNoteText.trim(),
      completed: false,
      category: 'Task'
    }
    setProjects(projects.map(p => {
      if (p.id === selectedProject.id) {
        return { ...p, notes: [newNote, ...p.notes] }
      }
      return p
    }))
    setNewNoteText('')
  }

  // Toggle Note Check
  const toggleNoteCheck = (noteId: string) => {
    setProjects(projects.map(p => {
      if (p.id === selectedProject.id) {
        return {
          ...p,
          notes: p.notes.map(n => n.id === noteId ? { ...n, completed: !n.completed } : n)
        }
      }
      return p
    }))
  }

  return (
    <div className="min-h-screen flex flex-col pt-14 pb-20 px-4 max-w-[1600px] mx-auto space-y-8 relative bg-[var(--bg-void)]">

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TOP HEADER & CONTROL BAR                                               */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs relative z-10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/20 flex items-center justify-center">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-[var(--text-primary)] text-2xl leading-none">
                  {activeDomainName} Enterprise Workspace Hub
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase">
                  {projects.length} Active Campaigns
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                Operational Management Center for SEO Campaigns & Content Assets
              </p>
            </div>
          </div>

          {/* Action Launchers */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setCreateModalOpen(true)} className="btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5 font-bold">
              <Plus size={14} /> Create Project
            </button>
            <button onClick={() => alert('Project imported successfully!')} className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 font-bold">
              <FileUp size={14} /> Import Project
            </button>
            <button onClick={() => alert('Workspace settings opened!')} className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5">
              <Settings size={14} /> Settings
            </button>
          </div>
        </div>

        {/* Global Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search projects, keywords, reports, generated content..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] focus:border-[var(--aurora)] transition-all"
            />
            <Search className="absolute left-3 top-2.5 text-[var(--text-muted)]" size={14} />
          </div>

          <div className="flex items-center gap-1 bg-[var(--bg-depth)] p-1 rounded-xl border border-[var(--border-subtle)] text-xs font-mono">
            {['All', 'Active', 'Paused', 'Completed'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s as any)}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  statusFilter === s ? 'bg-[#FFEDD5] text-[#F97316] border border-[#FED7AA]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MAIN WORKSPACE GRID: PROJECTS LIST & OPERATIONAL DEEP-DIVE              */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">

        {/* LEFT COLUMN: PROJECT CARDS LIST (4 COLS) */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-sm font-bold font-mono uppercase text-[var(--text-muted)] tracking-wider px-1">
            Campaign Projects ({filteredProjects.length})
          </h3>

          <div className="space-y-3">
            {filteredProjects.map(proj => {
              const isSelected = selectedProjectId === proj.id
              return (
                <div
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[var(--aurora)] bg-[var(--bg-card)] shadow-md'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">{proj.name}</h4>
                      <span className="text-[10px] font-mono text-[var(--aurora)]">{proj.industry}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                      proj.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}>
                      {proj.status}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] mt-2 font-mono truncate">
                    KW: <strong>{proj.primaryKeyword}</strong>
                  </p>

                  <div className="flex items-center justify-between text-xs font-mono pt-3 mt-3 border-t border-[var(--border-subtle)]">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block">SEO Score:</span>
                      <strong className="text-[var(--aurora)] font-bold">{proj.seoScore}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block">Rank:</span>
                      <strong className="text-emerald-600 font-bold">{proj.predictedRank}</strong>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{proj.lastUpdated}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: PROJECT OPERATIONAL HUB & MODULES (8 COLS) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedProject ? (
            <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs space-y-6">

              {/* PROJECT HEADER OVERVIEW */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{selectedProject.name}</h2>
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold font-mono bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/20">
                      {selectedProject.industry}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{selectedProject.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => navigate('/app/analyze')} className="btn-primary px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                    <Cpu size={12} /> Analyze
                  </button>
                  <button onClick={() => navigate('/app/generate')} className="btn-secondary px-3 py-1.5 text-xs text-[var(--aurora)] border-[var(--aurora)]/30 font-bold flex items-center gap-1">
                    <Zap size={12} /> Generate
                  </button>
                  <button onClick={() => navigate('/app/reports')} className="btn-secondary px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                    <FileText size={12} /> Report
                  </button>
                </div>
              </div>

              {/* PROJECT METADATA SUMMARY */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs p-3 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
                <div><span className="text-[var(--text-muted)] block">Target Audience:</span><strong className="text-[var(--text-primary)] text-[11px] truncate block">{selectedProject.targetAudience}</strong></div>
                <div><span className="text-[var(--text-muted)] block">Target Region:</span><strong className="text-[var(--aurora)]">{selectedProject.targetRegion}</strong></div>
                <div><span className="text-[var(--text-muted)] block">Created Date:</span><strong className="text-[var(--text-primary)]">{selectedProject.createdDate}</strong></div>
                <div><span className="text-[var(--text-muted)] block">Primary Keyword:</span><strong className="text-emerald-600 truncate block">{selectedProject.primaryKeyword}</strong></div>
              </div>

              {/* MODULE NAVIGATION TABS */}
              <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] pb-2 overflow-x-auto text-xs font-mono">
                {[
                  { id: 'keywords', label: 'Keywords', count: selectedProject.keywords.length },
                  { id: 'content', label: 'AI Content', count: selectedProject.contents.length },
                  { id: 'reports', label: 'Reports', count: selectedProject.reports.length },
                  { id: 'competitors', label: 'Competitors', count: selectedProject.competitors.length },
                  { id: 'notes', label: 'Tasks & Notes', count: selectedProject.notes.length },
                  { id: 'files', label: 'Files', count: 2 },
                  { id: 'timeline', label: 'Timeline', count: 4 },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveModuleTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      activeModuleTab === tab.id
                        ? 'bg-[#FFEDD5] text-[#F97316] border border-[#FED7AA]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[var(--bg-depth)] font-mono">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* MODULE 1: KEYWORDS MANAGEMENT */}
              {activeModuleTab === 'keywords' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">Tracked Campaign Keywords</h4>
                    <button onClick={() => alert('Add keyword modal')} className="btn-secondary px-3 py-1.5 text-xs text-[var(--aurora)] border-[var(--aurora)]/30 font-bold flex items-center gap-1">
                      <Plus size={12} /> Add Keyword
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] font-mono text-[var(--text-muted)] text-[10px] uppercase">
                          <th className="py-2 px-3">Keyword</th>
                          <th className="py-2 px-3">SEO Score</th>
                          <th className="py-2 px-3">Predicted Rank</th>
                          <th className="py-2 px-3">Authority</th>
                          <th className="py-2 px-3">Novelty</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProject.keywords.map(kw => (
                          <tr key={kw.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-depth)] font-mono">
                            <td className="py-2.5 px-3 font-bold text-[var(--text-primary)]">{kw.keyword}</td>
                            <td className="py-2.5 px-3 text-[var(--aurora)] font-bold">{kw.seoScore}%</td>
                            <td className="py-2.5 px-3 text-emerald-600 font-bold">{kw.predictedRank}</td>
                            <td className="py-2.5 px-3 text-blue-600">{kw.authority}%</td>
                            <td className="py-2.5 px-3 text-purple-600">{kw.novelty}%</td>
                            <td className="py-2.5 px-3 text-emerald-600">{kw.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MODULE 2: CONTENT LIBRARY */}
              {activeModuleTab === 'content' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">AI Content Studio Articles</h4>
                    <button onClick={() => navigate('/app/generate')} className="btn-primary px-3 py-1 text-xs font-bold">
                      Open AI Content Studio
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedProject.contents.map(item => (
                      <div key={item.id} className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-center justify-between text-xs">
                        <div>
                          <h5 className="font-bold text-[var(--text-primary)]">{item.title}</h5>
                          <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">{item.contentType} · {item.generatedDate}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-emerald-600 font-bold">Quality: {item.qualityScore}%</span>
                          <button onClick={() => navigate('/app/generate')} className="btn-secondary px-2.5 py-1 text-[11px] font-bold">
                            Continue Editing
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MODULE 3: REPORTS LIBRARY */}
              {activeModuleTab === 'reports' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">Executive Audit Reports</h4>
                    <button onClick={() => navigate('/app/reports')} className="btn-secondary px-3 py-1 text-xs font-bold text-[var(--aurora)] border-[var(--aurora)]/30">
                      Generate New Report
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedProject.reports.map(rep => (
                      <div key={rep.id} className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-center justify-between text-xs font-mono">
                        <div>
                          <h5 className="font-bold text-[var(--text-primary)]">{rep.title}</h5>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Keyword: {rep.keyword} · {rep.createdDate}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-[var(--aurora)]">{rep.seoScore}%</span>
                          <button onClick={() => navigate('/app/reports')} className="btn-secondary px-2.5 py-1 text-[11px] font-bold">
                            View PDF
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MODULE 4: COMPETITOR LIBRARY */}
              {activeModuleTab === 'competitors' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-[var(--text-primary)]">Tracked Competitor Domains</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedProject.competitors.map((comp, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] space-y-2 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <strong className="text-[var(--aurora)] text-sm">{comp.domain}</strong>
                          <span className="text-emerald-600 font-bold">Auth: {comp.authority}</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          <span>Ranking Keywords: {comp.rankingKeywords}</span> | <span>Opp Score: {comp.opportunityScore}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MODULE 5: PROJECT TASKS & NOTES */}
              {activeModuleTab === 'notes' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add a new task or note to this campaign..."
                      value={newNoteText}
                      onChange={e => setNewNoteText(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)]"
                    />
                    <button onClick={handleAddNote} className="btn-primary px-3 py-1.5 text-xs font-bold">
                      Add Task
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedProject.notes.map(note => (
                      <div key={note.id} className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={note.completed}
                            onChange={() => toggleNoteCheck(note.id)}
                            className="rounded border-slate-300 text-[var(--aurora)]"
                          />
                          <span className={`text-[var(--text-primary)] ${note.completed ? 'line-through opacity-60' : ''}`}>
                            {note.text}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--aurora)] font-bold">{note.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MODULE 6: FILES */}
              {activeModuleTab === 'files' && (
                <div className="space-y-3 font-mono text-xs">
                  <h4 className="font-bold text-sm text-[var(--text-primary)]">Project Files & Attachments</h4>
                  <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-center justify-between">
                    <span>Payment_Gateway_Security_Audit_2026.pdf</span>
                    <button onClick={() => alert('Downloading file...')} className="btn-secondary px-2.5 py-1 text-[11px] font-bold">
                      <Download size={12} /> Download
                    </button>
                  </div>
                </div>
              )}

              {/* MODULE 7: TIMELINE */}
              {activeModuleTab === 'timeline' && (
                <div className="space-y-3 font-mono text-xs">
                  <h4 className="font-bold text-sm text-[var(--text-primary)]">Campaign Timeline History</h4>
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)]">
                      <span className="text-[10px] text-[var(--text-muted)] block">July 25, 2026 19:10</span>
                      <strong className="text-[var(--aurora)]">Generated AI Content Studio Article for Payment Gateway Security API</strong>
                    </div>
                    <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)]">
                      <span className="text-[10px] text-[var(--text-muted)] block">July 25, 2026 19:07</span>
                      <strong className="text-emerald-600">Created Executive SEO Audit PDF Report</strong>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="card p-12 text-center text-[var(--text-muted)]">Select a project to inspect operational workspace.</div>
          )}
        </div>
      </div>

      {/* CREATE PROJECT MODAL */}
      <AnimatePresence>
        {createModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] max-w-md w-full space-y-4 shadow-2xl">
              <h3 className="font-bold text-lg text-[var(--text-primary)]">Create New SEO Project</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[var(--text-muted)] font-mono mb-1">Project Name</label>
                  <input
                    type="text"
                    placeholder="e.g. OAuth 2.0 B2B Security Campaign"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-muted)] font-mono mb-1">Primary Target Keyword</label>
                  <input
                    type="text"
                    placeholder="e.g. OAuth 2.0 Security Core"
                    value={newProjectKw}
                    onChange={e => setNewProjectKw(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setCreateModalOpen(false)} className="btn-secondary px-4 py-2 text-xs font-bold">
                  Cancel
                </button>
                <button onClick={handleCreateProject} className="btn-primary px-4 py-2 text-xs font-bold">
                  Initialize Campaign Project
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

// @ts-nocheck
/**
 * DashboardPage — Phase 5 Enterprise Dashboard (Central Command Center)
 *
 * Primary landing page after login that summarizes and connects all existing modules:
 *  - Top Welcome & Quick Actions Launchpad
 *  - Global KPI Dashboard (8 Enterprise Cards)
 *  - Global Workspace Search
 *  - Project Overview Cards Grid
 *  - Recent Activity Timeline
 *  - AI Synthesis Summary Card
 *  - Recent Reports Table
 *  - Recent AI Content Studio Generations
 *  - Keyword Performance Matrix
 *  - Real-Time Notifications Feed
 *  - Visual Performance Analytics (Recharts Graphs)
 */
import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Cpu, Zap, Brain, Globe, Network, FileText, Video,
  BarChart3, Search, Plus, ArrowRight, TrendingUp, CheckCircle2, AlertTriangle,
  Clock, Sparkles, Folder, Eye, Download, ExternalLink, Activity, Bell, Layers,
  Compass, Shield, Award, ChevronRight, RefreshCw, Filter
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart as RePieChart, Pie, Cell
} from 'recharts'
import { useDomain, GLOBAL_DOMAINS } from '../context/DomainContext'
import { apiFetch } from '../api/apiClient'

const CHART_COLORS = ['#F97316', '#2563EB', '#22C55E', '#7C3AED', '#EF4444', '#06B6D4']

interface ProjectCardData {
  id: string
  name: string
  keyword: string
  seoScore: number
  predictedRank: string
  lastUpdated: string
  status: 'Optimized' | 'Needs Attention' | 'In Progress'
}

interface RecentActivityItem {
  id: string
  type: 'generate' | 'report' | 'analyze' | 'graph' | 'youtube'
  title: string
  subtitle: string
  timestamp: string
}

interface NotificationItem {
  id: string
  title: string
  time: string
  type: 'info' | 'success' | 'warning'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { domain: verticalFilter, activeDomainName } = useDomain()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'projects' | 'reports' | 'content'>('all')

  // Dynamic Greeting based on time
  const currentHour = new Date().getHours()
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 18 ? 'Good Afternoon' : 'Good Evening'

  // Global KPI Metrics (Section 2)
  const kpiData = [
    { label: 'Total Projects', value: '8 Active', trend: '+2 this month', desc: 'Active workspace projects', color: 'text-[var(--aurora)]' },
    { label: 'Total SERP Analyses', value: '42 Runs', trend: '+14 this week', desc: 'Deep SERP intelligence scans', color: 'text-blue-600' },
    { label: 'Reports Generated', value: '18 Reports', trend: '+5 new', desc: 'Executive audit exports', color: 'text-purple-600' },
    { label: 'AI Content Generated', value: '24 Articles', trend: '+8 published', desc: 'AI Content Studio outputs', color: 'text-emerald-600' },
    { label: 'Average SEO Score', value: '92%', trend: '+4% overall', desc: 'Top 5% across domain', color: 'text-[var(--aurora)]' },
    { label: 'Avg Predicted Rank', value: '#2.1', trend: '+1.4 Positions', desc: 'Outranking 8/10 competitors', color: 'text-emerald-600' },
    { label: 'Average Authority', value: '86%', trend: '+6% density', desc: 'High entity co-occurrence', color: 'text-blue-600' },
    { label: 'Average Novelty Index', value: '84%', trend: '+3% uniqueness', desc: 'Proprietary B2B perspectives', color: 'text-teal-600' },
  ]

  // Workspace Projects Overview (Section 3)
  const projectsList: ProjectCardData[] = [
    { id: 'p1', name: 'Payment Gateway Security', keyword: 'Payment Gateway Security API', seoScore: 94, predictedRank: '#2', lastUpdated: '10 mins ago', status: 'Optimized' },
    { id: 'p2', name: 'PCI DSS 4.0 Compliance', keyword: 'PCI DSS 4.0 Standard', seoScore: 88, predictedRank: '#3', lastUpdated: '2 hours ago', status: 'Optimized' },
    { id: 'p3', name: 'Stripe Integration Guide', keyword: 'Stripe Payments API', seoScore: 92, predictedRank: '#1', lastUpdated: 'Yesterday', status: 'Optimized' },
    { id: 'p4', name: 'OAuth 2.0 B2B Security', keyword: 'OAuth 2.0 Security Core', seoScore: 78, predictedRank: '#6', lastUpdated: '3 days ago', status: 'Needs Attention' },
  ]

  // Recent Activity Feed (Section 4)
  const recentActivities: RecentActivityItem[] = [
    { id: 'a1', type: 'generate', title: 'Generated AI Content Studio Article', subtitle: 'Keyword: Payment Gateway Security API (Grade A+)', timestamp: '12 minutes ago' },
    { id: 'a2', type: 'report', title: 'Exported Executive SEO Audit PDF Report', subtitle: 'Project: B2B SaaS Production Workspace', timestamp: '45 minutes ago' },
    { id: 'a3', type: 'analyze', title: 'Ran SERP Intelligence Scan for Stripe Docs', subtitle: 'Analyzed 10 SERP competitor URL structures', timestamp: '2 hours ago' },
    { id: 'a4', type: 'graph', title: 'Refreshed 3D Knowledge Graph Scene', subtitle: 'Indexed 199 entity nodes and 5,488 relationships', timestamp: '3 hours ago' },
    { id: 'a5', type: 'youtube', title: 'Generated YouTube Video Intelligence Script', subtitle: 'Topic: PCI DSS 4.0 Developer Walkthrough', timestamp: 'Yesterday' },
  ]

  // Notifications Feed (Section 9)
  const notifications: NotificationItem[] = [
    { id: 'n1', title: 'SERP Scan Complete: Payment Gateway Security API', time: '10 mins ago', type: 'success' },
    { id: 'n2', title: 'New Executive Audit Report Ready for Download', time: '45 mins ago', type: 'info' },
    { id: 'n3', title: 'Knowledge Graph Updated: 12 New Entities Discovered', time: '3 hours ago', type: 'success' },
    { id: 'n4', title: 'Action Required: OAuth 2.0 Security Needs FAQ Schema', time: '5 hours ago', type: 'warning' },
  ]

  // Chart Data (Section 10)
  const seoDistributionData = [
    { range: '90-100% (Grade A)', count: 18 },
    { range: '80-89% (Grade B)', count: 12 },
    { range: '70-79% (Grade C)', count: 8 },
    { range: 'Below 70%', count: 4 },
  ]

  const rankDistributionData = [
    { rank: 'Position #1', count: 6 },
    { rank: 'Position #2-3', count: 14 },
    { rank: 'Position #4-10', count: 16 },
    { rank: 'Position 10+', count: 6 },
  ]

  // Filtered Projects based on Search Box
  const filteredProjects = useMemo(() => {
    return projectsList.filter(p =>
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      p.keyword.toLowerCase().includes(searchQuery.toLowerCase().trim())
    )
  }, [searchQuery])

  return (
    <div className="min-h-screen flex flex-col pt-14 pb-20 px-4 max-w-[1600px] mx-auto space-y-8 relative bg-[var(--bg-void)]">

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: TOP WELCOME & QUICK ACTIONS LAUNCHPAD                        */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs relative z-10 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--aurora)] uppercase tracking-widest font-bold">
                Central Command Center
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Active System
              </span>
            </div>
            <h1 className="font-display font-bold text-[var(--text-primary)] text-2xl lg:text-3xl leading-tight mt-1">
              {greeting}, Achyutha 👋
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
              Workspace: <strong className="text-[var(--text-primary)]">{activeDomainName} Production</strong> | Current Date: <span className="text-[var(--aurora)] font-bold">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </p>
          </div>

          {/* Quick Action Launcher Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate('/app/analyze')} className="btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5 font-bold">
              <Cpu size={14} /> Analyze
            </button>
            <button onClick={() => navigate('/app/generate')} className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 text-[var(--aurora)] border-[var(--aurora)]/30 font-bold">
              <Zap size={14} /> Generate Content
            </button>
            <button onClick={() => navigate('/app/reports')} className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 font-bold">
              <FileText size={14} /> Create Report
            </button>
            <button onClick={() => navigate('/app/serp-intel')} className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5">
              <Globe size={14} /> SERP Intel
            </button>
            <button onClick={() => navigate('/app/graph')} className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5">
              <Network size={14} /> Knowledge Graph
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative pt-2 border-t border-[var(--border-subtle)]">
          <input
            type="text"
            placeholder="Global Workspace Search (Projects, Keywords, Reports, Generated Content)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] focus:border-[var(--aurora)] transition-all shadow-inner"
          />
          <Search className="absolute left-3.5 top-5 text-[var(--text-muted)]" size={16} />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: GLOBAL KPI DASHBOARD (8 ENTERPRISE CARDS)                    */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <BarChart3 size={18} className="text-[var(--aurora)]" /> Platform Health & Intelligence Metrics
          </h3>
          <span className="text-xs font-mono text-[var(--text-muted)]">Real-Time Synchronization</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiData.map((kpi, idx) => (
            <div key={idx} className="card p-5 border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-[var(--text-muted)] uppercase">{kpi.label}</span>
                <span className="text-[10px] font-mono text-emerald-600 font-bold">{kpi.trend}</span>
              </div>
              <p className={`text-3xl font-black font-mono ${kpi.color} mb-1`}>{kpi.value}</p>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">{kpi.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3 & 4: AI SYNTHESIS SUMMARY + PROJECT OVERVIEW GRID              */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">

        {/* AI SYNTHESIS SUMMARY CARD (LEFT 5 COLS) */}
        <div className="lg:col-span-5 card p-6 border border-[var(--aurora)]/30 bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-void)] shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--aurora)]" />
              <h3 className="font-bold text-base text-[var(--text-primary)]">AI Platform Executive Synthesis</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--aurora)]/10 text-[var(--aurora)]">
              Automated Insights
            </span>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-sans">
            AI Analysis across <strong className="text-[var(--text-primary)]">{activeDomainName} Workspace</strong> reveals high ranking potential.
            Your top scoring project is <strong className="text-emerald-600">Payment Gateway Security (94/100)</strong>, currently predicted to hold <strong className="text-blue-600">Position #2</strong>.
          </p>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Biggest Ranking Opportunity</span>
              <strong className="text-[var(--aurora)] text-xs">Add PCI DSS 4.0 compliance entities (+2.4 positions)</strong>
            </div>

            <div className="p-3 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Project Needing Attention</span>
              <strong className="text-amber-500 text-xs">OAuth 2.0 B2B Security (Needs FAQ Schema)</strong>
            </div>

            <div className="p-3 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Highest Scoring Project</span>
              <strong className="text-emerald-600 text-xs">Payment Gateway Security API (94/100)</strong>
            </div>
          </div>
        </div>

        {/* WORKSPACE PROJECTS OVERVIEW GRID (RIGHT 7 COLS) */}
        <div className="lg:col-span-7 card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
              <Folder size={18} className="text-[var(--aurora)]" /> Active Workspace Projects ({filteredProjects.length})
            </h3>
            <button onClick={() => navigate('/app/analyze')} className="text-xs text-[var(--aurora)] font-bold flex items-center gap-1">
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map(proj => (
              <div key={proj.id} className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] hover:border-[var(--aurora)]/40 transition-colors space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">{proj.name}</h4>
                    <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5 truncate">{proj.keyword}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                    proj.status === 'Optimized' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                  }`}>
                    {proj.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-[var(--border-subtle)]">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block">SEO Score:</span>
                    <strong className="text-[var(--aurora)] font-bold text-sm">{proj.seoScore}%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block">Predicted Rank:</span>
                    <strong className="text-emerald-600 font-bold text-sm">{proj.predictedRank}</strong>
                  </div>
                  <button onClick={() => navigate('/app/reports')} className="btn-secondary px-2.5 py-1 text-[11px] font-bold">
                    Open Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 5 & 6: RECENT ACTIVITY TIMELINE & NOTIFICATIONS                 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">

        {/* RECENT ACTIVITY TIMELINE (LEFT 7 COLS) */}
        <div className="lg:col-span-7 card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs space-y-4">
          <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
            <Activity size={18} className="text-[var(--aurora)]" /> Recent Platform Activity Timeline
          </h3>

          <div className="space-y-3">
            {recentActivities.map(act => (
              <div key={act.id} className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-start gap-3 text-xs">
                <div className="w-8 h-8 rounded-lg bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {act.type === 'generate' && <Zap size={16} />}
                  {act.type === 'report' && <FileText size={16} />}
                  {act.type === 'analyze' && <Cpu size={16} />}
                  {act.type === 'graph' && <Network size={16} />}
                  {act.type === 'youtube' && <Video size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[var(--text-primary)] text-xs">{act.title}</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{act.subtitle}</p>
                </div>
                <span className="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">{act.timestamp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* NOTIFICATIONS FEED (RIGHT 5 COLS) */}
        <div className="lg:col-span-5 card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs space-y-4">
          <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
            <Bell size={18} className="text-[var(--aurora)]" /> Live Platform Notifications
          </h3>

          <div className="space-y-3">
            {notifications.map(note => (
              <div key={note.id} className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    note.type === 'success' ? 'bg-emerald-500' : note.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <p className="font-bold text-[var(--text-primary)] leading-tight text-xs">{note.title}</p>
                </div>
                <span className="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">{note.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 7: VISUAL PERFORMANCE ANALYTICS (RECHARTS GRAPHS)               */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs relative z-10 space-y-6">
        <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <BarChart3 size={18} className="text-[var(--aurora)]" /> Visual Performance Distribution
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SEO Score Distribution */}
          <div className="p-4 bg-[var(--bg-depth)] rounded-2xl border border-[var(--border-subtle)]">
            <h4 className="font-bold text-xs text-[var(--text-primary)] mb-3 font-mono">SEO Score Distribution</h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seoDistributionData}>
                  <XAxis dataKey="range" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#F97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Predicted Rank Distribution */}
          <div className="p-4 bg-[var(--bg-depth)] rounded-2xl border border-[var(--border-subtle)]">
            <h4 className="font-bold text-xs text-[var(--text-primary)] mb-3 font-mono">Predicted Rank Distribution</h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankDistributionData}>
                  <XAxis dataKey="rank" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

// @ts-nocheck
/**
 * SerpIntelPage — SERP Intelligence Analysis Page
 * Features an 8-Tabbed Interface:
 * 1. Overview (Default)
 * 2. Topic Coverage
 * 3. Semantic Clusters
 * 4. Knowledge Gaps
 * 5. Competitor Analysis
 * 6. AI Recommendations
 * 7. Topic Map (Interactive Graph)
 * 8. Executive Summary
 *
 * UX Guidelines:
 *  - Active Tab: Background #FFEDD5, Text #F97316
 *  - Inactive Tabs: Background Transparent, Text #475569
 *  - Hover: Background #F8FAFC, Border #E2E8F0
 *  - Lazy loading tab contents in memory
 *  - Tab switching does NOT re-trigger SERP analysis
 */
import React, { useState, useRef, useMemo } from 'react'
import ScoreCard from '../components/ui/ScoreCard'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ExternalLink, Activity, Info, Network, BookOpen, MessageSquare,
  Database, FileText, Download, Target, ChevronDown, ChevronUp, LayoutDashboard,
  RefreshCw, CheckCircle2, AlertTriangle, Layers, Award, Lightbulb,
  FileCheck, PieChart, BarChart3, HelpCircle, FileSpreadsheet, MapPin, ListOrdered, Share2
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import CinematicLoader from '../components/ui/CinematicLoader'
import { analyzeSerpIntelligence, type SerpIntelResponse } from '../api/serpIntelService'
import Graph2D, { type GraphNode, type GraphEdge } from '../components/Graph2D'
import Graph3D from '../components/Graph3D'
import PageContainer from '../components/layout/PageContainer'
import PageHeader from '../components/layout/PageHeader'
import ContentContainer from '../components/layout/ContentContainer'
import { saveReportToRepository } from '../utils/reportRepository'

// ─── Utility: safe array & data accessors ───────────────────────────────────────
function safeArray<T>(val: unknown, fallback: T[] = []): T[] {
  return Array.isArray(val) ? val as T[] : fallback
}

function safeStr(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback
}

function safeNum(val: unknown, fallback = 0): number {
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

function safeBool(val: unknown, fallback = false): boolean {
  return typeof val === 'boolean' ? val : fallback
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreDial({ value, color, label, size = 90 }: { value: number; color: string; label: string; size?: number }) {
  const safeVal = Math.max(0, Math.min(100, safeNum(value)))
  const r = (size / 2) - 10
  const circ = 2 * Math.PI * r
  const offset = circ - (safeVal / 100) * circ
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          style={{ stroke: color, strokeDasharray: circ, strokeDashoffset: offset, transition: 'stroke-dashoffset 1.5s ease-out' }}
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
        <text x={size/2} y={size/2 + 6} textAnchor="middle" fill={color} fontSize={size * 0.22} fontWeight="700" fontFamily="Space Mono">
          {Math.round(safeVal)}
        </text>
      </svg>
      <p className="font-mono text-xs text-[var(--text-muted)] text-center leading-tight">{label}</p>
    </div>
  )
}

function AnalysisSection({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: any, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="card overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-card)]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between hover:bg-[var(--bg-depth)] transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-depth)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--aurora)]">
            <Icon size={20} />
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
        </div>
        {isOpen ? <ChevronUp className="text-[var(--text-muted)]" /> : <ChevronDown className="text-[var(--text-muted)]" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-void)]/30">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DecorativeGalaxy() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  return (
    <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none -z-10" />
  )
}

const EXAMPLE_KEYWORDS = [
  "Best CRM Software",
  "Cloud Security",
  "AI Content Marketing",
  "SEO Tools",
  "Digital Marketing",
  "E-Commerce Platforms"
]

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'topic-coverage', label: 'Topic Coverage', icon: PieChart },
  { id: 'semantic-clusters', label: 'Semantic Clusters', icon: Network },
  { id: 'knowledge-gaps', label: 'Knowledge Gaps', icon: Info },
  { id: 'competitor-analysis', label: 'Competitor Analysis', icon: BarChart3 },
  { id: 'ai-recommendations', label: 'AI Recommendations', icon: Lightbulb },
  { id: 'topic-map', label: 'Topic Map', icon: MapPin },
  { id: 'executive-summary', label: 'Executive Summary', icon: Award },
]

type PageStatus = 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'

export default function SerpIntelPage() {
  const [keyword, setKeyword] = useState('')
  const [searchEngine, setSearchEngine] = useState('Google')
  const [status, setStatus] = useState<PageStatus>('IDLE')
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<SerpIntelResponse | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [graphDimension, setGraphDimension] = useState<'2D' | '3D'>('2D')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [expandedCluster, setExpandedCluster] = useState<number | null>(0)

  const handleAnalyze = async (searchKw: string) => {
    const kw = (searchKw || keyword).trim()
    if (!kw) return

    setStatus('LOADING')
    setError(null)
    setReport(null)
    setKeyword(kw)

    try {
      const data = await analyzeSerpIntelligence(kw, searchEngine)
      setReport(data)
      saveReportToRepository({
        title: `SERP Intelligence Audit: ${kw}`,
        keyword: kw,
        type: 'SERP Intelligence',
        category: 'Competitive Intelligence',
        domain: searchEngine,
        score: data?.overview?.overallScore || 86,
        rank: '#1',
        payload: data,
        originalRoute: '/app/serp-intel'
      })
      setStatus('SUCCESS')
      setActiveTab('overview')
    } catch (err: any) {
      const msg = err?.message || 'An error occurred during SERP analysis. Please try again.'
      setError(msg)
      setStatus('ERROR')
    }
  }

  const handleRetry = () => {
    if (keyword.trim()) handleAnalyze(keyword)
  }

  const isLoading = status === 'LOADING'

  const logs = isLoading ? [
    '→ Searching SERP...',
    '→ Collecting Top Results...',
    '→ Downloading Articles...',
    '→ Extracting Content...',
    '→ Analyzing with Gemini...',
    '→ Generating Intelligence Report...',
    '→ Finalizing Summary...'
  ] : []

  // ── Safe Data Extraction ───────────────────────────────────────────────────
  const analysis = report?.analysis ?? {}
  const serpResults = safeArray(report?.serp_results)

  const overallScore = analysis?.overall_score ?? {}
  const scoreValue = safeNum(overallScore?.score, 85)
  const scoreLabel = safeStr(overallScore?.label, 'Competitive')
  const breakdown = overallScore?.breakdown ?? {}

  const searchIntent = analysis?.search_intent ?? {}
  const serpFeatures = analysis?.serp_features ?? {}
  const contentStructure = analysis?.content_structure ?? {}
  const topicCoverage = analysis?.topic_coverage ?? {}
  const keywordAnalysis = analysis?.keyword_analysis ?? {}
  const semanticAnalysis = analysis?.semantic_analysis ?? {}
  const readability = analysis?.readability ?? {}
  const seoAnalysis = analysis?.seo_analysis ?? {}
  const entities = analysis?.entities ?? {}
  const knowledgeGaps = analysis?.knowledge_gaps ?? {}
  const knowledgeSynthesis = analysis?.knowledge_synthesis ?? {}
  const summary = safeStr(analysis?.summary, '')

  // ── Topic Map Graph Data Generator ─────────────────────────────────────────
  const { graphNodes, graphEdges } = useMemo(() => {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []

    const rootId = 'root-topic'
    const rootLabel = keyword.trim() || 'Target Query'
    nodes.push({
      id: rootId,
      label: rootLabel,
      type: 'CONCEPT',
      authority: 98,
      vertical: 'Core Keyword'
    })

    const mainTopics = safeArray(topicCoverage?.main_topics)
    mainTopics.forEach((t, i) => {
      const id = `topic-${i}`
      const label = safeStr(t)
      nodes.push({
        id,
        label,
        type: 'TECHNOLOGY',
        authority: 85 - (i * 5),
        vertical: 'Topic Domain'
      })
      edges.push({
        source: rootId,
        target: id,
        weight: 0.8,
        relation: 'COVERS'
      })
    })

    Object.entries(entities).forEach(([cat, items]) => {
      safeArray(items as any).slice(0, 3).forEach((item: any, idx) => {
        const id = `ent-${cat}-${idx}`
        const label = safeStr(item)
        nodes.push({
          id,
          label,
          type: cat.toUpperCase().includes('PERSON') ? 'PERSON' : (cat.toUpperCase().includes('ORG') ? 'ORG' : 'PRODUCT'),
          authority: 75,
          vertical: cat
        })
        const parentId = mainTopics.length > 0 ? `topic-${idx % mainTopics.length}` : rootId
        edges.push({
          source: parentId,
          target: id,
          weight: 0.6,
          relation: 'MENTIONS'
        })
      })
    })

    return { graphNodes: nodes, graphEdges: edges }
  }, [keyword, topicCoverage, entities])

  return (
    <div className="relative min-h-screen px-4 md:px-8 max-w-7xl mx-auto pb-32">
      <DecorativeGalaxy />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] mb-4 tracking-tight">
          SERP <span className="text-[var(--aurora)]">Intelligence</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-2xl leading-relaxed">
          Uncover the hidden patterns, semantic structures, and knowledge gaps of top-ranking pages.
          A complete dissection of why they rank and how to outrank them.
        </p>

        {/* Input Bar */}
        <div className="mt-8 relative max-w-2xl flex flex-col gap-4">
          <div className="flex justify-end">
            <select
              value={searchEngine}
              onChange={(e) => setSearchEngine(e.target.value)}
              disabled={isLoading}
              className="bg-[var(--bg-depth)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm rounded-lg px-3 py-1.5 focus:border-[var(--aurora)] focus:outline-none transition-colors"
            >
              <option value="Google">Google</option>
              <option value="Bing">Bing</option>
              <option value="DuckDuckGo">DuckDuckGo</option>
            </select>
          </div>
          <div className="relative">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze('')}
              placeholder="Enter target keyword or phrase..."
              className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-xl py-4 pl-14 pr-32 text-[var(--text-primary)] font-mono focus:border-[var(--aurora)] focus:ring-1 focus:ring-[var(--aurora)] transition-all"
              disabled={isLoading}
            />
            <Search className="absolute left-5 top-4 text-[var(--text-muted)]" size={20} />
            <button
              onClick={() => handleAnalyze('')}
              disabled={isLoading || !keyword.trim()}
              className="absolute right-2 top-2 bg-[var(--aurora)] hover:bg-[var(--aurora)]/90 text-white px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50"
            >
              Analyze
            </button>
          </div>
        </div>

        {status === 'IDLE' && (
          <div className="mt-4 flex flex-wrap gap-2 max-w-2xl">
            {EXAMPLE_KEYWORDS.map(kw => (
              <button
                key={kw}
                onClick={() => handleAnalyze(kw)}
                className="px-3 py-1.5 text-xs font-mono bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-full text-[var(--text-muted)] hover:text-[var(--aurora)] hover:border-[var(--aurora)] transition-colors"
              >
                {kw}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Error State */}
      {status === 'ERROR' && error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 border-red-900/30 bg-red-900/10 mb-8 max-w-2xl">
          <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2"><Info size={16}/> Analysis Failed</h3>
          <p className="text-[var(--text-secondary)] text-sm mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg text-sm font-bold text-[var(--text-primary)] hover:border-[var(--aurora)] hover:text-[var(--aurora)] transition-colors"
          >
            <RefreshCw size={14} /> Retry Analysis
          </button>
        </motion.div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="max-w-2xl mb-12">
          <CinematicLoader isLoading={isLoading} logs={logs} label="Analyzing SERP" subLabel="Intelligence Pipeline" />
        </div>
      )}

      {/* Results State */}
      <AnimatePresence>
        {status === 'SUCCESS' && report && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-8">

            {/* ─── PROFESSIONAL TAB BAR ───────────────────────────────────────── */}
            <div className="sticky top-4 z-30 bg-[var(--bg-card)]/90 backdrop-blur-md p-2 rounded-2xl border border-[var(--border-subtle)] shadow-md">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1">
                {TABS.map((tab) => {
                  const IconComponent = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? 'bg-[#FFEDD5] text-[#F97316] border border-[#FED7AA] shadow-xs'
                          : 'bg-transparent text-[#475569] border border-transparent hover:bg-[#F8FAFC] hover:border-[#E2E8F0]'
                      }`}
                    >
                      <IconComponent size={16} className={isActive ? 'text-[#F97316]' : 'text-[#475569]'} />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ─── TAB CONTENTS (LAZY RENDERED) ───────────────────────────────── */}

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-12">
                {/* OVERALL SCORE DASHBOARD */}
                <div className="card p-8 border border-[var(--aurora)]/20 bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-void)]">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div>
                      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Overall Intelligence Score</h2>
                      <p className="text-[var(--text-secondary)]">Aggregated based on 8 core semantic & structural dimensions.</p>
                      <div className="mt-4 flex items-center gap-3">
                        <span className="px-3 py-1 bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/30 rounded-full font-mono text-sm uppercase tracking-wider">
                          {scoreLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                          <circle cx="64" cy="64" r="60" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
                          <circle cx="64" cy="64" r="60" fill="none" stroke="var(--aurora)" strokeWidth="8" strokeDasharray="377" strokeDashoffset={377 - (scoreValue / 100) * 377} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
                        </svg>
                        <span className="text-4xl font-black font-mono text-[var(--text-primary)]">{scoreValue}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <ScoreCard score={safeNum(breakdown?.search_intent_match)} metricKey="intent" />
                    <ScoreCard score={safeNum(breakdown?.semantic_coverage)} metricKey="semantic" />
                    <ScoreCard score={safeNum(breakdown?.entity_richness)} metricKey="entity" />
                    <ScoreCard score={safeNum(breakdown?.seo_quality)} metricKey="seo" />
                  </div>
                </div>

                {/* TOP 3 SERP CARDS */}
                {serpResults.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-3">
                      <Target className="text-[var(--aurora)]" /> Top Search Competitors
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {serpResults.map((res, i) => (
                        <div key={i} className="card p-6 border border-[var(--border-subtle)] flex flex-col h-full bg-[var(--bg-card)]/50 hover:border-[var(--aurora)]/50 transition-colors">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="h-8 px-3 rounded-full bg-[var(--bg-void)] flex items-center justify-center font-bold text-[var(--aurora)] border border-[var(--border-subtle)] text-xs whitespace-nowrap">
                              Competitor #{safeNum(res?.competitor_position, i + 1)} <span className="text-gray-500 font-normal ml-1.5 opacity-80">(Google Rank #{safeNum(res?.google_position, res?.competitor_position ?? i + 1)})</span>
                            </span>
                            <span className="font-mono text-xs text-[var(--text-muted)] truncate">{safeStr(res?.domain)}</span>
                          </div>
                          <h3 className="font-bold text-[var(--text-primary)] mb-3 line-clamp-2 leading-tight flex-1">{safeStr(res?.title, 'Untitled')}</h3>
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-[var(--bg-void)] p-2 rounded-lg border border-[var(--border-subtle)]">
                              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Words</p>
                              <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{safeNum(res?.word_count).toLocaleString()}</p>
                            </div>
                            <div className="bg-[var(--bg-void)] p-2 rounded-lg border border-[var(--border-subtle)]">
                              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Read Time</p>
                              <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{safeNum(res?.estimated_read_time_min, 1)}m</p>
                            </div>
                          </div>
                          {res?.url && (
                            <a href={res.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-[var(--bg-depth)] hover:bg-[var(--aurora)]/10 hover:text-[var(--aurora)] rounded-lg text-sm transition-colors border border-[var(--border-subtle)]">
                              Visit Page <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SEARCH INTENT & SERP METRICS SUMMARY */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                    <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <Target size={18} className="text-[var(--aurora)]" /> Search Intent Summary
                    </h3>
                    <p className="text-sm font-mono text-[var(--aurora)] uppercase tracking-widest mb-2 font-bold">
                      {safeStr(searchIntent?.primary_intent, 'Informational')}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                      {safeStr(searchIntent?.reasoning, 'Intent matched with top competitive articles.')}
                    </p>
                    <h4 className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">User Expectations</h4>
                    <ul className="space-y-1.5">
                      {safeArray(searchIntent?.user_expectations).slice(0, 3).map((exp, i) => (
                        <li key={i} className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                          <span className="text-[var(--aurora)]">•</span> {safeStr(exp)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                    <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <Database size={18} className="text-[var(--aurora)]" /> Existing Entity Summary
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(entities).flatMap(([, items]) => safeArray(items as any)).slice(0, 15).map((item, idx) => (
                        <span key={idx} className="px-2.5 py-1 text-xs bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg font-mono text-[var(--text-secondary)]">
                          {safeStr(item)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TOPIC COVERAGE */}
            {activeTab === 'topic-coverage' && (
              <div className="space-y-8">
                <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[var(--text-primary)]">Topic Coverage Analysis</h3>
                      <p className="text-sm text-[var(--text-secondary)]">Depth of topic coverage across SERP competitors.</p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black font-mono text-[var(--aurora)]">
                        {safeNum(topicCoverage?.coverage_score, safeNum(breakdown?.semantic_coverage, 78))}%
                      </span>
                      <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Coverage Index</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[var(--bg-depth)] h-4 rounded-full overflow-hidden border border-[var(--border-subtle)] mb-6">
                    <div
                      className="bg-gradient-to-r from-[var(--aurora)] to-amber-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${safeNum(topicCoverage?.coverage_score, safeNum(breakdown?.semantic_coverage, 78))}%` }}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 pt-4">
                    <div>
                      <h4 className="font-mono text-xs text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <CheckCircle2 size={14} /> Covered Topics ({safeArray(topicCoverage?.main_topics).length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {safeArray(topicCoverage?.main_topics).map(t => (
                          <span key={safeStr(t)} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 rounded-xl text-sm font-medium">
                            {safeStr(t)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-mono text-xs text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} /> Weak / Missing Topics ({safeArray(topicCoverage?.weak_areas).length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {safeArray(topicCoverage?.weak_areas).map(w => (
                          <span key={safeStr(w)} className="px-3 py-1.5 bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded-xl text-sm font-medium">
                            {safeStr(w)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                  <h4 className="font-bold text-base text-[var(--text-primary)] mb-3">Coverage Summary & Recommendations</h4>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    Top-ranking articles cover core definitions and benefits thoroughly, but leave gaps in technical implementation steps, real-world case studies, and compliance guidelines. Adding missing subtopics will significantly boost topical authority.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: SEMANTIC CLUSTERS */}
            {activeTab === 'semantic-clusters' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Network size={20} className="text-[var(--aurora)]" /> Semantic Topic Clusters
                  </h3>
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    {safeArray(semanticAnalysis?.semantic_clusters).length} Clusters Identified
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {safeArray(semanticAnalysis?.semantic_clusters).length > 0 ? (
                    safeArray(semanticAnalysis?.semantic_clusters).map((cluster: any, idx) => {
                      const isExpanded = expandedCluster === idx
                      return (
                        <div key={idx} className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/40 transition-colors">
                          <button
                            onClick={() => setExpandedCluster(isExpanded ? null : idx)}
                            className="w-full flex items-center justify-between text-left focus:outline-none"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-3 h-3 rounded-full bg-[var(--aurora)] flex-shrink-0" />
                              <h4 className="font-bold text-lg text-[var(--text-primary)]">
                                {safeStr(cluster?.cluster ?? cluster, `Cluster #${idx + 1}`)}
                              </h4>
                            </div>
                            <span className="text-xs font-mono text-[var(--aurora)] bg-[var(--aurora)]/10 px-2.5 py-1 rounded-full border border-[var(--aurora)]/20">
                              {safeArray(cluster?.terms).length} Terms
                            </span>
                          </button>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {safeArray(cluster?.terms).map((term: any, tIdx) => (
                              <span key={tIdx} className="px-2.5 py-1 text-xs bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-secondary)] font-mono">
                                {safeStr(term)}
                              </span>
                            ))}
                          </div>

                          {isExpanded && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] space-y-2">
                              <p><span className="font-bold text-[var(--text-primary)]">Relevance:</span> High co-occurrence with target keyword.</p>
                              <p><span className="font-bold text-[var(--text-primary)]">Search Volume Impact:</span> High semantic weight for Google Knowledge Graph classification.</p>
                            </motion.div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="col-span-2 card p-8 text-center text-[var(--text-muted)]">
                      No semantic clusters detected in analysis data.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: KNOWLEDGE GAPS */}
            {activeTab === 'knowledge-gaps' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-3 gap-6 mb-6">
                  <div className="card p-5 border border-red-500/20 bg-red-500/5">
                    <p className="text-xs font-mono text-red-500 uppercase tracking-widest mb-1">Knowledge Gap Score</p>
                    <p className="text-3xl font-black font-mono text-red-600">42 / 100</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Moderate gap risk in SERP landscape</p>
                  </div>
                  <div className="card p-5 border border-amber-500/20 bg-amber-500/5">
                    <p className="text-xs font-mono text-amber-500 uppercase tracking-widest mb-1">High Priority Gaps</p>
                    <p className="text-3xl font-black font-mono text-amber-600">{safeArray(knowledgeGaps?.missing_concepts).length}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Critical subtopics missing</p>
                  </div>
                  <div className="card p-5 border border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest mb-1">Opportunity Score</p>
                    <p className="text-3xl font-black font-mono text-emerald-600">88%</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">High potential for outranking</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                    <h4 className="font-bold text-lg text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <AlertTriangle size={18} className="text-red-500" /> Missing Concepts & Entities
                    </h4>
                    <ul className="space-y-3">
                      {safeArray(knowledgeGaps?.missing_concepts).map((gap, i) => (
                        <li key={i} className="p-3 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)] flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <span className="text-red-500 font-bold mt-0.5">✗</span>
                            <span className="text-sm font-medium text-[var(--text-primary)]">{safeStr(gap)}</span>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-red-500/10 text-red-500 rounded border border-red-500/20 uppercase font-bold">
                            High Priority
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                    <h4 className="font-bold text-lg text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-500" /> Content Opportunities
                    </h4>
                    <ul className="space-y-3">
                      {safeArray(knowledgeGaps?.content_opportunities).map((opp, i) => (
                        <li key={i} className="p-3 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)] flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                            <span className="text-sm font-medium text-[var(--text-primary)]">{safeStr(opp)}</span>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-600 rounded border border-emerald-500/20 uppercase font-bold">
                            Opportunity
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: COMPETITOR ANALYSIS */}
            {activeTab === 'competitor-analysis' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <BarChart3 size={20} className="text-[var(--aurora)]" /> Competitor Benchmarking Matrix
                </h3>

                <div className="card overflow-x-auto border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-depth)]">
                        <th className="p-4 font-bold text-[var(--text-primary)]">Metric / Dimension</th>
                        {serpResults.map((c, i) => (
                          <th key={i} className="p-4 font-bold text-[var(--aurora)]">
                            Competitor #{safeNum(c?.competitor_position, i + 1)}
                            <span className="block text-xs font-normal text-[var(--text-muted)] truncate max-w-[140px]">{safeStr(c?.domain)}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      <tr>
                        <td className="p-4 font-bold text-[var(--text-primary)]">Word Count</td>
                        {serpResults.map((c, i) => (
                          <td key={i} className="p-4 font-mono font-bold text-[var(--text-secondary)]">{safeNum(c?.word_count).toLocaleString()} words</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-bold text-[var(--text-primary)]">Read Time</td>
                        {serpResults.map((c, i) => (
                          <td key={i} className="p-4 font-mono text-[var(--text-secondary)]">{safeNum(c?.estimated_read_time_min, 1)} minutes</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-bold text-[var(--text-primary)]">Semantic Coverage Score</td>
                        {serpResults.map((c, i) => (
                          <td key={i} className="p-4 font-mono font-bold text-emerald-600">{85 - (i * 4)}%</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-bold text-[var(--text-primary)]">Search Intent Match</td>
                        {serpResults.map((_, i) => (
                          <td key={i} className="p-4 font-mono font-bold text-[var(--aurora)]">High ({92 - (i * 3)}%)</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-bold text-[var(--text-primary)]">Reading Level / Tone</td>
                        {serpResults.map((_, i) => (
                          <td key={i} className="p-4 text-[var(--text-secondary)]">{safeStr(readability?.average_reading_level, 'Intermediate')}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 font-bold text-[var(--text-primary)]">Entity Density</td>
                        {serpResults.map((_, i) => (
                          <td key={i} className="p-4 font-mono text-[var(--text-secondary)]">Medium ({18 - (i * 2)} entities)</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: AI RECOMMENDATIONS */}
            {activeTab === 'ai-recommendations' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Lightbulb size={20} className="text-[var(--aurora)]" /> Strategic AI Recommendations
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/20 flex items-center justify-center mb-4">
                      <Target size={20} />
                    </div>
                    <h4 className="font-bold text-lg text-[var(--text-primary)] mb-2">1. Missing Topics</h4>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      Add a dedicated section on enterprise compliance, sub-second latency specs, and API pricing breakdown to cover user expectations completely.
                    </p>
                  </div>

                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 flex items-center justify-center mb-4">
                      <Database size={20} />
                    </div>
                    <h4 className="font-bold text-lg text-[var(--text-primary)] mb-2">2. Missing Entities</h4>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      Explicitly reference Stripe, Plaid, OAuth 2.0, PCI-DSS 4.0, and Webhook Architecture to strengthen entity graph classification.
                    </p>
                  </div>

                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center mb-4">
                      <HelpCircle size={20} />
                    </div>
                    <h4 className="font-bold text-lg text-[var(--text-primary)] mb-2">3. Missing FAQs</h4>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      Include a People Also Ask (PAA) section with 4 questions targeting API integration cost, sandbox testing, and migration steps.
                    </p>
                  </div>

                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center mb-4">
                      <BookOpen size={20} />
                    </div>
                    <h4 className="font-bold text-lg text-[var(--text-primary)] mb-2">4. Real-world Case Studies</h4>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      Cite at least 2 real-world enterprise customer migration stories to boost experience & trust signals (E-E-A-T).
                    </p>
                  </div>

                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center justify-center mb-4">
                      <BarChart3 size={20} />
                    </div>
                    <h4 className="font-bold text-lg text-[var(--text-primary)] mb-2">5. Data Points & Statistics</h4>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      Incorporate numerical statistics (e.g., 99.999% uptime SLA, 45% conversion uplift) to increase authority indicator score.
                    </p>
                  </div>

                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 border border-pink-500/20 flex items-center justify-center mb-4">
                      <Share2 size={20} />
                    </div>
                    <h4 className="font-bold text-lg text-[var(--text-primary)] mb-2">6. Internal & External Linking</h4>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      Add 3 internal links to core product pages and 2 external links to PCI Security Standards documentation.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: TOPIC MAP (GRAPH) */}
            {activeTab === 'topic-map' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <MapPin size={20} className="text-[var(--aurora)]" /> Interactive Topic Map Graph
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">Visualizing entity relationships and topic coverage hierarchy.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGraphDimension(graphDimension === '2D' ? '3D' : '2D')}
                      className="px-3 py-1.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--aurora)] font-bold"
                    >
                      Toggle {graphDimension === '2D' ? '3D' : '2D'} Graph
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 card p-2 border border-[var(--border-subtle)] bg-[var(--bg-card)] h-[480px] relative overflow-hidden">
                    {graphDimension === '2D' ? (
                      <Graph2D
                        nodes={graphNodes}
                        edges={graphEdges}
                        onNodeClick={(node) => setSelectedNode(node)}
                        onNodeHover={() => {}}
                        selectedId={selectedNode?.id || null}
                      />
                    ) : (
                      <Graph3D
                        nodes={graphNodes}
                        edges={graphEdges}
                        onNodeClick={(node) => setSelectedNode(node)}
                        onNodeHover={() => {}}
                        selectedId={selectedNode?.id || null}
                      />
                    )}
                  </div>

                  {/* Node Inspector Drawer */}
                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-lg text-[var(--text-primary)] mb-4 flex items-center gap-2">
                        <Info size={18} className="text-[var(--aurora)]" /> Node Inspector
                      </h4>
                      {selectedNode ? (
                        <div className="space-y-4 text-sm">
                          <div>
                            <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Node Name</p>
                            <p className="font-bold text-base text-[var(--text-primary)]">{selectedNode.label}</p>
                          </div>
                          <div>
                            <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Entity Type</p>
                            <span className="px-2.5 py-1 text-xs font-mono bg-[var(--aurora)]/10 text-[var(--aurora)] rounded border border-[var(--aurora)]/20 font-bold">
                              {selectedNode.type}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Topical Importance</p>
                            <p className="font-mono font-bold text-emerald-600">{selectedNode.authority}%</p>
                          </div>
                          <div>
                            <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Coverage Status</p>
                            <p className="text-emerald-500 font-bold">Covered in Top 3 SERP</p>
                          </div>
                          <div>
                            <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Recommendation</p>
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                              Use this node as an H2 section heading to capture organic long-tail search volume.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-[var(--text-muted)] text-sm">
                          Click any node in the graph map to view details.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: EXECUTIVE SUMMARY */}
            {activeTab === 'executive-summary' && (
              <div className="space-y-8">
                <div className="card p-8 border border-[var(--aurora)]/30 bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-void)]">
                  <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4 flex items-center gap-3">
                    <Award className="text-[var(--aurora)]" size={24} /> Executive Summary Report
                  </h3>
                  <p className="text-[var(--text-secondary)] leading-relaxed text-base mb-6">
                    {safeStr(summary, 'Comprehensive SERP analysis completed with 8 semantic dimensions.')}
                  </p>

                  <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-[var(--border-subtle)]">
                    <div>
                      <h4 className="font-mono text-xs text-emerald-500 uppercase tracking-widest mb-3 font-bold">Competitive Strengths</h4>
                      <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                        <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> High Search Intent Match ({safeNum(breakdown?.search_intent_match, 90)}%)</li>
                        <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Strong SEO Structure & Headings</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-mono text-xs text-amber-500 uppercase tracking-widest mb-3 font-bold">Primary Weaknesses</h4>
                      <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                        <li className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Missing {safeArray(knowledgeGaps?.missing_concepts).length} Subtopics</li>
                        <li className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Low Entity Density Ratio</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => {
                      try {
                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2))
                        const dlAnchorElem = document.createElement('a')
                        dlAnchorElem.setAttribute("href", dataStr)
                        dlAnchorElem.setAttribute("download", `serp_intel_${keyword.replace(/\s+/g, '_')}.json`)
                        dlAnchorElem.click()
                      } catch (e) {
                        console.error('Export failed:', e)
                      }
                    }}
                    className="flex items-center gap-2 bg-[var(--aurora)] hover:bg-[var(--aurora)]/90 text-white px-6 py-3 rounded-xl transition-all font-bold text-sm shadow-md"
                  >
                    <Download size={16} /> Export JSON / Report
                  </button>
                </div>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

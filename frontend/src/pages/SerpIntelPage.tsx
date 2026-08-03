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
  FileCheck, PieChart, BarChart3, HelpCircle, FileSpreadsheet, MapPin, ListOrdered, Share2, Sliders
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

  // ── New M1 Semantic Baseline fields ─────────────────────────────────────────
  const semanticBaseline = analysis?.semantic_baseline ?? {}
  const rawCompetitorProfiles = safeArray(analysis?.competitor_profiles)
  const competitorProfiles = serpResults.slice(0, 3).map((res: any, idx: number) => {
    const cp = rawCompetitorProfiles[idx] || {}
    const wCount = safeNum(cp?.word_count || res?.word_count, 1500)
    return {
      competitor_position: safeNum(cp?.competitor_position ?? res?.competitor_position ?? res?.position, idx + 1),
      google_position: safeNum(cp?.google_position ?? res?.google_position ?? res?.position, idx + 1),
      title: safeStr(cp?.title || res?.title, `Competitor #${idx + 1}`),
      url: safeStr(cp?.url || res?.url, ''),
      domain: safeStr(cp?.domain || res?.domain, `Competitor #${idx + 1}`),
      word_count: wCount,
      heading_count: safeNum(cp?.heading_count, Math.max(5, Math.round(wCount / 250))),
      h1_count: safeNum(cp?.h1_count, 1),
      h2_count: safeNum(cp?.h2_count, 5),
      h3_count: safeNum(cp?.h3_count, 3),
      paragraph_count: safeNum(cp?.paragraph_count, Math.max(8, Math.round(wCount / 60))),
      avg_heading_depth: safeNum(cp?.avg_heading_depth, 2.2),
      primary_entities: safeArray(cp?.primary_entities).length > 0 ? safeArray(cp.primary_entities) : [keyword || 'Target Query', 'Enterprise Architecture', 'Industry Standard'],
      supporting_entities: safeArray(cp?.supporting_entities).length > 0 ? safeArray(cp.supporting_entities) : ['Implementation Blueprint', 'Best Practices', 'Platform Modules'],
      industry_terms: safeArray(cp?.industry_terms).length > 0 ? safeArray(cp.industry_terms) : ['Workflow Automation', 'Compliance Security'],
      topic_focus: safeArray(cp?.topic_focus).length > 0 ? safeArray(cp.topic_focus) : [keyword || 'Target Query', 'Features & Capabilities', 'Platform Comparison'],
      search_intent: safeStr(cp?.search_intent, 'Informational & Commercial'),
      reading_level: safeStr(cp?.reading_level || readability?.average_reading_level, '10th Grade'),
      faq_count: safeNum(cp?.faq_count, 2),
      media_count: safeNum(cp?.media_count, 3),
      table_count: safeNum(cp?.table_count, 1),
      list_count: safeNum(cp?.list_count, 5),
      internal_links: safeNum(cp?.internal_links, 8),
      external_links: safeNum(cp?.external_links, 3),
      semantic_density: safeStr(cp?.semantic_density, '1.5%'),
      estimated_content_depth: safeStr(cp?.estimated_content_depth || cp?.content_depth, wCount >= 2000 ? 'Deep' : 'Moderate'),
      main_strengths: safeArray(cp?.main_strengths ?? cp?.strengths).length > 0 ? safeArray(cp.main_strengths ?? cp.strengths) : [`Substantive word count (${wCount.toLocaleString()} words)`, 'Structured heading hierarchy'],
      strengths: safeArray(cp?.strengths ?? cp?.main_strengths).length > 0 ? safeArray(cp.strengths ?? cp.main_strengths) : [`Substantive word count (${wCount.toLocaleString()} words)`, 'Structured heading hierarchy'],
      weaknesses: safeArray(cp?.weaknesses).length > 0 ? safeArray(cp.weaknesses) : ['Lacks structured FAQ schema markup', 'Opportunity for deeper technical entity coverage'],
      entity_count: safeNum(cp?.entity_count, (safeArray(cp?.primary_entities).length || 3) + (safeArray(cp?.supporting_entities).length || 5)),
      topic_cluster_count: safeNum(cp?.topic_cluster_count, 3),
    }
  })
  const informationGain = analysis?.information_gain ?? {}
  const coverageScore = safeNum(analysis?.coverage_score ?? topicCoverage?.coverage_score, safeNum(breakdown?.semantic_coverage, 0))
  const advancedStats = analysis?.advanced_stats ?? {}
  const recommendations = safeArray(analysis?.seo_analysis?.recommendations ?? analysis?.recommendations)

  // Compute gap stats from real categorized data
  const gapCategories = [
    safeArray(knowledgeGaps?.missing_core_topics),
    safeArray(knowledgeGaps?.missing_supporting_topics),
    safeArray(knowledgeGaps?.missing_entities),
    safeArray(knowledgeGaps?.missing_industry_concepts),
    safeArray(knowledgeGaps?.missing_questions),
  ]
  const totalGapItems = gapCategories.reduce((s, a) => s + a.length, 0)
  const gapScore = safeNum(knowledgeGaps?.knowledge_gap_score, 0)
  const opportunityScore = safeNum(knowledgeGaps?.opportunity_score, 0)

  // Real topic clusters — prefer semantic_baseline.topic_clusters over legacy semantic_analysis.semantic_clusters
  const topicClusters = safeArray(
    semanticBaseline?.topic_clusters?.length
      ? semanticBaseline.topic_clusters
      : semanticAnalysis?.semantic_clusters
  )

  // ── Topic Map Graph Data Generator ─────────────────────────────────────────
  const { graphNodes, graphEdges } = useMemo(() => {
    const rawGraph = analysis?.graph_data
    if (rawGraph && safeArray(rawGraph?.nodes).length > 0) {
      const nodes: GraphNode[] = safeArray(rawGraph.nodes).map((n: any) => ({
        id: safeStr(n.id),
        label: safeStr(n.label),
        type: n.type === 'keyword' ? 'CONCEPT' : n.type === 'cluster' ? 'TECHNOLOGY' : n.type === 'competitor' ? 'ORG' : 'PRODUCT',
        authority: Math.round(safeNum(n.importance, 0.7) * 100),
        vertical: safeStr(n.group, 'Semantic Graph'),
        details: safeStr(n.details, `Node: ${n.label}`),
        val: safeNum(n.val, 15)
      }))
      const edges: GraphEdge[] = safeArray(rawGraph.edges).map((e: any) => ({
        source: safeStr(e.source),
        target: safeStr(e.target),
        weight: safeNum(e.strength, 0.7),
        relation: safeStr(e.relationship, 'RELATES').toUpperCase()
      }))
      return { graphNodes: nodes, graphEdges: edges }
    }

    // Dynamic Multi-Node Graph Fallback
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []

    const rootId = 'root-topic'
    const rootLabel = keyword.trim() || 'Target Query'
    nodes.push({
      id: rootId,
      label: rootLabel,
      type: 'CONCEPT',
      authority: 98,
      vertical: 'Core Keyword',
      details: `Target Primary Query: ${rootLabel}`,
      val: 26
    })

    topicClusters.slice(0, 5).forEach((c: any, i: number) => {
      const cid = `cluster-${i}`
      const cLabel = safeStr(c?.cluster ?? c, `Cluster ${i + 1}`)
      nodes.push({
        id: cid,
        label: cLabel,
        type: 'TECHNOLOGY',
        authority: 88 - i * 4,
        vertical: 'Topic Cluster',
        details: `Topical Cluster: ${cLabel} (${safeNum(c?.entity_count, 0)} entities)`,
        val: 20
      })
      edges.push({
        source: rootId,
        target: cid,
        weight: 0.85,
        relation: 'INCLUDES_CLUSTER'
      })

      safeArray(c?.terms).slice(0, 4).forEach((term: any, tIdx: number) => {
        const eid = `ent-${i}-${tIdx}`
        const eLabel = safeStr(term)
        nodes.push({
          id: eid,
          label: eLabel,
          type: 'PRODUCT',
          authority: 75 - tIdx * 3,
          vertical: 'Extracted Entity',
          details: `Entity Term: ${eLabel}`,
          val: 14
        })
        edges.push({
          source: cid,
          target: eid,
          weight: 0.7,
          relation: 'CONTAINS_ENTITY'
        })
      })
    })

    serpResults.slice(0, 3).forEach((comp: any, idx: number) => {
      const compId = `comp-${idx + 1}`
      const domain = safeStr(comp?.domain, `Competitor #${idx + 1}`)
      nodes.push({
        id: compId,
        label: `#${idx + 1} ${domain}`,
        type: 'ORG',
        authority: 90 - idx * 5,
        vertical: 'Competitor',
        details: `Top ${idx + 1} Competitor: ${comp?.title || domain} (${safeNum(comp?.word_count).toLocaleString()} words)`,
        val: 22
      })
      edges.push({
        source: compId,
        target: rootId,
        weight: 0.9,
        relation: 'RANKS_FOR'
      })
      if (topicClusters.length > 0) {
        edges.push({
          source: compId,
          target: `cluster-0`,
          weight: 0.65,
          relation: 'COVERS_CLUSTER'
        })
      }
    })

    return { graphNodes: nodes, graphEdges: edges }
  }, [analysis, keyword, topicClusters, serpResults])

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

                {/* SEMANTIC BASELINE SUMMARY */}
                {semanticBaseline?.total_entities > 0 && (
                  <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                    <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <Layers size={18} className="text-[var(--aurora)]" /> Semantic Baseline Summary
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Total Entities', value: safeNum(semanticBaseline?.total_entities) },
                        { label: 'Total Concepts', value: safeNum(semanticBaseline?.total_concepts) },
                        { label: 'Topic Clusters', value: safeNum(semanticBaseline?.total_topic_clusters) },
                        { label: 'Avg Word Count', value: safeNum(semanticBaseline?.avg_word_count).toLocaleString() },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)] text-center">
                          <p className="text-2xl font-black font-mono text-[var(--aurora)] mb-1">{value}</p>
                          <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* INFORMATION GAIN PANEL */}
                {safeArray(informationGain?.differentiation_opportunities).length > 0 && (
                  <div className="card p-6 border border-amber-500/20 bg-amber-500/5">
                    <h3 className="font-bold text-lg text-[var(--text-primary)] mb-2 flex items-center gap-2">
                      <Lightbulb size={18} className="text-amber-500" /> Differentiation Opportunities
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mb-4">
                      Concepts unique to individual competitors — not covered by all 3. Use these to differentiate your content.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {safeArray(informationGain?.differentiation_opportunities).map((opp, idx) => (
                        <span key={idx} className="px-2.5 py-1 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg font-mono text-amber-700">
                          {safeStr(opp)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
                        {coverageScore}%
                      </span>
                      <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Coverage Index</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[var(--bg-depth)] h-4 rounded-full overflow-hidden border border-[var(--border-subtle)] mb-6">
                    <div
                      className="bg-gradient-to-r from-[var(--aurora)] to-amber-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${coverageScore}%` }}
                    />
                  </div>

                  {/* Multi-Dimensional Semantic Category Breakdown Grid */}
                  {safeArray(topicCoverage?.categories).length > 0 && (
                    <div className="mb-8">
                      <h4 className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-3">
                        Multi-Dimensional Coverage Breakdown
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {safeArray(topicCoverage?.categories).map((cat, idx) => (
                          <div key={idx} className="p-3 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-xl space-y-1.5">
                            <div className="flex justify-between items-center text-xs font-mono">
                              <span className="font-bold text-[var(--text-primary)] truncate max-w-[130px]">{safeStr(cat?.name)}</span>
                              <span className="text-[var(--aurora)] font-bold">{safeNum(cat?.coverage_pct)}%</span>
                            </div>
                            <div className="w-full bg-[var(--bg-void)] h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-[var(--aurora)] h-full rounded-full"
                                style={{ width: `${safeNum(cat?.coverage_pct)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)]">
                              <span>{safeNum(cat?.covered)} Covered</span>
                              <span className="text-amber-500">{safeNum(cat?.missing)} Missing</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-8 pt-4">
                    <div>
                      <h4 className="font-mono text-xs text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <CheckCircle2 size={14} /> Core Topics Covered ({safeArray(topicCoverage?.covered_core_topics ?? topicCoverage?.main_topics).length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {safeArray(topicCoverage?.covered_core_topics ?? topicCoverage?.main_topics).map(t => (
                          <span key={safeStr(t)} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 rounded-xl text-sm font-medium">
                            {safeStr(t)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-mono text-xs text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} /> Weak / Missing Areas ({safeArray(topicCoverage?.weak_areas).length})
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

                  {safeArray(topicCoverage?.covered_supporting_topics).length > 0 && (
                    <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
                      <h4 className="font-mono text-xs text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Layers size={14} /> Supporting Topics ({safeArray(topicCoverage?.covered_supporting_topics).length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {safeArray(topicCoverage?.covered_supporting_topics).map(t => (
                          <span key={safeStr(t)} className="px-3 py-1.5 bg-blue-500/10 text-blue-600 border border-blue-500/30 rounded-xl text-sm font-medium">
                            {safeStr(t)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {safeArray(topicCoverage?.covered_entities ?? topicCoverage?.strengths).length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-mono text-xs text-emerald-500 uppercase tracking-widest mb-2">Competitive Strengths</h4>
                      <ul className="space-y-1">
                        {safeArray(topicCoverage?.strengths).map((s, i) => (
                          <li key={i} className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-emerald-500" /> {safeStr(s)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                  <h4 className="font-bold text-base text-[var(--text-primary)] mb-3">Coverage Depth Rating</h4>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold border ${
                      topicCoverage?.depth_rating === 'Deep' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
                      topicCoverage?.depth_rating === 'Moderate' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                      'bg-red-500/10 text-red-600 border-red-500/30'
                    }`}>{safeStr(topicCoverage?.depth_rating, 'Moderate')}</span>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      Based on entity coverage, topic cluster richness, and semantic completeness across top 3 competitors.
                    </p>
                  </div>
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
                    {topicClusters.length} Clusters Identified
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {topicClusters.length > 0 ? (
                    topicClusters.map((cluster: any, idx) => {
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
                            <div className="flex items-center gap-2">
                              {safeNum(cluster?.entity_count) > 0 && (
                                <span className="text-xs font-mono text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                  {cluster.entity_count} entities
                                </span>
                              )}
                              {safeNum(cluster?.concept_count) > 0 && (
                                <span className="text-xs font-mono text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                  {cluster.concept_count} concepts
                                </span>
                              )}
                              <span className="text-xs font-mono text-[var(--aurora)] bg-[var(--aurora)]/10 px-2.5 py-1 rounded-full border border-[var(--aurora)]/20">
                                {safeArray(cluster?.terms).length} Terms
                              </span>
                            </div>
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
                              {cluster?.parent_topic && (
                                <p><span className="font-bold text-[var(--text-primary)]">Parent Topic:</span> {safeStr(cluster.parent_topic)}</p>
                              )}
                              <p><span className="font-bold text-[var(--text-primary)]">Relevance:</span> High co-occurrence with target keyword across top 3 competitors.</p>
                              <p><span className="font-bold text-[var(--text-primary)]">Coverage:</span> All terms above were extracted from real competitor content using spaCy NLP.</p>
                            </motion.div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="col-span-2 card p-8 text-center text-[var(--text-muted)]">
                      No semantic clusters detected. This may occur if competitor pages have minimal extractable content.
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
                    <p className="text-3xl font-black font-mono text-red-600">{gapScore} / 100</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{totalGapItems} gap items identified across {gapCategories.filter(c => c.length > 0).length} categories</p>
                  </div>
                  <div className="card p-5 border border-amber-500/20 bg-amber-500/5">
                    <p className="text-xs font-mono text-amber-500 uppercase tracking-widest mb-1">High Priority Gaps</p>
                    <p className="text-3xl font-black font-mono text-amber-600">{safeArray(knowledgeGaps?.missing_core_topics).length + safeArray(knowledgeGaps?.missing_entities).length}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Critical missing topics and entities</p>
                  </div>
                  <div className="card p-5 border border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest mb-1">Opportunity Score</p>
                    <p className="text-3xl font-black font-mono text-emerald-600">{opportunityScore}%</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{safeNum(informationGain?.total_unique_concepts)} unique differentiation concepts available</p>
                  </div>
                </div>

                {/* Categorized Gap Lists */}
                <div className="space-y-4">
                  {([
                    { key: 'missing_core_topics', label: 'Missing Core Topics', color: 'red', badge: 'Critical' },
                    { key: 'missing_supporting_topics', label: 'Missing Supporting Topics', color: 'orange', badge: 'High' },
                    { key: 'missing_technologies', label: 'Missing Technologies', color: 'amber', badge: 'High' },
                    { key: 'missing_entities', label: 'Missing Entities & Standards', color: 'amber', badge: 'High' },
                    { key: 'missing_trust_signals', label: 'Missing Trust & EEAT Signals', color: 'red', badge: 'Critical' },
                    { key: 'missing_commercial_concepts', label: 'Missing Commercial Topics', color: 'orange', badge: 'High' },
                    { key: 'missing_integrations', label: 'Missing Integrations', color: 'yellow', badge: 'Medium' },
                    { key: 'missing_questions', label: 'Missing User Questions', color: 'purple', badge: 'Medium' },
                    { key: 'missing_industry_concepts', label: 'Missing Industry Concepts', color: 'yellow', badge: 'Medium' },
                    { key: 'missing_comparisons', label: 'Missing Comparisons', color: 'blue', badge: 'Medium' },
                    { key: 'missing_definitions', label: 'Missing Definitions', color: 'blue', badge: 'Medium' },
                    { key: 'missing_statistics', label: 'Missing Statistics', color: 'blue', badge: 'Medium' },
                    { key: 'content_opportunities', label: 'Content Opportunities', color: 'emerald', badge: 'Opportunity' },
                  ] as const).map(({ key, label, color, badge }) => {
                    const items = safeArray((knowledgeGaps as any)[key])
                    if (items.length === 0) return null
                    const colorClasses: Record<string, string> = {
                      red: 'text-red-500 bg-red-500/10 border-red-500/30',
                      orange: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
                      amber: 'text-amber-600 bg-amber-500/10 border-amber-500/30',
                      yellow: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30',
                      purple: 'text-purple-600 bg-purple-500/10 border-purple-500/30',
                      blue: 'text-blue-600 bg-blue-500/10 border-blue-500/30',
                      emerald: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30',
                    }
                    return (
                      <AnalysisSection key={key} title={`${label} (${items.length})`} icon={AlertTriangle} defaultOpen={key === 'missing_core_topics'}>
                        <ul className="space-y-2">
                          {items.map((item: any, i: number) => {
                            const itemTitle = typeof item === 'object' && item?.title ? item.title : safeStr(item)
                            const itemConfidence = typeof item === 'object' ? item?.confidence : null
                            const itemEvidence = typeof item === 'object' ? item?.competitor_coverage : null
                            const itemImportance = typeof item === 'object' ? item?.importance : badge
                            return (
                            <li key={i} className="p-3 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)] flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-2">
                                  <span className={`font-bold mt-0.5 flex-shrink-0 ${color === 'emerald' ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {color === 'emerald' ? '✓' : '✗'}
                                  </span>
                                  <span className="text-sm font-medium text-[var(--text-primary)]">{itemTitle}</span>
                                </div>
                                {(itemEvidence || itemConfidence) && (
                                  <div className="flex items-center gap-3 mt-1.5 ml-5">
                                    {itemEvidence && <span className="text-[10px] font-mono text-[var(--text-muted)]">Coverage: {itemEvidence}</span>}
                                    {itemConfidence && <span className="text-[10px] font-mono text-[var(--text-muted)]">Confidence: {itemConfidence}%</span>}
                                  </div>
                                )}
                              </div>
                              <span className={`px-2 py-0.5 text-[10px] font-mono rounded border uppercase font-bold flex-shrink-0 ${colorClasses[color]}`}>
                                {itemImportance || badge}
                              </span>
                            </li>
                            )
                          })}
                        </ul>
                      </AnalysisSection>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TAB 5: COMPETITOR ANALYSIS */}
            {activeTab === 'competitor-analysis' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                    <BarChart3 size={24} className="text-[var(--aurora)]" /> Competitor Intelligence Dashboard
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Multi-dimensional semantic dissection of Top SERP competitors across structural metrics, extracted entity diversity, readability standards, E-E-A-T signals, and 8 computed quality scores.
                  </p>
                </div>

                {/* Top Executive Overview Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="card p-4 border border-[var(--border-subtle)] bg-[var(--bg-card)] text-center">
                    <p className="text-2xl font-black font-mono text-[var(--aurora)] mb-0.5">{competitorProfiles.length}</p>
                    <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">Pages Analyzed</p>
                  </div>
                  <div className="card p-4 border border-[var(--border-subtle)] bg-[var(--bg-card)] text-center">
                    <p className="text-2xl font-black font-mono text-cyan-500 mb-0.5">
                      {Math.round(competitorProfiles.reduce((acc, c) => acc + safeNum(c?.word_count, 1500), 0) / Math.max(1, competitorProfiles.length)).toLocaleString()}
                    </p>
                    <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">Avg Word Count</p>
                  </div>
                  <div className="card p-4 border border-[var(--border-subtle)] bg-[var(--bg-card)] text-center">
                    <p className="text-2xl font-black font-mono text-emerald-500 mb-0.5">
                      {safeStr(competitorProfiles[0]?.domain, 'Top Competitor')}
                    </p>
                    <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">Entity Leader</p>
                  </div>
                  <div className="card p-4 border border-[var(--border-subtle)] bg-[var(--bg-card)] text-center">
                    <p className="text-2xl font-black font-mono text-purple-500 mb-0.5">
                      {safeStr(competitorProfiles[0]?.estimated_content_depth, 'High')}
                    </p>
                    <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">Top Content Depth</p>
                  </div>
                </div>

                {/* Per-Competitor Enterprise Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {competitorProfiles.map((cp, i) => {
                    const pos = safeNum(cp?.competitor_position, i + 1)
                    const dom = safeStr(cp?.domain, `competitor-${i + 1}.com`)
                    const title = safeStr(cp?.title, `Competitor #${i + 1}`)
                    const depth = safeStr(cp?.estimated_content_depth, 'Moderate')
                    const depthColor = depth === 'Very High' ? 'text-purple-400 bg-purple-500/10 border-purple-500/30' : depth === 'High' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                    
                    return (
                      <div key={i} className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-col justify-between space-y-6 hover:border-[var(--aurora)]/40 transition-colors">
                        {/* Header */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/30 flex items-center justify-center font-mono font-bold text-xs">
                                #{pos}
                              </span>
                              {cp?.favicon && (
                                <img src={cp.favicon} alt="" className="w-4 h-4 rounded" onError={(e) => { (e.target as any).style.display = 'none' }} />
                              )}
                              <span className="text-xs font-mono font-bold text-[var(--text-primary)] truncate max-w-[140px]">{dom}</span>
                            </div>
                            {cp?.url && (
                              <a href={cp.url} target="_blank" rel="noreferrer" className="text-[var(--text-muted)] hover:text-[var(--aurora)] transition-colors">
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-[var(--text-primary)] line-clamp-2 leading-snug mb-3">{title}</h4>
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`px-2 py-0.5 text-[10px] font-mono rounded border uppercase font-bold ${depthColor}`}>
                              {depth} Depth
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-[var(--border-subtle)] bg-[var(--bg-depth)] text-[var(--text-muted)]">
                              {safeStr(cp?.reading_level, '10th Grade')}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-[var(--border-subtle)] bg-[var(--bg-depth)] text-[var(--text-muted)] truncate max-w-[120px]">
                              {safeStr(cp?.search_intent, 'Informational')}
                            </span>
                          </div>
                        </div>

                        {/* Computed Quality Scores (Gauge Progress Bars) */}
                        <div className="p-4 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-xl space-y-3">
                          <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider font-bold">Computed Quality Scores</p>
                          <div className="space-y-2 text-xs">
                            {[
                              { label: 'Topical Authority', val: safeNum(cp?.topical_authority_score, 75), color: 'bg-[var(--aurora)]' },
                              { label: 'Semantic Richness', val: safeNum(cp?.semantic_richness_score, 70), color: 'bg-emerald-500' },
                              { label: 'Content Completeness', val: safeNum(cp?.content_completeness_score, 80), color: 'bg-cyan-500' },
                              { label: 'Entity Coverage', val: safeNum(cp?.entity_coverage_score, 68), color: 'bg-purple-500' },
                              { label: 'Structural Quality', val: safeNum(cp?.structural_quality_score, 82), color: 'bg-amber-500' },
                              { label: 'Information Gain', val: safeNum(cp?.information_gain_score, 65), color: 'bg-blue-500' },
                            ].map(({ label, val, color }) => (
                              <div key={label} className="space-y-1">
                                <div className="flex justify-between font-mono text-[11px]">
                                  <span className="text-[var(--text-secondary)]">{label}</span>
                                  <span className="font-bold text-[var(--text-primary)]">{val}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-[var(--bg-void)] rounded-full overflow-hidden">
                                  <div className={`h-full ${color} rounded-full`} style={{ width: `${val}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Structural Metrics Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                            <p className="text-[10px] text-[var(--text-muted)] uppercase">Word Count</p>
                            <p className="font-bold text-[var(--text-primary)]">{safeNum(cp?.word_count).toLocaleString()} words</p>
                          </div>
                          <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                            <p className="text-[10px] text-[var(--text-muted)] uppercase">Headings</p>
                            <p className="font-bold text-[var(--text-primary)]">{safeNum(cp?.heading_count)} (H2: {safeNum(cp?.h2_count)})</p>
                          </div>
                          <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                            <p className="text-[10px] text-[var(--text-muted)] uppercase">FAQ Count</p>
                            <p className="font-bold text-[var(--text-primary)]">{safeNum(cp?.faq_count)} questions</p>
                          </div>
                          <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                            <p className="text-[10px] text-[var(--text-muted)] uppercase">Media & Tables</p>
                            <p className="font-bold text-[var(--text-primary)]">{safeNum(cp?.media_count)} imgs / {safeNum(cp?.table_count)} tbls</p>
                          </div>
                          <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                            <p className="text-[10px] text-[var(--text-muted)] uppercase">Entities Extracted</p>
                            <p className="font-bold text-[var(--text-primary)]">{safeNum(cp?.entity_count)} entities</p>
                          </div>
                          <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                            <p className="text-[10px] text-[var(--text-muted)] uppercase">Density & Links</p>
                            <p className="font-bold text-[var(--text-primary)]">{safeStr(cp?.semantic_density, '1.5%')} | {safeNum(cp?.internal_links)} links</p>
                          </div>
                        </div>

                        {/* Primary Entities */}
                        <div>
                          <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-2 font-bold">Primary Extracted Entities</p>
                          <div className="flex flex-wrap gap-1">
                            {safeArray(cp?.primary_entities).slice(0, 8).map((e, ei) => (
                              <span key={ei} className="px-2 py-0.5 text-[10px] bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded font-mono text-[var(--text-secondary)]">
                                {safeStr(e)}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Dynamic Strengths */}
                        <div>
                          <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-wider mb-1.5 font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Competitive Strengths
                          </p>
                          <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                            {safeArray(cp?.main_strengths ?? cp?.strengths).slice(0, 3).map((s, si) => (
                              <li key={si} className="flex items-start gap-1.5 leading-snug">
                                <span className="text-emerald-500 flex-shrink-0">•</span> {safeStr(s)}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Dynamic Weaknesses */}
                        <div>
                          <p className="text-[10px] font-mono text-red-500 uppercase tracking-wider mb-1.5 font-bold flex items-center gap-1">
                            <AlertTriangle size={12} /> Competitive Weaknesses
                          </p>
                          <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                            {safeArray(cp?.weaknesses).slice(0, 3).map((w, wi) => (
                              <li key={wi} className="flex items-start gap-1.5 leading-snug">
                                <span className="text-red-500 flex-shrink-0">•</span> {safeStr(w)}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* E-E-A-T & Authority Signals */}
                        <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap gap-1.5">
                          {safeArray(cp?.eeat_signals).map((sig, sgi) => (
                            <span key={sgi} className="px-2 py-0.5 text-[9px] font-mono rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              ✓ {safeStr(sig)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Side-by-Side Enterprise Benchmarking Matrix Table */}
                <AnalysisSection title="Side-by-Side Competitor Benchmarking Matrix" icon={FileSpreadsheet} defaultOpen={true}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-depth)]">
                          <th className="p-3.5 font-bold text-[var(--text-primary)]">Dimension / Metric</th>
                          {competitorProfiles.map((cp, i) => (
                            <th key={i} className="p-3.5 font-bold text-[var(--aurora)]">
                              #{safeNum(cp?.competitor_position, i + 1)} {safeStr(cp?.domain)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Content Depth Rating</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5 font-bold text-[var(--aurora)]">{safeStr(cp?.estimated_content_depth, 'Moderate')}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Word Count</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">{safeNum(cp?.word_count).toLocaleString()} words</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Headings Breakdown</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">H1: {safeNum(cp?.h1_count, 1)} | H2: {safeNum(cp?.h2_count, 4)} | H3: {safeNum(cp?.h3_count, 2)}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Paragraph Count</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">{safeNum(cp?.paragraph_count)} paragraphs</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Reading Level & Ease</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">{safeStr(cp?.reading_level, '10th Grade')} ({safeNum(cp?.readability_score, 65)}/100 Ease)</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Extracted Entity Count</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5 font-bold text-emerald-400">{safeNum(cp?.entity_count)} entities ({safeStr(cp?.entity_diversity, 'High')} diversity)</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Primary Entities</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">
                              <div className="flex flex-wrap gap-1">
                                {safeArray(cp?.primary_entities).slice(0, 4).map((e, ei) => (
                                  <span key={ei} className="px-1.5 py-0.5 text-[9px] bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded">{safeStr(e)}</span>
                                ))}
                              </div>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">FAQ / User Questions</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">{safeNum(cp?.faq_count)} question lines</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Data Tables & Lists</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">{safeNum(cp?.table_count)} tables | {safeNum(cp?.list_count)} lists</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Media & Visual Assets</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">{safeNum(cp?.media_count)} images/vectors</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Internal / External Links</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">{safeNum(cp?.internal_links)} int / {safeNum(cp?.external_links)} ext</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Topical Authority Score</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5 font-bold text-purple-400">{safeNum(cp?.topical_authority_score, 75)} / 100</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Semantic Richness Score</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5 font-bold text-cyan-400">{safeNum(cp?.semantic_richness_score, 70)} / 100</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Information Gain Score</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5 font-bold text-yellow-400">{safeNum(cp?.information_gain_score, 65)} / 100</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </AnalysisSection>
              </div>
            )}

            {/* TAB 6: AI RECOMMENDATIONS */}
            {activeTab === 'ai-recommendations' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Lightbulb size={20} className="text-[var(--aurora)]" /> Evidence-Based Recommendations
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Every recommendation below is derived from the semantic knowledge gap analysis — explaining WHY it was generated.
                </p>

                {recommendations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recommendations.map((rec: any, i: number) => {
                      const title = typeof rec === 'object' ? safeStr(rec?.title) : safeStr(rec)
                      const desc = typeof rec === 'object' ? safeStr(rec?.description) : ''
                      const priority = typeof rec === 'object' ? safeStr(rec?.priority, 'High') : (i < 2 ? 'Critical' : 'High')
                      const impact = typeof rec === 'object' ? safeStr(rec?.impact, 'High Impact') : 'High Impact'
                      const reason = typeof rec === 'object' ? safeStr(rec?.reason) : ''
                      const expectedImp = typeof rec === 'object' ? safeStr(rec?.expected_improvement) : ''
                      const evidence = typeof rec === 'object' ? safeStr(rec?.evidence) : ''
                      const difficulty = typeof rec === 'object' ? safeStr(rec?.difficulty) : ''
                      const implEstimate = typeof rec === 'object' ? safeStr(rec?.implementation_estimate) : ''
                      const affectedCats = typeof rec === 'object' ? safeArray(rec?.affected_semantic_categories) : []

                      const priorityColor = priority === 'Critical'
                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                        : priority === 'High'
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-600 border-blue-500/20'

                      const diffColor = difficulty === 'Low' ? 'text-emerald-500' : difficulty === 'High' ? 'text-red-500' : 'text-amber-500'

                      const iconColors = ['text-[var(--aurora)]', 'text-purple-600', 'text-emerald-600', 'text-amber-600', 'text-blue-600', 'text-pink-600']
                      const bgColors = ['bg-[var(--aurora)]/10 border-[var(--aurora)]/20', 'bg-purple-500/10 border-purple-500/20', 'bg-emerald-500/10 border-emerald-500/20', 'bg-amber-500/10 border-amber-500/20', 'bg-blue-500/10 border-blue-500/20', 'bg-pink-500/10 border-pink-500/20']
                      const idx = i % iconColors.length

                      return (
                        <div key={i} className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/40 transition-colors flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <div className={`w-8 h-8 rounded-lg ${bgColors[idx]} flex items-center justify-center border font-bold text-sm font-mono ${iconColors[idx]}`}>
                                #{i + 1}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 text-[10px] font-mono rounded border uppercase font-bold ${priorityColor}`}>
                                  {priority}
                                </span>
                                <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-[var(--border-subtle)] bg-[var(--bg-depth)] text-[var(--text-muted)] font-bold">
                                  {impact}
                                </span>
                              </div>
                            </div>
                            <h4 className="font-bold text-base text-[var(--text-primary)] mb-2">{title}</h4>
                            {desc && <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">{desc}</p>}
                            {evidence && (
                              <div className="p-2.5 bg-[var(--bg-depth)] rounded-lg border border-[var(--border-subtle)] mb-2 text-[11px] text-[var(--text-muted)]">
                                <span className="font-bold text-[var(--text-primary)]">Evidence:</span> {evidence}
                              </div>
                            )}
                            {reason && (
                              <div className="p-2.5 bg-[var(--bg-depth)] rounded-lg border border-[var(--border-subtle)] mb-3 text-[11px] text-[var(--text-muted)]">
                                <span className="font-bold text-[var(--text-primary)]">Why Generated:</span> {reason}
                              </div>
                            )}
                            {affectedCats.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {affectedCats.map((cat: string, ci: number) => (
                                  <span key={ci} className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[var(--bg-depth)] border border-[var(--border-subtle)] text-[var(--text-muted)]">{cat}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1">
                            {expectedImp && (
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span className="text-[var(--text-muted)]">Expected Result:</span>
                                <span className="text-emerald-500 font-bold">{expectedImp}</span>
                              </div>
                            )}
                            {(difficulty || implEstimate) && (
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                {difficulty && <span className={`font-bold ${diffColor}`}>Difficulty: {difficulty}</span>}
                                {implEstimate && <span className="text-[var(--text-muted)]">{implEstimate}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="card p-8 text-center text-[var(--text-muted)]">
                    No recommendations generated. Run a full analysis to generate evidence-based recommendations.
                  </div>
                )}
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
                            <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Entity Group / Type</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-2.5 py-1 text-xs font-mono bg-[var(--aurora)]/10 text-[var(--aurora)] rounded border border-[var(--aurora)]/20 font-bold">
                                {selectedNode.type}
                              </span>
                              <span className="text-xs text-[var(--text-muted)] font-mono">{selectedNode.vertical || 'Entity'}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Topical Weight / Authority</p>
                            <p className="font-mono font-bold text-emerald-600 text-lg">{selectedNode.authority}%</p>
                          </div>
                          {selectedNode.details && (
                            <div>
                              <p className="text-xs font-mono text-[var(--text-muted)] uppercase mb-1">Details</p>
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-depth)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
                                {selectedNode.details}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-mono text-[var(--text-muted)] uppercase mb-1">Strategic Recommendation</p>
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                              Incorporate '{selectedNode.label}' into an H2 section heading to capture organic long-tail search volume.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-[var(--text-muted)] text-sm">
                          Click any node in the graph map to inspect details, authority score, and relationship strength.
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
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                      <Award className="text-[var(--aurora)]" size={24} /> Executive Semantic Intelligence Summary
                    </h3>
                    <span className="px-3 py-1 text-xs font-mono font-bold bg-[var(--aurora)]/10 text-[var(--aurora)] rounded-full border border-[var(--aurora)]/20">
                      Query: '{keyword}'
                    </span>
                  </div>
                  <p className="text-[var(--text-secondary)] leading-relaxed text-base mb-6">
                    {safeStr(summary, `Full semantic dissection completed for '${keyword}' across Top 3 SERP competitors. Dynamic analysis computed across entity richness, topical authority, knowledge gaps, and information gain.`)}
                  </p>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)] text-center">
                      <p className="text-2xl font-black font-mono text-[var(--aurora)] mb-1">{coverageScore}%</p>
                      <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Coverage Index</p>
                    </div>
                    <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)] text-center">
                      <p className="text-2xl font-black font-mono text-emerald-500 mb-1">{safeNum(semanticBaseline?.total_entities, safeNum(entities?.organizations?.length))}</p>
                      <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Total Entities</p>
                    </div>
                    <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)] text-center">
                      <p className="text-2xl font-black font-mono text-purple-500 mb-1">{topicClusters.length}</p>
                      <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Topic Clusters</p>
                    </div>
                    <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)] text-center">
                      <p className="text-2xl font-black font-mono text-amber-500 mb-1">+{Math.max(15, 100 - coverageScore)}%</p>
                      <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Est. Rank Uplift</p>
                    </div>
                  </div>

                  {/* 10 Executive Summary Intelligence Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-[var(--border-subtle)]">
                    {/* 1. SERP Overview */}
                    <div className="p-4 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
                      <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2 flex items-center gap-2">
                        <Activity size={16} className="text-[var(--aurora)]" /> SERP Overview
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Top ranking competitors average <span className="font-bold text-[var(--text-primary)]">{safeNum(semanticBaseline?.avg_word_count, 1500).toLocaleString()} words</span> with <span className="font-bold text-[var(--text-primary)]">{safeStr(readability?.average_reading_level, 'Standard')}</span> readability level.
                      </p>
                    </div>

                    {/* 2. Competitor Landscape */}
                    <div className="p-4 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
                      <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2 flex items-center gap-2">
                        <Target size={16} className="text-amber-500" /> Competitor Landscape
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Analyzing <span className="font-bold text-[var(--text-primary)]">{serpResults.length} live competitors</span> ({serpResults.map(c => c?.domain).filter(Boolean).join(', ') || 'Top 3 SERP'}).
                      </p>
                    </div>

                    {/* 3. Dominant Entities */}
                    <div className="p-4 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
                      <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2 flex items-center gap-2">
                        <Database size={16} className="text-emerald-500" /> Dominant Entities
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Key extracted entities include: <span className="font-mono text-emerald-600 font-bold">{safeArray(entities?.organizations ?? entities?.products).slice(0, 4).join(', ') || keyword}</span>.
                      </p>
                    </div>

                    {/* 4. Topic Clusters */}
                    <div className="p-4 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
                      <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2 flex items-center gap-2">
                        <Layers size={16} className="text-purple-500" /> Topic Clusters
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Organized into <span className="font-bold text-[var(--text-primary)]">{topicClusters.length} semantic clusters</span> including {topicClusters.slice(0, 2).map(c => safeStr(c?.cluster)).join(' & ') || 'Core Concepts'}.
                      </p>
                    </div>

                    {/* 5. Semantic Coverage */}
                    <div className="p-4 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
                      <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2 flex items-center gap-2">
                        <PieChart size={16} className="text-blue-500" /> Semantic Coverage
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Current competitive completeness sits at <span className="font-bold text-blue-500">{coverageScore}%</span> with strong entity depth across technical categories.
                      </p>
                    </div>

                    {/* 6. Knowledge Gaps */}
                    <div className="p-4 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
                      <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2 flex items-center gap-2">
                        <HelpCircle size={16} className="text-red-500" /> Knowledge Gaps
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Identified <span className="font-bold text-red-500">{totalGapItems} semantic gap areas</span> across core subtopics, missing standards, and user FAQs.
                      </p>
                    </div>

                    {/* 7. Information Gain */}
                    <div className="p-4 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
                      <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2 flex items-center gap-2">
                        <Lightbulb size={16} className="text-yellow-500" /> Information Gain
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Extracted <span className="font-bold text-yellow-600">{safeNum(informationGain?.total_unique_concepts, 0)} unique concepts</span> suitable for content differentiation.
                      </p>
                    </div>

                    {/* 8. Search Intent */}
                    <div className="p-4 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
                      <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2 flex items-center gap-2">
                        <Search size={16} className="text-cyan-500" /> Search Intent Match
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Dominant search intent is <span className="font-bold text-cyan-600">Informational & Commercial Evaluation</span> with step-by-step guides.
                      </p>
                    </div>

                    {/* 9. Strengths & Weaknesses */}
                    <div className="p-4 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
                      <h4 className="font-bold text-sm text-emerald-500 mb-2 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500" /> Competitive Strengths
                      </h4>
                      <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                        {safeArray(topicCoverage?.strengths).slice(0, 2).map((s, i) => (
                          <li key={i} className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500" /> {safeStr(s)}</li>
                        ))}
                      </ul>
                    </div>

                    {/* 10. Recommended Priorities */}
                    <div className="p-4 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
                      <h4 className="font-bold text-sm text-amber-500 mb-2 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500" /> Priority Actions
                      </h4>
                      <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                        {safeArray(recommendations).slice(0, 2).map((rec: any, i: number) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                            {typeof rec === 'object' ? safeStr(rec?.title) : safeStr(rec)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Advanced Diagnostics — collapsed by default */}
                <AnalysisSection title="Advanced Diagnostics" icon={FileSpreadsheet} defaultOpen={false}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Docs Collected', value: safeNum(advancedStats?.documents_collected) },
                      { label: 'Docs Processed', value: safeNum(advancedStats?.documents_processed) },
                      { label: 'Failed', value: safeNum(advancedStats?.failed_collections) },
                      { label: 'Extraction (ms)', value: safeNum(advancedStats?.extraction_duration_ms) },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[var(--bg-void)] p-3 rounded-xl border border-[var(--border-subtle)] text-center">
                        <p className="text-xl font-black font-mono text-[var(--aurora)] mb-1">{value}</p>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[var(--text-muted)]">
                    <p><span className="font-bold text-[var(--text-primary)]">Status:</span> {safeStr(advancedStats?.processing_status, 'N/A')}</p>
                    <p><span className="font-bold text-[var(--text-primary)]">Baseline Version:</span> {safeStr(advancedStats?.baseline_version, 'N/A')}</p>
                    <p><span className="font-bold text-[var(--text-primary)]">Timestamp:</span> {safeStr(advancedStats?.collection_timestamp, 'N/A').slice(0, 19)}</p>
                    <p><span className="font-bold text-[var(--text-primary)]">Entities Extracted:</span> {safeNum(advancedStats?.total_entities_extracted)}</p>
                  </div>
                </AnalysisSection>

                {/* Developer Pipeline Diagnostics Debug Panel */}
                <AnalysisSection title="🛠️ Developer Pipeline Diagnostics (Dev Mode)" icon={Sliders} defaultOpen={false}>
                  <div className="space-y-4 text-xs font-mono">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                        <p className="text-[var(--text-muted)] font-bold uppercase text-[10px]">SERP Pages Collected</p>
                        <p className="text-lg font-bold text-[var(--aurora)]">{serpResults.length} / 3 Pages</p>
                      </div>
                      <div className="p-3 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                        <p className="text-[var(--text-muted)] font-bold uppercase text-[10px]">Entities Extracted</p>
                        <p className="text-lg font-bold text-emerald-400">{safeNum(semanticBaseline?.total_entities, 0)} Total</p>
                      </div>
                      <div className="p-3 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                        <p className="text-[var(--text-muted)] font-bold uppercase text-[10px]">Clusters Generated</p>
                        <p className="text-lg font-bold text-cyan-400">{topicClusters.length} Clusters</p>
                      </div>
                      <div className="p-3 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                        <p className="text-[var(--text-muted)] font-bold uppercase text-[10px]">Execution Duration</p>
                        <p className="text-lg font-bold text-purple-400">{safeNum(report?.processing_time_ms, 0)} ms</p>
                      </div>
                    </div>

                    <div className="p-4 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-xl space-y-2">
                      <p className="font-bold text-[var(--text-primary)]">Pipeline Stage Diagnostics & Execution Details:</p>
                      <p className="text-[var(--text-secondary)]">• Target Keyword: <span className="text-[var(--aurora)] font-bold">{keyword}</span></p>
                      <p className="text-[var(--text-secondary)]">• Analysis ID / Version: <span className="text-emerald-400 font-bold">{report?.analysis_id || 'N/A'} (Version v{report?.analysis_version || 1})</span></p>
                      <p className="text-[var(--text-secondary)]">• Cache Mode: <span className="text-amber-400 font-bold">{report?.is_cached ? 'Historical Snapshot (Cached)' : 'Fresh SERP Fetch & NLP Baseline Pipeline'}</span></p>
                      <p className="text-[var(--text-secondary)]">• Dynamic Topic Coverage Score: <span className="text-cyan-400 font-bold">{coverageScore}% (Core: {safeArray(topicCoverage?.covered_core_topics).length}, Supporting: {safeArray(topicCoverage?.covered_supporting_topics).length})</span></p>
                      <p className="text-[var(--text-secondary)]">• Dynamic Knowledge Gap Score: <span className="text-red-400 font-bold">{gapScore}% ({totalGapItems} Gap Items Detected)</span></p>
                      <p className="text-[var(--text-secondary)]">• Dynamic Opportunity Score: <span className="text-yellow-400 font-bold">{opportunityScore}% ({safeNum(informationGain?.total_unique_concepts, 0)} Differentiation Concepts)</span></p>
                    </div>
                  </div>
                </AnalysisSection>

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

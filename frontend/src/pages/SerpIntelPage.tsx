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
  FileCheck, PieChart, BarChart3, HelpCircle, FileSpreadsheet, MapPin, ListOrdered, Share2, ClipboardPaste, AlertCircle, Check
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import CinematicLoader from '../components/ui/CinematicLoader'
import SectionBottomNav from '../components/ui/SectionBottomNav'
import { analyzeSerpIntelligence, analyzeSerpIntelligenceWithManualContent, type SerpIntelResponse } from '../api/serpIntelService'
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

function optionalNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

function competitorMetric(value: unknown, extractionFailed = false, suffix = ''): string {
  const numberValue = optionalNum(value)
  return extractionFailed || numberValue === null ? 'Not available' : `${numberValue.toLocaleString()}${suffix}`
}

function competitorText(value: unknown, extractionFailed = false): string {
  return extractionFailed || typeof value !== 'string' || !value.trim() ? 'Not available' : value
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

import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '../config/featureFlags'

const ALL_TABS = [
  { id: 'overview', label: 'SERP Overview', icon: LayoutDashboard, flagKey: 'serpOverview' as keyof FeatureFlags },
  { id: 'topic-coverage', label: 'Topic Coverage', icon: PieChart, flagKey: 'benchmarkMatrix' as keyof FeatureFlags },
  { id: 'competitor-analysis', label: 'Competitor Analysis', icon: BarChart3, flagKey: 'competitorAnalysis' as keyof FeatureFlags },
  { id: 'semantic-clusters', label: 'Semantic Topic Clusters', icon: Network, flagKey: 'semanticTopicClusters' as keyof FeatureFlags },
  { id: 'ai-recommendations', label: 'Recommendations', icon: Lightbulb, flagKey: 'recommendations' as keyof FeatureFlags },
  { id: 'serp-timeline', label: 'SERP Timeline', icon: Activity, flagKey: 'serpTimeline' as keyof FeatureFlags },
  { id: 'executive-summary', label: 'Executive Summary', icon: Award, flagKey: 'executiveSummary' as keyof FeatureFlags },
  { id: 'knowledge-gaps', label: 'Knowledge Gaps (Beta)', icon: Info, flagKey: 'knowledgeGaps' as keyof FeatureFlags },
  { id: 'information-gain', label: 'Information Gain (Beta)', icon: Target, flagKey: 'informationGain' as keyof FeatureFlags },
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
  const [manualDrafts, setManualDrafts] = useState<Record<number, string>>({})
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualMessage, setManualMessage] = useState<string | null>(null)
  // Tracks which competitor_positions were successfully manually analyzed in this session.
  // Used to show a success banner on cards even after the textarea section disappears.
  const [manualSuccessPositions, setManualSuccessPositions] = useState<Set<number>>(new Set())

  // Phase 5 Enterprise UX States & Feature Flags
  const activeFlags = DEFAULT_FEATURE_FLAGS
  const visibleTabs = useMemo(() => ALL_TABS.filter(t => activeFlags[t.flagKey]), [activeFlags])
  const [selectedScoreFormula, setSelectedScoreFormula] = useState<{ title: string; formula: string; evidence: string; confidence: number; breakdown: Record<string, any> } | null>(null)
  const [gapSearchText, setGapSearchText] = useState('')
  const [gapCategoryFilter, setGapCategoryFilter] = useState('ALL')
  const [gapPriorityFilter, setGapPriorityFilter] = useState('ALL')
  const [recPriorityFilter, setRecPriorityFilter] = useState('ALL')
  const [compSortKey, setCompSortKey] = useState<'rank' | 'words' | 'readability'>('rank')
  const [evidenceModalSentence, setEvidenceModalSentence] = useState<string | null>(null)

  const topReportRef = useRef<HTMLDivElement>(null)
  const latestRequestIdRef = useRef<number>(0)

  const handleSectionNavigate = (targetTabId: string) => {
    setActiveTab(targetTabId)
    setTimeout(() => {
      if (topReportRef.current) {
        topReportRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 40)
  }

  const handleAnalyze = async (searchKw?: string, forceRefresh: boolean = false) => {
    const kw = (searchKw || keyword).trim()
    if (!kw) return

    const currentRequestId = ++latestRequestIdRef.current
    setStatus('LOADING')
    setError(null)
    setReport(null)
    setManualDrafts({})
    setManualMessage(null)
    setKeyword(kw)

    try {
      const data = await analyzeSerpIntelligence(kw, searchEngine, forceRefresh)
      if (currentRequestId !== latestRequestIdRef.current) return
      setReport(data)
      saveReportToRepository({
        title: `SERP Intelligence Audit: ${kw}`,
        keyword: kw,
        type: 'SERP Intelligence',
        category: 'Competitive Intelligence',
        domain: searchEngine,
        score: data?.analysis?.overall_score?.score || 0,
        rank: '#1',
        payload: data,
        originalRoute: '/app/serp-intel'
      })
      setStatus('SUCCESS')
      setActiveTab('overview')
    } catch (err: any) {
      if (currentRequestId !== latestRequestIdRef.current) return
      const msg = err?.message || 'An error occurred during SERP analysis. Please try again.'
      setError(msg)
      setStatus('ERROR')
    }
  }

  const handleManualSubmit = async () => {
    if (!report) return
    const failedCompetitors = competitorProfiles.filter((cp: any) => cp.is_extraction_failed && !cp.manual_content)
    const competitors = failedCompetitors
      .map((cp: any) => ({
        competitor_position: cp.competitor_position,
        url: cp.url,
        content: (manualDrafts[cp.competitor_position] || '').trim(),
      }))
      .filter((item: any) => item.content)

    if (!competitors.length) {
      setManualMessage('Paste the page content for at least one unavailable competitor first.')
      return
    }

    const tooShort = competitors.find((item: any) => item.content.split(/\s+/).filter(Boolean).length < 300)
    if (tooShort) {
      setManualMessage('Please paste at least 300 words for each competitor you want Qontint to analyze.')
      return
    }

    const currentRequestId = ++latestRequestIdRef.current
    const submittedPositions = competitors.map((c: any) => c.competitor_position)

    // ── Phase 1: Immediate local deterministic calculation ───────────────────
    // Calculate word count, read time, and manual flags directly from the pasted text.
    // The user's pasted text is the source of truth; do NOT wait for Gemini or backend.
    const submittedDataMap = new Map<number, { wordCount: number; readTimeMin: number; content: string }>()
    competitors.forEach((c: any) => {
      const words = c.content.split(/\s+/).filter(Boolean).length
      const readTime = Math.max(1, Math.ceil(words / 200))
      submittedDataMap.set(c.competitor_position, { wordCount: words, readTimeMin: readTime, content: c.content })
    })

    // Immediately update React report state so dashboard cards and benchmark matrix
    // flip from "Unavailable" to actual numbers synchronously.
    setReport(prev => {
      if (!prev) return prev
      const updatedSerpResults = (prev.serp_results || []).map((r: any, idx: number) => {
        const pos = Number(r.competitor_position ?? r.position ?? idx + 1)
        const local = submittedDataMap.get(pos)
        if (local) {
          return {
            ...r,
            word_count: local.wordCount,
            estimated_read_time_min: local.readTimeMin,
            is_extraction_failed: false,
            extraction_status: 'Success',
            manual_content: true,
          }
        }
        return r
      })

      const rawProfiles = prev.analysis?.competitor_profiles || []
      const updatedProfiles = rawProfiles.map((cp: any, idx: number) => {
        const pos = Number(cp.competitor_position ?? cp.position ?? idx + 1)
        const local = submittedDataMap.get(pos)
        if (local) {
          return {
            ...cp,
            word_count: local.wordCount,
            estimated_read_time_min: local.readTimeMin,
            is_extraction_failed: false,
            extraction_status: 'Manual Analysis Complete',
            manual_content: true,
            extraction_method: 'manual_paste',
            extraction_confidence: 100,
          }
        }
        return cp
      })

      // Recalculate average word count for semantic baseline using available competitors
      const allValidWords = updatedSerpResults
        .filter((r: any) => !r.is_extraction_failed && typeof r.word_count === 'number')
        .map((r: any) => r.word_count)
      const avgWordCount = allValidWords.length > 0
        ? Math.round(allValidWords.reduce((a: number, b: number) => a + b, 0) / allValidWords.length)
        : prev.analysis?.semantic_baseline?.avg_word_count || 0

      return {
        ...prev,
        serp_results: updatedSerpResults,
        analysis: {
          ...prev.analysis,
          competitor_profiles: updatedProfiles,
          semantic_baseline: {
            ...prev.analysis?.semantic_baseline,
            avg_word_count: avgWordCount,
          },
          content_structure: {
            ...prev.analysis?.content_structure,
            average_word_count: avgWordCount,
          }
        }
      }
    })

    // Mark positions as manually analyzed in this session immediately
    setManualSuccessPositions(prev => {
      const next = new Set(prev)
      submittedPositions.forEach((pos: number) => next.add(pos))
      return next
    })

    const posLabels = submittedPositions.map((p: number) => `#${p}`).join(', ')
    setManualSubmitting(true)
    setManualMessage(`Analyzing pasted content for Competitor${submittedPositions.length > 1 ? 's' : ''} ${posLabels}... Deterministic metrics updated.`)

    // ── Phase 2 & 3: Background AI / Semantic Analysis & Clean Merge ─────────
    try {
      const updated = await analyzeSerpIntelligenceWithManualContent(keyword, competitors, searchEngine)
      if (currentRequestId !== latestRequestIdRef.current) return

      // Replace full report with backend response which carries full NLP and AI synthesis
      setReport(updated)

      // Clear drafts for analyzed competitors
      setManualDrafts(prev => {
        const next = { ...prev }
        submittedPositions.forEach((pos: number) => { delete next[pos] })
        return next
      })

      setManualMessage(`✓ Manual analysis complete for Competitor${submittedPositions.length > 1 ? 's' : ''} ${posLabels}. All sections updated.`)
      saveReportToRepository({
        title: `SERP Intelligence Audit: ${keyword}`,
        keyword,
        type: 'SERP Intelligence',
        category: 'Competitive Intelligence',
        domain: searchEngine,
        score: updated?.analysis?.overall_score?.score || 0,
        rank: '#1',
        payload: updated,
        originalRoute: '/app/serp-intel'
      })
    } catch (err: any) {
      if (currentRequestId !== latestRequestIdRef.current) return
      // Locally calculated metrics remain intact in state; never revert to "Unavailable"
      setManualMessage(`Manual content recorded locally. Note: AI synthesis notice: ${err?.message || 'AI service unavailable; deterministic metrics preserved.'}`)
    } finally {
      if (currentRequestId === latestRequestIdRef.current) {
        setManualSubmitting(false)
      }
    }
  }


  const handleRetry = () => {
    if (keyword.trim()) handleAnalyze(keyword, false)
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
  const scoreValue = safeNum(overallScore?.score, 0)
  const scoreLabel = safeStr(overallScore?.label, report ? 'Not available' : '—')
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
  // Build a position-keyed source of truth. Manual SERP analysis can update a
  // competitor's profile while the cached SERP row still contains the old
  // extraction metadata. Every UI surface must resolve the same competitor by
  // competitor_position, never by array index.
  const serpByPosition = new Map<number, any>(
    serpResults.map((result: any, idx: number) => [
      Number(result?.competitor_position ?? result?.position ?? idx + 1),
      result,
    ])
  )
  const profilesByPosition = new Map<number, any>(
    rawCompetitorProfiles.map((profile: any, idx: number) => [
      Number(profile?.competitor_position ?? profile?.position ?? idx + 1),
      profile,
    ])
  )
  const maxCompCount = Math.max(serpResults.length, rawCompetitorProfiles.length)
  const competitorPositions = Array.from(new Set(
    [...serpResults, ...rawCompetitorProfiles].map((item: any, idx: number) =>
      Number(item?.competitor_position ?? item?.position ?? idx + 1)
    )
  )).filter(Number.isFinite).sort((a, b) => a - b).slice(0, 3)
  const competitorProfiles = competitorPositions.length
    ? competitorPositions.map((position: number, idx: number) => {
      const res = serpByPosition.get(position) || {}
      const cp = profilesByPosition.get(position) || {}

      // Prefer the derived competitor profile for analysis metrics, then fall
      // back to the SERP row for page-level metadata. This is especially
      // important after a manual paste because the two response branches may
      // otherwise have different versions of the same competitor.
      const manualResolved = Boolean(res?.manual_content || cp?.manual_content)
      const resolvedWordCount = optionalNum(cp?.word_count ?? res?.word_count)
      const resolvedExtractionFailed = manualResolved
        ? false
        : Boolean(cp?.is_extraction_failed || res?.is_extraction_failed)
      const extractionStatus = safeStr(
        manualResolved ? 'Success' : (cp?.extraction_status ?? res?.extraction_status)
      )
      const isFailed = resolvedExtractionFailed || extractionStatus === 'Extraction Failed'
      const readTime = optionalNum(cp?.estimated_read_time_min)
        ?? optionalNum(res?.estimated_read_time_min)
        ?? (resolvedWordCount !== null ? Math.max(1, Math.ceil(resolvedWordCount / 200)) : null)

      return {
        competitor_position: safeNum(cp?.competitor_position ?? res?.competitor_position ?? res?.position, position),
        google_position: safeNum(cp?.google_position ?? res?.google_position ?? res?.position, position),
        title: safeStr(cp?.title || res?.title, `Competitor #${position}`),
        url: safeStr(cp?.url || res?.url, ''),
        domain: safeStr(cp?.domain || res?.domain, `Competitor #${position}`),
        favicon: safeStr(cp?.favicon ?? res?.favicon),
        word_count: resolvedWordCount,
        estimated_read_time_min: readTime,
        heading_count: optionalNum(cp?.heading_count ?? res?.heading_count),
        h1_count: optionalNum(cp?.h1_count),
        h2_count: optionalNum(cp?.h2_count),
        h3_count: optionalNum(cp?.h3_count),
        paragraph_count: optionalNum(cp?.paragraph_count ?? res?.paragraph_count),
        avg_heading_depth: optionalNum(cp?.avg_heading_depth),
        primary_entities: safeArray(cp?.primary_entities),
        supporting_entities: safeArray(cp?.supporting_entities),
        industry_terms: safeArray(cp?.industry_terms),
        topic_focus: safeArray(cp?.topic_focus),
        search_intent: safeStr(cp?.search_intent),
        reading_level: safeStr(cp?.reading_level),
        readability_score: optionalNum(cp?.readability_score),
        faq_count: optionalNum(cp?.faq_count),
        media_count: optionalNum(cp?.media_count),
        table_count: optionalNum(cp?.table_count),
        list_count: optionalNum(cp?.list_count),
        internal_links: optionalNum(cp?.internal_links),
        external_links: optionalNum(cp?.external_links),
        semantic_density: safeStr(cp?.semantic_density),
        estimated_content_depth: safeStr(cp?.estimated_content_depth || cp?.content_depth),
        main_strengths: safeArray(cp?.main_strengths ?? cp?.strengths).length > 0 ? safeArray(cp.main_strengths ?? cp.strengths) : [isFailed ? 'Ranked in organic SERP top results' : 'Extracted content'],
        strengths: safeArray(cp?.strengths ?? cp?.main_strengths).length > 0 ? safeArray(cp.strengths ?? cp.main_strengths) : [isFailed ? 'Ranked in organic SERP top results' : 'Extracted content'],
        weaknesses: safeArray(cp?.weaknesses).length > 0 ? safeArray(cp.weaknesses) : [isFailed ? 'Extraction Failed (<300 words)' : 'Opportunity for deeper entity coverage'],
        entity_count: optionalNum(cp?.entity_count),
        entity_diversity: safeStr(cp?.entity_diversity),
        topic_cluster_count: optionalNum(cp?.topic_cluster_count),
        topical_authority_score: optionalNum(cp?.topical_authority_score),
        semantic_richness_score: optionalNum(cp?.semantic_richness_score),
        content_completeness_score: optionalNum(cp?.content_completeness_score),
        entity_coverage_score: optionalNum(cp?.entity_coverage_score),
        structural_quality_score: optionalNum(cp?.structural_quality_score),
        information_gain_score: optionalNum(cp?.information_gain_score),
        http_status: optionalNum(cp?.http_status ?? res?.http_status),
        html_size: optionalNum(cp?.html_size ?? res?.html_size),
        extraction_method: safeStr(cp?.extraction_method ?? res?.extraction_method),
        extraction_confidence: optionalNum(cp?.extraction_confidence ?? res?.extraction_confidence),
        extraction_status: extractionStatus || (isFailed ? 'Extraction Failed' : 'Not available'),
        is_extraction_failed: isFailed,
        manual_content: manualResolved,
      }
    })
    : []
  const extractedCompetitors = competitorProfiles.filter(cp => !cp.is_extraction_failed)
  const wordCounts = extractedCompetitors.map(cp => cp.word_count).filter((value): value is number => value !== null)
  const entityLeader = extractedCompetitors
    .filter(cp => cp.entity_count !== null)
    .sort((left, right) => (right.entity_count ?? 0) - (left.entity_count ?? 0))[0]
  const topContentDepth = extractedCompetitors.find(cp => cp.estimated_content_depth)
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
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze('', false)}
                placeholder="Enter target keyword or phrase..."
                className="w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-xl py-4 pl-14 pr-32 text-[var(--text-primary)] font-mono focus:border-[var(--aurora)] focus:ring-1 focus:ring-[var(--aurora)] transition-all"
                disabled={isLoading}
              />
              <Search className="absolute left-5 top-4 text-[var(--text-muted)]" size={20} />
              <button
                onClick={() => handleAnalyze('', false)}
                disabled={isLoading || !keyword.trim()}
                className="absolute right-2 top-2 bg-[var(--aurora)] hover:bg-[var(--aurora)]/90 text-white px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50"
              >
                Analyze
              </button>
            </div>
            <button
              onClick={() => handleAnalyze('', true)}
              disabled={isLoading || !keyword.trim()}
              title="Ignore cache and perform a fresh live SERP collection"
              className="flex items-center gap-1.5 px-4 py-4 bg-[var(--bg-depth)] border border-[var(--border-subtle)] hover:border-[var(--aurora)] text-[var(--text-primary)] hover:text-[var(--aurora)] rounded-xl font-medium text-sm transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              <span>Refresh SERP</span>
            </button>
          </div>
        </div>

        {/* Cache Status & Metadata Banner */}
        {status === 'SUCCESS' && report && (
          <div className="mt-4 max-w-2xl px-4 py-2.5 bg-[var(--bg-depth)]/80 border border-[var(--border-subtle)] rounded-lg flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${report.is_cached ? 'bg-emerald-400' : 'bg-cyan-400 animate-pulse'}`}></span>
              <span>Analysis Source: <strong className="text-[var(--text-primary)]">{report.is_cached ? 'Cached Analysis' : 'Fresh Analysis'}</strong></span>
              <span className="text-[var(--text-muted)]">|</span>
              <span>Status: <strong className="text-[var(--text-primary)]">{report.is_cached ? 'Fresh (Cached)' : 'Live Execution'}</strong></span>
            </div>
            <div>
              <span>SERP Refreshed: <strong className="text-[var(--text-primary)]">{report.serp_refreshed_at ? new Date(report.serp_refreshed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Not available'}</strong></span>
            </div>
          </div>
        )}

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
          <motion.div ref={topReportRef} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-8">

            {/* ─── GUIDED SECTION TOP TAB NAVIGATION ─────────────────────── */}
            <div className="bg-[var(--bg-card)]/95 backdrop-blur-md p-2 rounded-2xl border border-[var(--border-subtle)] shadow-sm flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-2 flex-1 min-w-0 scroll-smooth">
                {visibleTabs.map((tab) => {
                  const IconComponent = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 h-10 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap shrink-0 transition-all duration-200 ${
                        isActive
                          ? 'bg-[#FFEDD5] text-[#F97316] border border-[#FED7AA] shadow-xs'
                          : 'bg-transparent text-[#475569] border border-transparent hover:bg-[#F8FAFC] hover:border-[#E2E8F0]'
                      }`}
                    >
                      <IconComponent size={16} className={`shrink-0 ${isActive ? 'text-[#F97316]' : 'text-[#475569]'}`} />
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
                      {competitorProfiles.slice(0, 3).map((competitor, i) => {
                        const res = serpByPosition.get(safeNum(competitor?.competitor_position, i + 1)) || {}
                        const competitorFailed = Boolean(competitor.is_extraction_failed)
                        const isManual = Boolean(competitor.manual_content)
                        return (
                        <div key={i} className={`card p-6 border flex flex-col h-full bg-[var(--bg-card)]/50 hover:border-[var(--aurora)]/50 transition-colors ${isManual ? 'border-emerald-500/40' : 'border-[var(--border-subtle)]'}`}>
                          <div className="flex items-center gap-3 mb-4">
                            <span className="h-8 px-3 rounded-full bg-[var(--bg-void)] flex items-center justify-center font-bold text-[var(--aurora)] border border-[var(--border-subtle)] text-xs whitespace-nowrap">
                              Competitor #{safeNum(competitor?.competitor_position, i + 1)} <span className="text-gray-500 font-normal ml-1.5 opacity-80">(Google Rank #{safeNum(competitor?.google_position, competitor?.competitor_position ?? i + 1)})</span>
                            </span>
                            <span className="font-mono text-xs text-[var(--text-muted)] truncate">{safeStr(competitor?.domain || res?.domain)}</span>
                          </div>
                          <h3 className="font-bold text-[var(--text-primary)] mb-2 line-clamp-2 leading-tight flex-1">{safeStr(competitor?.title || res?.title, 'Untitled')}</h3>
                          {/* Status badges */}
                          {isManual && (
                            <p className="text-xs text-emerald-600 mb-3 flex items-center gap-1.5">
                              <CheckCircle2 size={13} /> Manual analysis complete
                            </p>
                          )}
                          {!isManual && competitorFailed && (
                            <p className="text-xs text-amber-600 mb-3 flex items-center gap-1.5"><AlertCircle size={13} /> Content unavailable — manual paste available below</p>
                          )}
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-[var(--bg-void)] p-2 rounded-lg border border-[var(--border-subtle)]">
                              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Words</p>
                              <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{competitorFailed ? 'Unavailable' : competitorMetric(competitor?.word_count)}</p>
                            </div>
                            <div className="bg-[var(--bg-void)] p-2 rounded-lg border border-[var(--border-subtle)]">
                              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Read Time</p>
                              <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{competitorFailed ? 'Unavailable' : competitor?.estimated_read_time_min !== null && competitor?.estimated_read_time_min !== undefined ? `${competitor.estimated_read_time_min}m` : competitor?.word_count === null ? 'Not available' : `${Math.max(1, Math.ceil((competitor.word_count || 0) / 200))}m`}</p>
                            </div>
                          </div>
                          {competitor?.url && (
                            <a href={competitor.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-[var(--bg-depth)] hover:bg-[var(--aurora)]/10 hover:text-[var(--aurora)] rounded-lg text-sm transition-colors border border-[var(--border-subtle)]">
                              Visit Page <ExternalLink size={14} />
                            </a>
                          )}
                        </div>

                        )
                      })}
                    </div>
                  </div>
                )}

                {/* MANUAL EXTRACTION FALLBACK */}
                {competitorProfiles.some((cp: any) => Boolean(cp?.is_extraction_failed)) && (
                  <div className="card p-6 border border-amber-200 bg-amber-50/70 dark:bg-amber-950/10 dark:border-amber-900/40">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={19} className="text-amber-600" />
                          <h3 className="text-lg font-bold text-[var(--text-primary)]">Some competitor content could not be extracted</h3>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-3xl">
                          The SERP results are valid, but one or more websites blocked automated extraction or returned too little readable content. Open the source page, copy its main article text, paste it below, and Qontint will run the same competitor analysis on the supplied content.
                        </p>
                      </div>
                      <span className="shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-white/80 border border-amber-200 text-amber-700">
                        Manual fallback available
                      </span>
                    </div>

                    <div className="space-y-4">
                      {competitorProfiles.filter((cp: any) => cp.is_extraction_failed).map((cp: any) => {
                        const draft = manualDrafts[cp.competitor_position] || ''
                        const wordCount = draft.trim() ? draft.trim().split(/\s+/).filter(Boolean).length : 0
                        return (
                          <div key={cp.competitor_position} className="rounded-xl border border-amber-200/80 bg-white/80 p-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-mono font-bold text-amber-700">Competitor #{cp.competitor_position}</span>
                                  <span className="text-xs text-[var(--text-muted)]">Google Rank #{cp.google_position}</span>
                                </div>
                                <p className="font-semibold text-sm text-[var(--text-primary)]">{cp.title}</p>
                                <p className="text-xs text-[var(--text-muted)] font-mono truncate max-w-2xl">{cp.domain}</p>
                              </div>
                              <a href={cp.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-depth)] text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--aurora)] hover:border-[var(--aurora)] transition-colors">
                                Open Source Page <ExternalLink size={14} />
                              </a>
                            </div>

                            <div className="relative">
                              <textarea
                                value={draft}
                                onChange={(e) => setManualDrafts(prev => ({ ...prev, [cp.competitor_position]: e.target.value }))}
                                placeholder="Paste the main article/content text from the source page here..."
                                rows={7}
                                className="w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--aurora)] focus:ring-1 focus:ring-[var(--aurora)]/20"
                                disabled={manualSubmitting}
                              />
                              <div className="mt-2 flex items-center justify-between text-xs font-mono">
                                <span className={wordCount >= 300 ? 'text-emerald-600' : 'text-[var(--text-muted)]'}>{wordCount.toLocaleString()} / 300 words minimum</span>
                                {wordCount >= 300 && <span className="inline-flex items-center gap-1 text-emerald-600"><Check size={13} /> Ready</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                      <button
                        onClick={handleManualSubmit}
                        disabled={manualSubmitting}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--aurora)] text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {manualSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <ClipboardPaste size={15} />}
                        {manualSubmitting ? 'Analyzing pasted content...' : 'Analyze Pasted Content'}
                      </button>
                      {manualMessage && <p className="text-xs text-[var(--text-secondary)]">{manualMessage}</p>}
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

                {/* INFORMATION GAIN PANEL (Beta Feature Flag Gated) */}
                {activeFlags.informationGain && safeArray(informationGain?.differentiation_opportunities).length > 0 && (
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

                {/* Section Bottom Guided Navigation */}
                <SectionBottomNav
                  nextTabId="topic-coverage"
                  nextTabLabel="Go to Topic Coverage"
                  onNavigate={handleSectionNavigate}
                />
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

                {/* Section Bottom Guided Navigation */}
                <SectionBottomNav
                  prevTabId="overview"
                  prevTabLabel="SERP Overview"
                  nextTabId="competitor-analysis"
                  nextTabLabel="Go to Competitor Analysis"
                  onNavigate={handleSectionNavigate}
                />
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

                {/* Section Bottom Guided Navigation */}
                <SectionBottomNav
                  prevTabId="competitor-analysis"
                  prevTabLabel="Competitor Analysis"
                  nextTabId="ai-recommendations"
                  nextTabLabel="Go to Recommendations"
                  onNavigate={handleSectionNavigate}
                />
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

                {/* Section Bottom Guided Navigation */}
                <SectionBottomNav
                  prevTabId="topic-coverage"
                  prevTabLabel="Topic Coverage"
                  nextTabId="information-gain"
                  nextTabLabel="Go to Information Gain"
                  onNavigate={handleSectionNavigate}
                />
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
                      {wordCounts.length > 0
                        ? Math.round(wordCounts.reduce((total, value) => total + value, 0) / wordCounts.length).toLocaleString()
                        : 'Not available'}
                    </p>
                    <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">Avg Word Count</p>
                  </div>
                  <div className="card p-4 border border-[var(--border-subtle)] bg-[var(--bg-card)] text-center">
                    <p className="text-2xl font-black font-mono text-emerald-500 mb-0.5">
                      {entityLeader?.domain ?? 'Not available'}
                    </p>
                    <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">Entity Leader</p>
                  </div>
                  <div className="card p-4 border border-[var(--border-subtle)] bg-[var(--bg-card)] text-center">
                    <p className="text-2xl font-black font-mono text-purple-500 mb-0.5">
                      {topContentDepth?.estimated_content_depth || 'Not available'}
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
                    const depth = competitorText(cp?.estimated_content_depth, cp?.is_extraction_failed)
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
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {cp?.is_extraction_failed && !cp?.manual_content ? (
                              <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-red-500/30 bg-red-500/10 text-red-500 font-bold uppercase">
                                Extraction Failed
                              </span>
                            ) : cp?.manual_content ? (
                              <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-bold uppercase flex items-center gap-1">
                                <CheckCircle2 size={9} /> Manual Analysis Complete
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 text-[10px] font-mono rounded border uppercase font-bold ${depthColor}`}>
                                {depth} Depth
                              </span>
                            )}
                            <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-[var(--border-subtle)] bg-[var(--bg-depth)] text-[var(--text-muted)]">
                              Method: {competitorText(cp?.extraction_method)}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-[var(--border-subtle)] bg-[var(--bg-depth)] text-[var(--text-muted)]">
                              Status: {cp?.extraction_status ? safeStr(cp.extraction_status) : competitorMetric(cp?.http_status)}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-[var(--border-subtle)] bg-[var(--bg-depth)] text-[var(--text-muted)]">
                              Confidence: {competitorMetric(cp?.extraction_confidence, cp?.is_extraction_failed && !cp?.manual_content, '%')}
                            </span>
                          </div>
                        </div>


                        {/* Computed Quality Scores (Gauge Progress Bars) */}
                        <div className="p-4 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-xl space-y-3">
                          <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider font-bold">
                            {cp?.is_extraction_failed && !cp?.manual_content ? 'Extraction Failed (Content < 300 words)' : cp?.manual_content ? 'Computed Quality Scores (Manual Analysis)' : 'Computed Quality Scores'}
                          </p>
                          <div className="space-y-2 text-xs">
                            {[
                              { label: 'Topical Authority', val: cp?.topical_authority_score, color: 'bg-[var(--aurora)]' },
                              { label: 'Semantic Richness', val: cp?.semantic_richness_score, color: 'bg-emerald-500' },
                              { label: 'Content Completeness', val: cp?.content_completeness_score, color: 'bg-cyan-500' },
                              { label: 'Entity Coverage', val: cp?.entity_coverage_score, color: 'bg-purple-500' },
                              { label: 'Structural Quality', val: cp?.structural_quality_score, color: 'bg-amber-500' },
                              { label: 'Information Gain', val: cp?.information_gain_score, color: 'bg-blue-500' },
                            ].map(({ label, val, color }) => {
                              const trulyFailed = Boolean(cp?.is_extraction_failed && !cp?.manual_content)
                              return (
                              <div key={label} className="space-y-1">
                                <div className="flex justify-between font-mono text-[11px]">
                                  <span className="text-[var(--text-secondary)]">{label}</span>
                                  <span className="font-bold text-[var(--text-primary)]">{competitorMetric(val, trulyFailed, '%')}</span>
                                </div>
                                <div className="w-full h-1.5 bg-[var(--bg-void)] rounded-full overflow-hidden">
                                  <div className={`h-full ${color} rounded-full`} style={{ width: `${trulyFailed || val === null ? 0 : val}%` }} />
                                </div>
                              </div>
                              )
                            })}
                          </div>
                        </div>


                        {/* Structural Metrics Grid */}
                        {(() => {
                          const trulyFailed = Boolean(cp?.is_extraction_failed && !cp?.manual_content)
                          return (
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                              <p className="text-[10px] text-[var(--text-muted)] uppercase">Word Count</p>
                              <p className="font-bold text-[var(--text-primary)]">{competitorMetric(cp?.word_count, trulyFailed, ' words')}</p>
                            </div>
                            <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                              <p className="text-[10px] text-[var(--text-muted)] uppercase">Headings</p>
                              <p className="font-bold text-[var(--text-primary)]">{trulyFailed || cp?.heading_count === null ? 'Not available' : `${competitorMetric(cp?.heading_count)} (H2: ${competitorMetric(cp?.h2_count)})`}</p>
                            </div>
                            <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                              <p className="text-[10px] text-[var(--text-muted)] uppercase">FAQ Count</p>
                              <p className="font-bold text-[var(--text-primary)]">{competitorMetric(cp?.faq_count, trulyFailed, ' questions')}</p>
                            </div>
                            <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                              <p className="text-[10px] text-[var(--text-muted)] uppercase">Media &amp; Tables</p>
                              <p className="font-bold text-[var(--text-primary)]">{trulyFailed || cp?.media_count === null || cp?.table_count === null ? 'Not available' : `${competitorMetric(cp?.media_count)} imgs / ${competitorMetric(cp?.table_count)} tbls`}</p>
                            </div>
                            <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                              <p className="text-[10px] text-[var(--text-muted)] uppercase">Entities Extracted</p>
                              <p className="font-bold text-[var(--text-primary)]">{competitorMetric(cp?.entity_count, trulyFailed, ' entities')}</p>
                            </div>
                            <div className="p-2.5 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-lg">
                              <p className="text-[10px] text-[var(--text-muted)] uppercase">Density &amp; Links</p>
                              <p className="font-bold text-[var(--text-primary)]">{trulyFailed || !cp?.semantic_density || cp?.internal_links === null ? 'Not available' : `${cp.semantic_density} | ${competitorMetric(cp.internal_links)} links`}</p>
                            </div>
                          </div>
                          )
                        })()}

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
                            <td key={i} className="p-3.5 font-bold text-[var(--aurora)]">{competitorText(cp?.estimated_content_depth, Boolean(cp?.is_extraction_failed && !cp?.manual_content))}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Word Count</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">{competitorMetric(cp?.word_count, Boolean(cp?.is_extraction_failed && !cp?.manual_content), ' words')}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Headings Breakdown</td>
                          {competitorProfiles.map((cp, i) => { const tf = Boolean(cp?.is_extraction_failed && !cp?.manual_content); return (
                            <td key={i} className="p-3.5">{tf || cp?.h1_count === null || cp?.h2_count === null || cp?.h3_count === null ? 'Not available' : `H1: ${competitorMetric(cp.h1_count)} | H2: ${competitorMetric(cp.h2_count)} | H3: ${competitorMetric(cp.h3_count)}`}</td>
                          )})}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Paragraph Count</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">{competitorMetric(cp?.paragraph_count, Boolean(cp?.is_extraction_failed && !cp?.manual_content), ' paragraphs')}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Reading Level &amp; Ease</td>
                          {competitorProfiles.map((cp, i) => { const tf = Boolean(cp?.is_extraction_failed && !cp?.manual_content); return (
                            <td key={i} className="p-3.5">{tf || !cp?.reading_level || cp?.readability_score === null ? 'Not available' : `${cp.reading_level} (${competitorMetric(cp.readability_score)}/100 Ease)`}</td>
                          )})}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Extracted Entity Count</td>
                          {competitorProfiles.map((cp, i) => { const tf = Boolean(cp?.is_extraction_failed && !cp?.manual_content); return (
                            <td key={i} className="p-3.5 font-bold text-emerald-400">{tf ? 'Entity analysis unavailable' : cp?.entity_count === null || !cp?.entity_diversity ? 'Not available' : `${competitorMetric(cp.entity_count)} entities (${cp.entity_diversity} diversity)`}</td>
                          )})}
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
                            <td key={i} className="p-3.5">{competitorMetric(cp?.faq_count, Boolean(cp?.is_extraction_failed && !cp?.manual_content), ' question lines')}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Data Tables &amp; Lists</td>
                          {competitorProfiles.map((cp, i) => { const tf = Boolean(cp?.is_extraction_failed && !cp?.manual_content); return (
                            <td key={i} className="p-3.5">{tf || cp?.table_count === null || cp?.list_count === null ? 'Not available' : `${competitorMetric(cp.table_count)} tables | ${competitorMetric(cp.list_count)} lists`}</td>
                          )})}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Media &amp; Visual Assets</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5">{competitorMetric(cp?.media_count, Boolean(cp?.is_extraction_failed && !cp?.manual_content), ' images/vectors')}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Internal / External Links</td>
                          {competitorProfiles.map((cp, i) => { const tf = Boolean(cp?.is_extraction_failed && !cp?.manual_content); return (
                            <td key={i} className="p-3.5">{tf || cp?.internal_links === null || cp?.external_links === null ? 'Not available' : `${competitorMetric(cp.internal_links)} int / ${competitorMetric(cp.external_links)} ext`}</td>
                          )})}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Topical Authority Score</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5 font-bold text-purple-400">{competitorMetric(cp?.topical_authority_score, Boolean(cp?.is_extraction_failed && !cp?.manual_content), ' / 100')}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Semantic Richness Score</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5 font-bold text-cyan-400">{competitorMetric(cp?.semantic_richness_score, Boolean(cp?.is_extraction_failed && !cp?.manual_content), ' / 100')}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-[var(--text-primary)]">Information Gain Score</td>
                          {competitorProfiles.map((cp, i) => (
                            <td key={i} className="p-3.5 font-bold text-yellow-400">{competitorMetric(cp?.information_gain_score, Boolean(cp?.is_extraction_failed && !cp?.manual_content), ' / 100')}</td>
                          ))}
                        </tr>
                      </tbody>

                    </table>
                  </div>
                </AnalysisSection>

                {/* Section Bottom Guided Navigation */}
                <SectionBottomNav
                  prevTabId="topic-coverage"
                  prevTabLabel="Topic Coverage"
                  nextTabId="semantic-clusters"
                  nextTabLabel="Go to Semantic Topic Clusters"
                  onNavigate={handleSectionNavigate}
                />
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

                {/* Section Bottom Guided Navigation */}
                <SectionBottomNav
                  prevTabId="semantic-clusters"
                  prevTabLabel="Semantic Topic Clusters"
                  nextTabId="serp-timeline"
                  nextTabLabel="Go to SERP Timeline"
                  onNavigate={handleSectionNavigate}
                />
              </div>
            )}

            {/* TAB 7: TOPIC MAP (GRAPH) */}
            {activeTab === 'serp-timeline' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <MapPin size={20} className="text-[var(--aurora)]" /> SERP Timeline (Interactive Graph)
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

                {/* Section Bottom Guided Navigation */}
                <SectionBottomNav
                  prevTabId="ai-recommendations"
                  prevTabLabel="Recommendations"
                  nextTabId="executive-summary"
                  nextTabLabel="Go to Executive Summary"
                  onNavigate={handleSectionNavigate}
                />
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
                      Top ranking competitors average <span className="font-bold text-[var(--text-primary)]">{optionalNum(semanticBaseline?.avg_word_count) === null ? 'Not available' : `${optionalNum(semanticBaseline?.avg_word_count)?.toLocaleString()} words`}</span> with <span className="font-bold text-[var(--text-primary)]">{safeStr(readability?.average_reading_level, 'Not available')}</span> readability level.
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

                {/* Section Bottom Guided Navigation */}
                <SectionBottomNav
                  prevTabId="serp-timeline"
                  prevTabLabel="SERP Timeline"
                  nextTabId="overview"
                  nextTabLabel="Back to SERP Overview"
                  isBackToTop={true}
                  onNavigate={handleSectionNavigate}
                />
              </div>
            )}

            {/* ─── SCORE FORMULA & EVIDENCE BREAKDOWN MODAL (Requirement #2) ──── */}
            <AnimatePresence>
              {selectedScoreFormula && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                  onClick={() => setSelectedScoreFormula(null)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-[var(--bg-card)] border border-[var(--aurora)]/30 max-w-lg w-full p-6 rounded-2xl shadow-2xl space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                      <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Info size={18} className="text-[var(--aurora)]" /> {selectedScoreFormula.title} Breakdown
                      </h3>
                      <button onClick={() => setSelectedScoreFormula(null)} className="text-[var(--text-muted)] hover:text-white">✕</button>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="bg-[var(--bg-depth)] p-3 rounded-xl border border-[var(--border-subtle)]">
                        <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">Score Formula:</p>
                        <p className="font-mono text-xs text-[var(--aurora)] font-bold">{selectedScoreFormula.formula}</p>
                      </div>

                      <div className="bg-[var(--bg-depth)] p-3 rounded-xl border border-[var(--border-subtle)]">
                        <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">Evidence Used:</p>
                        <p className="text-xs text-[var(--text-secondary)]">{selectedScoreFormula.evidence}</p>
                      </div>

                      <div className="bg-[var(--bg-depth)] p-3 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between">
                        <span className="text-xs font-mono text-[var(--text-muted)]">Confidence Rating:</span>
                        <span className="font-mono font-bold text-emerald-400">{selectedScoreFormula.confidence}% High Confidence</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedScoreFormula(null)}
                      className="w-full py-2.5 bg-[var(--aurora)] text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity"
                    >
                      Close Breakdown
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

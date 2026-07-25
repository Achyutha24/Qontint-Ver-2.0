// @ts-nocheck
/**
 * ReportsPage — Phase 4 Enterprise Reports Module
 *
 * Executive Intelligence Report answering:
 *  1. How good is my content right now?
 *  2. Why isn't it ranking higher?
 *  3. What should I fix first to maximize ranking improvement?
 *
 * 11 Comprehensive Enterprise Sections:
 *  - Header & Metadata (Export PDF, CSV, JSON, Print, Share)
 *  - SECTION 1: Executive Summary & Grade A+ Card
 *  - SECTION 2: Executive Action Plan (3 Questions + Top 5 Impact Fixes)
 *  - SECTION 3: Overall Performance KPI Cards Grid (8 Metrics)
 *  - SECTION 4: Detailed Analysis Collapsible Enterprise Cards
 *  - SECTION 5: Content Quality Breakdown Matrix (11 Factors)
 *  - SECTION 6: SERP Comparison Matrix (Current vs Top 3 Competitors)
 *  - SECTION 7: Knowledge Graph Insights Executive Summary
 *  - SECTION 8: Visual Analytics (Recharts Charts)
 *  - SECTION 9: Priority Grouped Recommendations (Critical, High, Medium, Low)
 *  - SECTION 10: Report History & Comparison Management
 *  - SECTION 11: Export & Share Capabilities
 */
import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Download, Share2, Printer, CheckCircle2, AlertTriangle, Shield, Award,
  HelpCircle, ChevronDown, ChevronUp, Sparkles, TrendingUp, BarChart3, PieChart,
  Layers, Zap, Search, Globe, Network, ArrowUpRight, Copy, Trash2, Edit3, Filter,
  ArrowRight, ExternalLink, RefreshCw, Star, Lock, Clock
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, PieChart as RePieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { useDomain } from '../context/DomainContext'

// ── Chart Colors ─────────────────────────────────────────────────────────────
const COLORS = ['#F97316', '#2563EB', '#22C55E', '#7C3AED', '#EF4444', '#06B6D4', '#F59E0B']

// ── Types ────────────────────────────────────────────────────────────────────
interface ActionRecommendation {
  id: string
  problem: string
  whyItMatters: string
  expectedImpact: string
  difficulty: 'Low' | 'Medium' | 'High'
  estimatedRankImprovement: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  category: string
}

interface HistoricalReport {
  id: string
  title: string
  keyword: string
  date: string
  score: number
  grade: string
  status: 'Completed' | 'Archived'
}

export default function ReportsPage() {
  const { domain: verticalFilter, activeDomainName } = useDomain()

  // UI State
  const [activePriorityTab, setActivePriorityTab] = useState<'All' | 'Critical' | 'High' | 'Medium' | 'Low'>('All')
  const [expandedSection, setExpandedSection] = useState<string | null>('seo-analysis')
  const [historySearch, setHistorySearch] = useState('')
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [fixToastMsg, setFixToastMsg] = useState<string | null>(null)

  // Report Metadata
  const reportMeta = {
    name: 'Enterprise Executive SEO & Content Audit',
    projectName: `${activeDomainName} Production Workspace`,
    keyword: 'Payment Gateway Security API',
    generatedDate: new Date().toLocaleString(),
    analysisDuration: '3.4 seconds',
    overallGrade: 'A+',
    overallScore: 94,
    predictedRank: '#2 (Top 3 Guarantee)',
  }

  // Top 5 Action Recommendations (Section 2)
  const topActionPlan: ActionRecommendation[] = [
    {
      id: 'rec-1',
      problem: 'Missing PCI DSS 4.0 Compliance Entity Cluster',
      whyItMatters: 'Google rankers for B2B payment keywords heavily weight regulatory compliance entities.',
      expectedImpact: '+18% Topical Authority',
      difficulty: 'Low',
      estimatedRankImprovement: '+2.4 Positions',
      priority: 'Critical',
      category: 'Entity Coverage'
    },
    {
      id: 'rec-2',
      problem: 'Sub-Optimal H2 Heading Distribution for Webhooks',
      whyItMatters: 'Competitor Stripe ranks #1 by featuring dedicated H2 sections for Webhook Idempotency.',
      expectedImpact: '+12% SERP Match',
      difficulty: 'Low',
      estimatedRankImprovement: '+1.5 Positions',
      priority: 'Critical',
      category: 'Content Structure'
    },
    {
      id: 'rec-3',
      problem: 'Missing Structured FAQ Schema Markup',
      whyItMatters: 'FAQ schema grants Google Rich Snippet eligibility in position 0.',
      expectedImpact: '+28% CTR Boost',
      difficulty: 'Medium',
      estimatedRankImprovement: '+1.8 Positions',
      priority: 'High',
      category: 'Technical Schema'
    },
    {
      id: 'rec-4',
      problem: 'Low Internal Link Density to OAuth 2.0 Security Core',
      whyItMatters: 'Passes PageRank internal link weight from money pages to auth endpoints.',
      expectedImpact: '+10% Link Juice',
      difficulty: 'Low',
      estimatedRankImprovement: '+1.1 Positions',
      priority: 'High',
      category: 'Internal Linking'
    },
    {
      id: 'rec-5',
      problem: 'Readability Index Score Below B2B Standard',
      whyItMatters: 'Complex phrasing reduces average dwell time on technical decision-maker pages.',
      expectedImpact: '+14% Dwell Time',
      difficulty: 'Medium',
      estimatedRankImprovement: '+0.8 Positions',
      priority: 'Medium',
      category: 'Readability'
    }
  ]

  // KPI Performance Data (Section 3)
  const performanceKPIs = [
    { label: 'Overall SEO Score', score: '94%', status: 'Excellent', trend: '+6%', color: 'text-[var(--aurora)]', desc: 'Top 5% across domain' },
    { label: 'Predicted Rank', score: '#2', status: 'Top 3 Target', trend: '+4 Pos', color: 'text-emerald-600', desc: 'Outranks 8/10 competitors' },
    { label: 'Authority Score', score: '88%', status: 'Strong', trend: '+12%', color: 'text-blue-600', desc: 'High entity density' },
    { label: 'Novelty Score', score: '85%', status: 'High Originality', trend: '+5%', color: 'text-purple-600', desc: 'Unique perspectives' },
    { label: 'Semantic Coverage', score: '92%', status: 'Optimal', trend: '+8%', color: 'text-teal-600', desc: 'Covers core subtopics' },
    { label: 'Content Quality', score: '91%', status: 'Grade A', trend: '+4%', color: 'text-[var(--aurora)]', desc: 'Clear H2/H3 hierarchy' },
    { label: 'CTR Prediction', score: '+34%', status: 'High Clickability', trend: '+15%', color: 'text-emerald-600', desc: 'Rich Snippet eligible' },
    { label: 'Readability Grade', score: 'Grade 11', status: 'Advanced B2B', trend: 'Stable', color: 'text-blue-600', desc: 'Targeted at CTOs' }
  ]

  // Content Quality Breakdown (Section 5)
  const qualityBreakdown = [
    { metric: 'Headings Structure (H1-H6)', score: 96, status: 'Optimal', rec: 'Keep H2 hierarchy clear with target keywords.' },
    { metric: 'Paragraph Length & Rhythm', score: 92, status: 'Strong', rec: 'Break down 2 long paragraphs in section 3.' },
    { metric: 'Readability Score (Flesch-Kincaid)', score: 88, status: 'Advanced', rec: 'Simplify technical jargon in intro.' },
    { metric: 'Keyword Density & Placement', score: 95, status: 'Optimal', rec: 'Natural keyword integration maintained.' },
    { metric: 'Semantic Subtopic Coverage', score: 94, status: 'Excellent', rec: 'Include 2 missing compliance subtopics.' },
    { metric: 'Named Entity Density', score: 90, status: 'Strong', rec: 'Add mentions of ISO 27001 standard.' },
    { metric: 'Internal Link Architecture', score: 82, status: 'Needs Polish', rec: 'Add 3 internal links to security docs.' },
    { metric: 'External Reference Quality', score: 96, status: 'Optimal', rec: 'Authoritative links to NIST & IETF.' },
    { metric: 'Schema Markup (JSON-LD)', score: 78, status: 'Action Required', rec: 'Add FAQPage and TechArticle schema.' },
    { metric: 'Content Freshness Factor', score: 98, status: 'Current', rec: 'Updated with 2026 industry standards.' },
    { metric: 'Originality & Unique Angle', score: 92, status: 'High Value', rec: 'Features proprietary benchmarking data.' }
  ]

  // SERP Competitor Comparison (Section 6)
  const serpCompetitors = [
    { name: 'Your Content (Qontint)', position: '#2 (Est)', authority: '88%', coverage: '92%', entities: 42, wordCount: 2450, gap: '0%', status: 'Optimized' },
    { name: 'Stripe Documentation', position: '#1', authority: '94%', coverage: '89%', entities: 48, wordCount: 3100, gap: '-5%', status: 'Market Leader' },
    { name: 'Adyen Developer Docs', position: '#3', authority: '85%', coverage: '84%', entities: 36, wordCount: 1950, gap: '+8%', status: 'Strong Competitor' },
    { name: 'PayPal API Portal', position: '#4', authority: '82%', coverage: '78%', entities: 31, wordCount: 1600, gap: '+14%', status: 'Trailing' },
  ]

  // Chart Data (Section 8)
  const scoreBreakdownData = [
    { subject: 'SEO Score', A: 94, fullMark: 100 },
    { subject: 'Authority', A: 88, fullMark: 100 },
    { subject: 'Coverage', A: 92, fullMark: 100 },
    { subject: 'Readability', A: 88, fullMark: 100 },
    { subject: 'Schema', A: 78, fullMark: 100 },
    { subject: 'Originality', A: 92, fullMark: 100 },
  ]

  const entityDistributionData = [
    { name: 'Technology', value: 35 },
    { name: 'Standard', value: 25 },
    { name: 'Product', value: 20 },
    { name: 'Concept', value: 12 },
    { name: 'Process', value: 8 },
  ]

  // Historical Reports (Section 10)
  const [reportHistory, setReportHistory] = useState<HistoricalReport[]>([
    { id: 'rep-1', title: 'Qontint Executive Audit - Q3', keyword: 'Payment Gateway Security API', date: '2026-07-25', score: 94, grade: 'A+', status: 'Completed' },
    { id: 'rep-2', title: 'Stripe Competitor Benchmark', keyword: 'PCI DSS 4.0 Integration', date: '2026-07-20', score: 88, grade: 'A', status: 'Completed' },
    { id: 'rep-3', title: 'OAuth 2.0 Content Strategy', keyword: 'B2B Authentication API', date: '2026-07-15', score: 82, grade: 'B+', status: 'Archived' },
  ])

  const filteredHistory = useMemo(() => {
    return reportHistory.filter(r =>
      r.title.toLowerCase().includes(historySearch.toLowerCase()) ||
      r.keyword.toLowerCase().includes(historySearch.toLowerCase())
    )
  }, [reportHistory, historySearch])

  const triggerFixNow = (recTitle: string) => {
    setFixToastMsg(`Fixing "${recTitle}"... Recommendation applied to AI Content Studio!`)
    setTimeout(() => setFixToastMsg(null), 4000)
  }

  const exportReport = (format: string) => {
    const content = JSON.stringify(reportMeta, null, 2)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Executive_Report_${reportMeta.keyword.replace(/\s+/g, '_')}.${format.toLowerCase()}`
    link.click()
  }

  return (
    <div className="min-h-screen flex flex-col pt-14 pb-20 px-4 max-w-[1600px] mx-auto space-y-8 relative bg-[var(--bg-void)]">

      {/* Toast Notification */}
      <AnimatePresence>
        {fixToastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 bg-[var(--aurora)] text-white px-5 py-3 rounded-xl shadow-xl font-mono text-xs flex items-center gap-2"
          >
            <Sparkles size={16} /> {fixToastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* HEADER & METADATA BAR                                                 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs relative z-10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/20 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-[var(--text-primary)] text-2xl leading-none">
                  {reportMeta.name}
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase">
                  Executive Standard
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                Project: <strong className="text-[var(--text-primary)]">{reportMeta.projectName}</strong> | Primary Keyword: <strong className="text-[var(--aurora)]">{reportMeta.keyword}</strong>
              </p>
            </div>
          </div>

          {/* Action Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => exportReport('PDF')} className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5">
              <Download size={14} /> PDF
            </button>
            <button onClick={() => exportReport('CSV')} className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5">
              <Download size={14} /> CSV
            </button>
            <button onClick={() => exportReport('JSON')} className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5">
              <Download size={14} /> JSON
            </button>
            <button onClick={() => window.print()} className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5">
              <Printer size={14} /> Print
            </button>
            <button onClick={() => setShareModalOpen(true)} className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 text-[var(--aurora)] border-[var(--aurora)]/30 font-bold">
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>

        {/* Metadata Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs font-mono">
          <div><span className="text-[var(--text-muted)]">Generated:</span> <strong className="text-[var(--text-primary)]">{reportMeta.generatedDate}</strong></div>
          <div><span className="text-[var(--text-muted)]">Analysis Duration:</span> <strong className="text-[var(--aurora)]">{reportMeta.analysisDuration}</strong></div>
          <div><span className="text-[var(--text-muted)]">Overall Grade:</span> <strong className="text-emerald-600 font-bold">{reportMeta.overallGrade}</strong></div>
          <div><span className="text-[var(--text-muted)]">Predicted Rank:</span> <strong className="text-blue-600 font-bold">{reportMeta.predictedRank}</strong></div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: EXECUTIVE SUMMARY CARD                                       */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border border-[var(--aurora)]/25 bg-gradient-to-br from-[var(--bg-card)] via-[var(--bg-card)] to-[var(--bg-void)] shadow-sm relative z-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--aurora)]" />
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Section 1: AI Executive Synthesis</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[var(--text-muted)]">Overall SEO Grade:</span>
            <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-lg font-black font-mono">
              Grade {reportMeta.overallGrade} ({reportMeta.overallScore}/100)
            </span>
          </div>
        </div>

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
          This Executive Intelligence Report evaluates the ranking potential for <strong className="text-[var(--text-primary)]">"{reportMeta.keyword}"</strong> in <span className="text-[var(--aurora)] font-bold">{activeDomainName}</span>.
          Your content demonstrates <strong className="text-emerald-600">exceptional technical quality (94/100)</strong> with strong semantic coverage (92%) and high novelty (85%).
          The document is currently predicted to secure <strong className="text-blue-600">Google Position #2</strong>, outranking major competitors Adyen and PayPal API Portal.
          To capture the #1 spot from Stripe, the page requires minor compliance entity enhancements and structured FAQ schema markup.
        </p>

        {/* Strengths / Weaknesses / Opportunities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[var(--border-subtle)] text-xs">
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
            <h4 className="font-bold text-emerald-600 flex items-center gap-1.5 font-mono uppercase tracking-wider">
              <CheckCircle2 size={14} /> Biggest Strengths
            </h4>
            <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
              <li>Comprehensive entity density around OAuth 2.0 & Webhooks</li>
              <li>Exceptional technical readability index (Grade 11 B2B)</li>
              <li>Strong structured heading hierarchy (H1-H4)</li>
            </ul>
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
            <h4 className="font-bold text-amber-600 flex items-center gap-1.5 font-mono uppercase tracking-wider">
              <AlertTriangle size={14} /> Biggest Weaknesses
            </h4>
            <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
              <li>Missing explicit PCI DSS 4.0 compliance standard cluster</li>
              <li>Absence of structured FAQPage JSON-LD schema</li>
              <li>Low internal linking density to security endpoints</li>
            </ul>
          </div>

          <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
            <h4 className="font-bold text-blue-600 flex items-center gap-1.5 font-mono uppercase tracking-wider">
              <TrendingUp size={14} /> Ranking Opportunities
            </h4>
            <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
              <li>Capture Position #1 from Stripe with PCI DSS entity block</li>
              <li>Eligible for Google Position 0 Rich Snippet via FAQ schema</li>
              <li>+28% CTR increase from featured snippet optimization</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: EXECUTIVE ACTION PLAN (ANSWERS 3 CORE QUESTIONS)             */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border-2 border-[var(--aurora)]/40 bg-[var(--bg-card)] shadow-md relative z-10 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <span className="text-[10px] font-mono text-[var(--aurora)] uppercase tracking-widest font-bold">
              Section 2 Executive Priority Roadmap
            </span>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mt-0.5">Executive Action Plan</h2>
          </div>
          <span className="px-3 py-1 rounded-xl bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/30 text-xs font-bold font-mono">
            5 High Impact Actions
          </span>
        </div>

        {/* The 3 Core Questions Answered */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-2xl">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block mb-1">Question 1</span>
            <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2">How good is my content right now?</h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-emerald-600">Grade A+ (94/100)</strong>. Your content ranks in the top 5% of technical B2B articles in {activeDomainName}.
            </p>
          </div>

          <div className="p-4 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-2xl">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block mb-1">Question 2</span>
            <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2">Why isn't it ranking #1?</h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Competitor Stripe includes a dedicated <strong className="text-[var(--text-primary)]">PCI DSS 4.0 Compliance</strong> subtopic and rich FAQ schema that grants position #1.
            </p>
          </div>

          <div className="p-4 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-2xl">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block mb-1">Question 3</span>
            <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2">What should I fix first?</h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Execute Action #1 below to add PCI DSS compliance entities (<strong className="text-[var(--aurora)]">+2.4 Positions estimated</strong>).
            </p>
          </div>
        </div>

        {/* Top 5 Highest Impact Recommendations Table */}
        <div className="space-y-3 pt-2">
          <h3 className="font-bold text-sm text-[var(--text-primary)] font-mono uppercase tracking-wider">
            Top 5 Highest Impact Recommendations
          </h3>

          <div className="space-y-3">
            {topActionPlan.map((rec, i) => (
              <div key={rec.id} className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] hover:border-[var(--aurora)]/40 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--aurora)]/10 text-[var(--aurora)] font-mono font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    #{i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">{rec.problem}</h4>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                        rec.priority === 'Critical' ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      }`}>
                        {rec.priority} Priority
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">[{rec.category}]</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{rec.whyItMatters}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-4 flex-shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border-subtle)] font-mono text-xs">
                  <div className="text-right">
                    <span className="text-[10px] text-[var(--text-muted)] block">Ranking Gain:</span>
                    <strong className="text-emerald-600 font-bold">{rec.estimatedRankImprovement}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[var(--text-muted)] block">Difficulty:</span>
                    <strong className="text-[var(--text-primary)]">{rec.difficulty}</strong>
                  </div>
                  <button
                    onClick={() => triggerFixNow(rec.problem)}
                    className="btn-secondary px-3 py-1.5 text-xs text-[var(--aurora)] border-[var(--aurora)]/30 font-bold flex items-center gap-1"
                  >
                    <Sparkles size={12} /> Fix Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3: OVERALL PERFORMANCE KPI CARDS GRID                           */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4 relative z-10">
        <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <BarChart3 size={18} className="text-[var(--aurora)]" /> Section 3: Overall Performance KPI Dashboard
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {performanceKPIs.map((kpi, i) => (
            <div key={i} className="card p-5 border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-[var(--text-muted)] uppercase">{kpi.label}</span>
                <span className="text-xs font-mono text-emerald-600 font-bold">{kpi.trend}</span>
              </div>
              <p className={`text-3xl font-black font-mono ${kpi.color} mb-1`}>{kpi.score}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--text-primary)]">{kpi.status}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">{kpi.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 4: DETAILED ANALYSIS COLLAPSIBLE CARDS                        */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4 relative z-10">
        <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Layers size={18} className="text-[var(--aurora)]" /> Section 4: Detailed Subsystem Analysis
        </h3>

        <div className="space-y-3">
          {[
            { id: 'seo-analysis', title: 'SEO Analysis & Keyword Density', score: '94/100', summary: 'Keyword placement is optimized across H1, title, meta description, and primary intro sections.' },
            { id: 'content-quality', title: 'Content Quality & Structure', score: '91/100', summary: 'Clean document flow with 6 structured H2 sections and balanced paragraph lengths.' },
            { id: 'semantic-coverage', title: 'Semantic Coverage & Topic Depth', score: '92/100', summary: 'Covers 92% of core semantic entities found in top 10 SERP competitors.' },
            { id: 'authority', title: 'Authority & Entity Density', score: '88/100', summary: 'Mentions 42 named entities across security, standards, and technology categories.' },
            { id: 'novelty', title: 'Novelty & Originality Index', score: '85/100', summary: '85% unique phrasing and proprietary B2B benchmarking data.' },
          ].map(sec => (
            <div key={sec.id} className="card border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === sec.id ? null : sec.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-depth)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-[var(--text-primary)]">{sec.title}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[var(--aurora)]/10 text-[var(--aurora)]">
                    {sec.score}
                  </span>
                </div>
                {expandedSection === sec.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {expandedSection === sec.id && (
                <div className="p-4 pt-0 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed space-y-2 bg-[var(--bg-depth)]/50">
                  <p>{sec.summary}</p>
                  <p className="font-mono text-[10px] text-[var(--text-muted)]">
                    AI Diagnostic: Passes all Google Helpful Content guidelines and E-E-A-T trust criteria.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 5: CONTENT QUALITY BREAKDOWN MATRIX                           */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs relative z-10 space-y-4">
        <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Award size={18} className="text-[var(--aurora)]" /> Section 5: Content Quality Audit Breakdown (11 Metrics)
        </h3>

        <div className="space-y-2">
          {qualityBreakdown.map((item, idx) => (
            <div key={idx} className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 md:w-72 flex-shrink-0">
                <span className="font-mono text-[10px] font-bold text-[var(--aurora)] w-6">#{idx+1}</span>
                <span className="font-bold text-[var(--text-primary)]">{item.metric}</span>
              </div>

              <div className="flex items-center gap-3 flex-1">
                <div className="w-24 bg-[var(--bg-card)] h-2 rounded-full overflow-hidden border border-[var(--border-subtle)]">
                  <div className="bg-[var(--aurora)] h-full rounded-full" style={{ width: `${item.score}%` }} />
                </div>
                <span className="font-mono font-bold text-[var(--aurora)] w-10">{item.score}%</span>
                <span className="text-[var(--text-secondary)] flex-1">{item.rec}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 6: SERP COMPETITOR COMPARISON MATRIX                           */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs relative z-10 space-y-4">
        <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Globe size={18} className="text-[var(--aurora)]" /> Section 6: SERP Competitor Benchmarking Matrix
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] font-mono text-[var(--text-muted)] text-[10px] uppercase">
                <th className="py-2.5 px-3">Competitor Document</th>
                <th className="py-2.5 px-3">Position</th>
                <th className="py-2.5 px-3">Authority</th>
                <th className="py-2.5 px-3">Semantic Coverage</th>
                <th className="py-2.5 px-3">Entities</th>
                <th className="py-2.5 px-3">Word Count</th>
                <th className="py-2.5 px-3">Gap Status</th>
              </tr>
            </thead>
            <tbody>
              {serpCompetitors.map((comp, idx) => (
                <tr key={idx} className={`border-b border-[var(--border-subtle)] ${idx === 0 ? 'bg-[var(--aurora)]/5 font-bold' : ''}`}>
                  <td className="py-3 px-3 text-[var(--text-primary)]">{comp.name}</td>
                  <td className="py-3 px-3 font-mono text-[var(--aurora)] font-bold">{comp.position}</td>
                  <td className="py-3 px-3 font-mono text-blue-600">{comp.authority}</td>
                  <td className="py-3 px-3 font-mono text-emerald-600">{comp.coverage}</td>
                  <td className="py-3 px-3 font-mono">{comp.entities}</td>
                  <td className="py-3 px-3 font-mono">{comp.wordCount} words</td>
                  <td className="py-3 px-3 font-mono text-emerald-600">{comp.gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 7: KNOWLEDGE GRAPH INSIGHTS EXECUTIVE SUMMARY                   */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs relative z-10 space-y-4">
        <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Network size={18} className="text-[var(--aurora)]" /> Section 7: Knowledge Graph Intelligence Insights
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase">Most Connected Entity</span>
            <strong className="text-[var(--aurora)] text-sm">Payment Gateway API</strong>
          </div>
          <div className="p-3 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase">Strongest Cluster</span>
            <strong className="text-emerald-600 text-sm">OAuth 2.0 Auth Core</strong>
          </div>
          <div className="p-3 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase">Weakest Cluster</span>
            <strong className="text-amber-500 text-sm">PCI DSS Compliance</strong>
          </div>
          <div className="p-3 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase">Relationship Density</span>
            <strong className="text-blue-600 text-sm">27.6 links / node</strong>
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          AI Graph Analysis reveals strong topical authority around payment gateway architectures. Incorporating PCI DSS compliance nodes will balance the authority distribution across all 4 core enterprise clusters.
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 8: VISUAL ANALYTICS (RECHARTS GRAPHS)                          */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs relative z-10 space-y-6">
        <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <PieChart size={18} className="text-[var(--aurora)]" /> Section 8: Visual Performance Analytics
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart: Score Breakdown */}
          <div className="p-4 bg-[var(--bg-depth)] rounded-2xl border border-[var(--border-subtle)]">
            <h4 className="font-bold text-xs text-[var(--text-primary)] mb-3 font-mono">SEO Multi-Factor Radar</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart outerRadius={80} data={scoreBreakdownData}>
                  <PolarGrid stroke="var(--border-subtle)" />
                  <PolarAngleAxis dataKey="subject" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="Score" dataKey="A" stroke="#F97316" fill="#F97316" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart: Entity Distribution */}
          <div className="p-4 bg-[var(--bg-depth)] rounded-2xl border border-[var(--border-subtle)]">
            <h4 className="font-bold text-xs text-[var(--text-primary)] mb-3 font-mono">Entity Type Distribution</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie data={entityDistributionData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {entityDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 9: PRIORITY GROUPED RECOMMENDATIONS                            */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs relative z-10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Zap size={18} className="text-[var(--aurora)]" /> Section 9: Priority Grouped Action List
          </h3>

          <div className="flex items-center gap-1 bg-[var(--bg-depth)] p-1 rounded-xl border border-[var(--border-subtle)] text-xs font-mono">
            {['All', 'Critical', 'High', 'Medium', 'Low'].map(p => (
              <button
                key={p}
                onClick={() => setActivePriorityTab(p as any)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  activePriorityTab === p ? 'bg-[#FFEDD5] text-[#F97316] border border-[#FED7AA]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {topActionPlan
            .filter(r => activePriorityTab === 'All' || r.priority === activePriorityTab)
            .map(rec => (
              <div key={rec.id} className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                      rec.priority === 'Critical' ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}>
                      {rec.priority}
                    </span>
                    <h4 className="font-bold text-[var(--text-primary)] text-sm">{rec.problem}</h4>
                  </div>
                  <p className="text-[var(--text-secondary)]">{rec.whyItMatters}</p>
                </div>

                <button
                  onClick={() => triggerFixNow(rec.problem)}
                  className="btn-secondary px-3 py-1.5 text-xs text-[var(--aurora)] border-[var(--aurora)]/30 font-bold flex items-center gap-1 flex-shrink-0"
                >
                  <Sparkles size={12} /> Fix Recommendation
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 10 & 11: REPORT HISTORY & EXPORT TOOLING                       */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs relative z-10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Clock size={18} className="text-[var(--aurora)]" /> Section 10 & 11: Report History & Archival Management
          </h3>

          <div className="relative">
            <input
              type="text"
              placeholder="Search historical reports..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] w-48"
            />
            <Search className="absolute left-2.5 top-2 text-[var(--text-muted)]" size={12} />
          </div>
        </div>

        <div className="space-y-2">
          {filteredHistory.map(rep => (
            <div key={rep.id} className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-center justify-between text-xs">
              <div>
                <h4 className="font-bold text-[var(--text-primary)]">{rep.title}</h4>
                <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">Keyword: {rep.keyword} · {rep.date}</p>
              </div>
              <div className="flex items-center gap-3 font-mono">
                <span className="font-bold text-emerald-600">{rep.grade} ({rep.score}%)</span>
                <button onClick={() => exportReport('PDF')} className="btn-secondary p-1.5 text-xs" title="Download Report PDF">
                  <Download size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

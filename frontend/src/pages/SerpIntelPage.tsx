// @ts-nocheck
/**
 * SerpIntelPage — SERP Intelligence Analysis Page
 *
 * Stability guarantees:
 *  - Every object access is null-safe (uses optional chaining + fallbacks)
 *  - Every array access is guarded with Array.isArray + fallback
 *  - Explicit state machine: IDLE → LOADING → SUCCESS | ERROR
 *  - Never renders blank screens under any data condition
 *  - ErrorBoundary above this component catches any remaining render errors
 */
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ExternalLink, Activity, Info, Network, BookOpen, MessageSquare, Database, FileText, Download, Target, ChevronDown, ChevronUp, LayoutDashboard, RefreshCw } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import CinematicLoader from '../components/ui/CinematicLoader'
import { analyzeSerpIntelligence, type SerpIntelResponse } from '../api/serpIntelService'

// ─── Utility: safe array access ───────────────────────────────────────────────
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
  const { theme } = useTheme(); console.log(theme);

  

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

// ─── Page state machine type ──────────────────────────────────────────────────
type PageStatus = 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SerpIntelPage() {
  const [keyword, setKeyword] = useState('')
  const [searchEngine, setSearchEngine] = useState('Google')
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<PageStatus>('IDLE')
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<SerpIntelResponse | null>(null)

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
      setStatus('SUCCESS')
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

  // ── Safe data accessors — all accesses guarded against null/undefined ────────
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

  return (
    <div className="relative min-h-screen px-4 md:px-8 max-w-7xl mx-auto pb-32">
      <DecorativeGalaxy />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] mb-4 tracking-tight">
          SERP <span className="text-[var(--aurora)]">Intelligence</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-2xl leading-relaxed">
          Uncover the hidden patterns, semantic structures, and knowledge gaps of the top-ranking pages.
          A complete dissection of why they rank and how to beat them.
        </p>

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

      {/* ── Error State ──────────────────────────────────────────────────── */}
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

      {/* ── Loading State ─────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="max-w-2xl mb-12">
          <CinematicLoader isLoading={isLoading} logs={logs} label="Analyzing SERP" subLabel="Intelligence Pipeline" />
        </div>
      )}

      {/* ── Results State ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {status === 'SUCCESS' && report && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-12">

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

              <div className="mt-8 pt-8 border-t border-[var(--border-subtle)] grid grid-cols-2 md:grid-cols-4 gap-6">
                <ScoreDial value={safeNum(breakdown?.search_intent_match)} color="var(--aurora)" label="Intent Match" size={70} />
                <ScoreDial value={safeNum(breakdown?.semantic_coverage)} color="var(--stellar)" label="Semantics" size={70} />
                <ScoreDial value={safeNum(breakdown?.entity_richness)} color="var(--plasma)" label="Entity Richness" size={70} />
                <ScoreDial value={safeNum(breakdown?.seo_quality)} color="#38BDF8" label="SEO Quality" size={70} />
              </div>
            </div>

            {/* TOP 3 SERP CARDS */}
            {serpResults.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-3">
                  <Target className="text-[var(--aurora)]" /> Analyzed Competitors
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {serpResults.map((res, i) => (
                    <div key={i} className="card p-6 border border-[var(--border-subtle)] flex flex-col h-full bg-[var(--bg-card)]/50 hover:border-[var(--aurora)]/50 transition-colors">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="h-8 px-3 rounded-full bg-[var(--bg-void)] flex items-center justify-center font-bold text-[var(--aurora)] border border-[var(--border-subtle)] text-xs whitespace-nowrap">
                          Competitor #{safeNum(res?.competitor_position, i + 1)} <span className="text-gray-500 font-normal ml-1.5 opacity-80">(Google Rank #{safeNum(res?.google_position, res?.competitor_position ?? i + 1)})</span>
                        </span>
                        {res?.favicon && (
                          <img src={res.favicon} alt="" className="w-4 h-4" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        )}
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

            {/* 11 ANALYSIS SECTIONS */}
            <div className="space-y-6">

              <AnalysisSection title="1. Search Intent Analysis" icon={Target} defaultOpen>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-mono text-xs text-[var(--aurora)] uppercase tracking-widest mb-3">Primary Intent</h4>
                    <p className="text-xl font-bold text-[var(--text-primary)] mb-4">{safeStr(searchIntent?.primary_intent, 'Informational')}</p>
                    <p className="text-[var(--text-secondary)] leading-relaxed">{safeStr(searchIntent?.reasoning, 'No reasoning available.')}</p>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest mb-3">User Expectations</h4>
                      <ul className="space-y-2">
                        {safeArray(searchIntent?.user_expectations).length > 0
                          ? safeArray(searchIntent?.user_expectations).map((exp, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                                <span className="text-[var(--aurora)] mt-0.5">•</span> {safeStr(exp)}
                              </li>
                            ))
                          : <li className="text-[var(--text-muted)] text-sm">No data available.</li>
                        }
                      </ul>
                    </div>
                  </div>
                </div>
              </AnalysisSection>

              <AnalysisSection title="2. SERP Features" icon={LayoutDashboard}>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-mono text-xs text-[var(--aurora)] uppercase tracking-widest mb-3">Detected Features</h4>
                    <div className="flex flex-wrap gap-2">
                      {safeArray(serpFeatures?.detected).length > 0
                        ? safeArray(serpFeatures?.detected).map(f => (
                            <span key={safeStr(f)} className="px-3 py-1 bg-[var(--bg-depth)] rounded-full text-sm border border-[var(--border-subtle)]">{safeStr(f)}</span>
                          ))
                        : <span className="text-[var(--text-muted)] text-sm">None detected</span>
                      }
                    </div>
                  </div>
                  <div>
                    <h4 className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest mb-3">Impact</h4>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{safeStr(serpFeatures?.impact_summary, 'No impact data available.')}</p>
                  </div>
                </div>
              </AnalysisSection>

              <AnalysisSection title="3. Content Structure" icon={BookOpen}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Avg Words</p>
                    <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{safeNum(contentStructure?.average_word_count)}</p>
                  </div>
                  <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Avg H2s</p>
                    <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{safeNum(contentStructure?.average_h2)}</p>
                  </div>
                  <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Uses Lists</p>
                    <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{safeBool(contentStructure?.uses_lists) ? 'Yes' : 'No'}</p>
                  </div>
                  <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Uses Images</p>
                    <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{safeBool(contentStructure?.uses_images) ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-mono text-xs text-[var(--aurora)] uppercase tracking-widest mb-3">Structural Insights</h4>
                  <ul className="space-y-2">
                    {safeArray(contentStructure?.insights).length > 0
                      ? safeArray(contentStructure?.insights).map((ins, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                            <span className="text-[var(--aurora)] mt-0.5">→</span> {safeStr(ins)}
                          </li>
                        ))
                      : <li className="text-[var(--text-muted)] text-sm">No structural insights available.</li>
                    }
                  </ul>
                </div>
              </AnalysisSection>

              <AnalysisSection title="4. Topic Coverage" icon={Database}>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-mono text-xs text-[var(--aurora)] uppercase tracking-widest mb-3">Main Topics Found</h4>
                    <div className="flex flex-wrap gap-2">
                      {safeArray(topicCoverage?.main_topics).length > 0
                        ? safeArray(topicCoverage?.main_topics).map(t => (
                            <span key={safeStr(t)} className="px-3 py-1 bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/20 rounded-full text-sm">{safeStr(t)}</span>
                          ))
                        : <span className="text-[var(--text-muted)] text-sm">No topics extracted.</span>
                      }
                    </div>
                  </div>
                  <div>
                    <h4 className="font-mono text-xs text-[var(--stellar)] uppercase tracking-widest mb-3">Weak Areas</h4>
                    <ul className="space-y-2">
                      {safeArray(topicCoverage?.weak_areas).length > 0
                        ? safeArray(topicCoverage?.weak_areas).map((w, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                              <span className="text-[var(--stellar)] mt-0.5">⚠</span> {safeStr(w)}
                            </li>
                          ))
                        : <li className="text-[var(--text-muted)] text-sm">No weak areas identified.</li>
                      }
                    </ul>
                  </div>
                </div>
              </AnalysisSection>

              <AnalysisSection title="5. Keyword & Semantic Analysis" icon={Search}>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-mono text-xs text-[var(--aurora)] uppercase tracking-widest mb-3">Primary & Secondary Keywords</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-3 py-1 bg-[var(--aurora)] text-white rounded-full text-sm font-bold">{safeStr(keywordAnalysis?.primary_keyword, keyword)}</span>
                      {safeArray(keywordAnalysis?.secondary_keywords).map(k => (
                        <span key={safeStr(k)} className="px-3 py-1 bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-full text-sm">{safeStr(k)}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest mb-3">LSI & Related Terms</h4>
                    <div className="flex flex-wrap gap-2">
                      {safeArray(semanticAnalysis?.lsi_keywords).length > 0
                        ? safeArray(semanticAnalysis?.lsi_keywords).map((k, i) => (
                            <span key={i} className="px-2 py-1 text-xs text-[var(--text-secondary)] bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded">{safeStr(k)}</span>
                          ))
                        : <span className="text-[var(--text-muted)] text-sm">No LSI terms extracted.</span>
                      }
                    </div>
                  </div>
                </div>
              </AnalysisSection>

              <AnalysisSection title="6. Semantic Clusters" icon={Network}>
                <div className="grid md:grid-cols-2 gap-4">
                  {safeArray(semanticAnalysis?.semantic_clusters).length > 0
                    ? safeArray(semanticAnalysis?.semantic_clusters).map((cluster: any, i) => (
                        <div key={i} className="p-4 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-depth)]">
                          <h4 className="font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--aurora)]"></span>
                            {safeStr(cluster?.cluster ?? cluster)}
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {safeArray(cluster?.terms).map((t: any) => (
                              <span key={safeStr(t)} className="px-2 py-0.5 text-xs bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded text-[var(--text-muted)]">{safeStr(t)}</span>
                            ))}
                          </div>
                        </div>
                      ))
                    : <p className="text-[var(--text-muted)] text-sm">No semantic clusters available.</p>
                  }
                </div>
              </AnalysisSection>

              <AnalysisSection title="7. Readability & Tone" icon={FileText}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Reading Level</p>
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{safeStr(readability?.average_reading_level, 'N/A')}</p>
                  </div>
                  <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Tone</p>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{safeStr(readability?.tone, 'N/A')}</p>
                  </div>
                  <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Complexity</p>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{safeStr(readability?.complexity, 'N/A')}</p>
                  </div>
                  <div className="bg-[var(--bg-depth)] p-4 rounded-xl border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Avg Sentence</p>
                    <p className="text-sm font-bold text-[var(--text-primary)] font-mono">{safeNum(readability?.average_sentence_length, 15)} words</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed"><span className="font-bold text-[var(--text-primary)]">Writing Style:</span> {safeStr(readability?.writing_style, 'N/A')}</p>
              </AnalysisSection>

              <AnalysisSection title="8. SEO Analysis" icon={Activity}>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-[var(--border-subtle)]">
                      <span className="text-sm text-[var(--text-muted)]">Title Optimization</span>
                      <span className="text-sm font-bold">{safeStr(seoAnalysis?.title_optimization, 'N/A')}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-[var(--border-subtle)]">
                      <span className="text-sm text-[var(--text-muted)]">Meta Quality</span>
                      <span className="text-sm font-bold">{safeStr(seoAnalysis?.meta_quality, 'N/A')}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-[var(--border-subtle)]">
                      <span className="text-sm text-[var(--text-muted)]">Content Freshness</span>
                      <span className="text-sm font-bold">{safeStr(seoAnalysis?.content_freshness, 'N/A')}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-mono text-xs text-[var(--aurora)] uppercase tracking-widest mb-3">SEO Recommendations</h4>
                    <ul className="space-y-2">
                      {safeArray(seoAnalysis?.recommendations).length > 0
                        ? safeArray(seoAnalysis?.recommendations).map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                              <span className="text-[var(--aurora)] mt-0.5">+</span> {safeStr(rec)}
                            </li>
                          ))
                        : <li className="text-[var(--text-muted)] text-sm">No recommendations available.</li>
                      }
                    </ul>
                  </div>
                </div>
              </AnalysisSection>

              <AnalysisSection title="9. Entity Extraction" icon={Database}>
                <div className="grid md:grid-cols-3 gap-6">
                  {Object.entries(entities).filter(([, items]) => safeArray(items as any).length > 0).length > 0
                    ? Object.entries(entities).filter(([, items]) => safeArray(items as any).length > 0).map(([category, items]) => (
                        <div key={category}>
                          <h4 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-2">{category.replace('_', ' ')}</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {safeArray(items as any).map((item: any) => (
                              <span key={safeStr(item)} className="px-2 py-0.5 text-xs bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded text-[var(--text-secondary)]">{safeStr(item)}</span>
                            ))}
                          </div>
                        </div>
                      ))
                    : <p className="text-[var(--text-muted)] text-sm">No entities extracted.</p>
                  }
                </div>
              </AnalysisSection>

              <AnalysisSection title="10. Knowledge Gaps" icon={Info}>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-mono text-xs text-[var(--aurora)] uppercase tracking-widest mb-3">Missing Concepts</h4>
                    <ul className="space-y-2 mb-6">
                      {safeArray(knowledgeGaps?.missing_concepts).length > 0
                        ? safeArray(knowledgeGaps?.missing_concepts).map((gap, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                              <span className="text-red-400 mt-0.5">✗</span> {safeStr(gap)}
                            </li>
                          ))
                        : <li className="text-[var(--text-muted)] text-sm">No missing concepts identified.</li>
                      }
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-mono text-xs text-[var(--stellar)] uppercase tracking-widest mb-3">Content Opportunities</h4>
                    <ul className="space-y-2">
                      {safeArray(knowledgeGaps?.content_opportunities).length > 0
                        ? safeArray(knowledgeGaps?.content_opportunities).map((opp, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                              <span className="text-[var(--stellar)] mt-0.5">✓</span> {safeStr(opp)}
                            </li>
                          ))
                        : <li className="text-[var(--text-muted)] text-sm">No opportunities identified.</li>
                      }
                    </ul>
                  </div>
                </div>
              </AnalysisSection>

              <AnalysisSection title="11. Knowledge Synthesis" icon={MessageSquare}>
                <div className="p-6 bg-[var(--aurora)]/5 border border-[var(--aurora)]/20 rounded-xl mb-8">
                  <h4 className="font-mono text-xs text-[var(--aurora)] uppercase tracking-widest mb-4">Synthesized Summary</h4>
                  <div className="text-[var(--text-primary)] leading-relaxed text-base space-y-4">
                    {safeStr(summary).split('\n').filter(p => p.trim()).map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                </div>

                {/* Key Insights from knowledge_synthesis */}
                {safeArray(knowledgeSynthesis?.key_insights).length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest mb-3">Key Insights</h4>
                    <ul className="space-y-2">
                      {safeArray(knowledgeSynthesis?.key_insights).map((insight, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                          <span className="text-[var(--aurora)] mt-0.5">→</span> {safeStr(insight)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest mb-4">Sources</h4>
                  <div className="space-y-4">
                    {serpResults.map((source, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] hover:border-[var(--aurora)]/30 transition-colors">
                        <div className="h-8 px-2 rounded bg-[var(--bg-card)] flex items-center justify-center font-mono text-[var(--aurora)] font-bold text-xs whitespace-nowrap flex-shrink-0">
                          Competitor #{safeNum(source?.competitor_position, idx + 1)} <span className="text-[10px] text-gray-500 font-normal ml-1">(Google Rank #{safeNum(source?.google_position, source?.competitor_position ?? idx + 1)})</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <a href={safeStr(source?.url)} target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] hover:text-[var(--aurora)] font-bold text-sm block mb-1">
                            {safeStr(source?.title, 'Untitled')}
                          </a>
                          <a href={safeStr(source?.url)} target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-mono truncate max-w-full block">
                            {safeStr(source?.url)}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </AnalysisSection>

            </div>

            <div className="flex justify-end pt-8">
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
                className="flex items-center gap-2 bg-[var(--bg-depth)] hover:bg-[var(--aurora)]/10 text-[var(--text-primary)] hover:text-[var(--aurora)] px-6 py-3 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--aurora)]/50 transition-all font-bold text-sm"
              >
                <Download size={16} /> Export JSON Report
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

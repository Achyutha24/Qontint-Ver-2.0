import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertTriangle, BarChart2, Target, Shield, Info, ChevronDown, ChevronUp } from 'lucide-react'

export type AnalyzeResult = {
  keyword?: string
  novelty: {
    novelty_score: number
    similarity_score: number
    entity_novelty: number
    relationship_novelty: number
    semantic_diversity: number
    passed: boolean
    threshold: number
    verdict: string
    reasoning?: string[]
  }
  ranking: {
    predicted_rank: number
    confidence: number
    optimization_gaps?: string[]
    position_range?: [number, number]
    improvement_potential?: string
  }
  authority: {
    authority_score: number
    matched_entities: string[]
    missing_entities: string[]
    total_checked?: number
  }
  recommendations: { type: string; description: string; suggested_entities?: string[]; priority: string }[]
  competitor_comparison: any | null
  total_processing_time_ms: number
  loop_required: boolean
}

export function normalizeAnalyzeResponse(raw: Record<string, unknown>): AnalyzeResult {
  const novelty = (raw.novelty ?? {}) as AnalyzeResult['novelty']
  const rankingRaw = (raw.ranking ?? {}) as Record<string, unknown>
  const authorityRaw = (raw.authority ?? {}) as Record<string, unknown>

  const predictedRank =
    (rankingRaw.predicted_rank as number | undefined) ??
    (rankingRaw.predicted_position as number | undefined) ??
    50

  const range = rankingRaw.position_range as [number, number] | undefined
  const positionRange: [number, number] = range ?? [
    Math.max(1, predictedRank - 5),
    Math.min(100, predictedRank + 5),
  ]

  const matched = (authorityRaw.matched_entities as string[] | undefined) ?? []
  const missing =
    (authorityRaw.missing_entities as string[] | undefined) ??
    (authorityRaw.missing_high_authority as string[] | undefined) ??
    []

  const authorityScore =
    (authorityRaw.authority_score as number | undefined) ??
    (authorityRaw.coverage_score as number | undefined) ??
    0

  const totalChecked =
    (authorityRaw.total_checked as number | undefined) ??
    Math.max(matched.length + missing.length, 1)

  const gaps = (rankingRaw.optimization_gaps as string[] | undefined) ?? []
  const improvement =
    (rankingRaw.improvement_potential as string | undefined) ??
    (gaps.length > 0 ? gaps[0] : 'Content meets baseline ranking signals.')

  return {
    keyword: (raw.keyword as string | undefined) || undefined,
    novelty,
    ranking: {
      predicted_rank: predictedRank,
      confidence: (rankingRaw.confidence as number) ?? 0.5,
      optimization_gaps: gaps,
      position_range: positionRange,
      improvement_potential: improvement,
    },
    authority: {
      authority_score: authorityScore,
      matched_entities: matched,
      missing_entities: missing,
      total_checked: totalChecked,
    },
    recommendations: (raw.recommendations as AnalyzeResult['recommendations']) ?? [],
    competitor_comparison: (raw.competitor_comparison as any | undefined) ?? null,
    total_processing_time_ms: (raw.total_processing_time_ms as number) ?? 0,
    loop_required: Boolean(raw.loop_required),
  }
}

import ScoreCard from './ScoreCard'

function RecCard({ rec }: { rec: { type: string; description: string; suggested_entities?: string[]; priority: string } }) {
  const [open, setOpen] = useState(false)
  const tagCls = rec.priority === 'High' ? 'text-[var(--solar)] border-[var(--solar)]' : 
                 rec.priority === 'Medium' ? 'text-[var(--aurora)] border-[var(--aurora)]' : 
                 'text-[var(--stellar)] border-[var(--stellar)]'
  return (
    <div className="card p-4 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Info className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-primary)]">{rec.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`tag ${tagCls}`}>{rec.priority}</span>
          {open ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
        </div>
      </div>
      <AnimatePresence>
        {open && rec.suggested_entities && rec.suggested_entities.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-muted)] mb-2 font-mono uppercase tracking-wider">Suggested Entities</p>
              <div className="flex flex-wrap gap-2">
                {rec.suggested_entities.map((e, i) => (
                  <span key={i} className="tag">{e}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ResultsPanel({ data }: { data: AnalyzeResult }) {
  const { novelty, ranking, authority, recommendations, total_processing_time_ms, loop_required } = data
  const positionRange = ranking.position_range ?? [
    Math.max(1, ranking.predicted_rank - 5),
    Math.min(100, ranking.predicted_rank + 5),
  ]

  // Section collapse states (persisted in session)
  const [showNovelty, setShowNovelty] = useState(true)
  const [showRanking, setShowRanking] = useState(true)
  const [showRecs, setShowRecs] = useState(true)

  // Derived strengths & gaps
  const strengthsCount = (novelty.passed ? 1 : 0) + (authority.matched_entities?.length > 0 ? 1 : 0) + (ranking.confidence >= 0.7 ? 1 : 0)
  const gapsCount = (authority.missing_entities?.length || 0) + (ranking.optimization_gaps?.length || 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-6 print:space-y-4"
    >
      {/* ── Status Bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {novelty.passed ? (
          <span className="tag text-[var(--aurora)] border-[var(--aurora)] flex items-center gap-1 font-bold">
            <CheckCircle className="w-3.5 h-3.5" /> NOVELTY PASSED
          </span>
        ) : (
          <span className="tag text-[var(--solar)] border-[var(--solar)] flex items-center gap-1 font-bold">
            <AlertTriangle className="w-3.5 h-3.5" /> NOVELTY REVISION REQUIRED
          </span>
        )}
        {loop_required && <span className="tag text-[var(--solar)] border-[var(--solar)] font-bold">REVISION REQUIRED</span>}
        <span className="ml-auto font-mono text-xs text-[var(--text-muted)]">{total_processing_time_ms}ms pipeline telemetry</span>
      </div>

      {/* ── Executive Analysis Summary Banner ─────────────────────────────────── */}
      <div className="card p-6 border border-[var(--aurora)]/30 bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-depth)] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--aurora)]" />
            <h3 className="font-bold text-base text-[var(--text-primary)]">Executive Analysis Summary</h3>
          </div>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/20 uppercase tracking-wider">
            Analysis Complete
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Overall Content Quality</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {novelty.passed ? '🟢 Excellent Quality (Passed)' : '🟠 Revision Recommended'}
            </span>
          </div>

          <div className="p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Identified Strengths</span>
            <span className="text-sm font-bold text-[var(--aurora)] mt-1 block">
              {strengthsCount} Key Strengths Detected
            </span>
          </div>

          <div className="p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Content Gaps to Address</span>
            <span className="text-sm font-bold text-amber-500 mt-1 block">
              {gapsCount} Priority Gaps Found
            </span>
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--aurora)] font-bold">Primary Recommendation:</strong> {ranking.improvement_potential || 'Content meets baseline ranking signals. Address missing high-authority entities to push for Top 3 position.'}
        </p>
      </div>

      {/* ── Section 1: Novelty Breakdown ─────────────────────────────────────── */}
      <div className="card p-6 reveal">
        <div className="flex items-center justify-between mb-5 border-b border-[var(--border-subtle)] pb-3">
          <h3 className="font-display font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[var(--aurora)]" /> Content Novelty & Quality Breakdown
          </h3>
          <button
            onClick={() => setShowNovelty(!showNovelty)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono flex items-center gap-1"
          >
            {showNovelty ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{showNovelty ? 'Collapse' : 'Expand'}</span>
          </button>
        </div>

        {showNovelty && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ScoreCard score={novelty.novelty_score} metricKey="novelty" />
              <ScoreCard score={novelty.entity_novelty} metricKey="entity" />
              <ScoreCard score={novelty.relationship_novelty} metricKey="relationship" />
              <ScoreCard score={novelty.semantic_diversity} metricKey="diversity" />
            </div>

            <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-wrap gap-4 text-sm font-mono">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-0.5">Verdict</p>
                <p className="text-[var(--text-primary)] font-medium">{novelty.verdict}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-0.5">Similarity Score</p>
                <p className="text-[var(--text-primary)] font-medium">{(novelty.similarity_score * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-0.5">Threshold</p>
                <p className="text-[var(--text-primary)] font-medium">{novelty.threshold}</p>
              </div>
            </div>

            {novelty.reasoning && novelty.reasoning.length > 0 && (
              <div className="bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-xl p-4">
                <p className="font-mono text-xs text-[var(--text-muted)] mb-2 uppercase font-bold">Analysis Reasoning & Evidence</p>
                <ul className="space-y-1.5">
                  {novelty.reasoning.map((reason: string, i: number) => (
                    <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                      <span className="text-[var(--aurora)] shrink-0 font-bold">→</span> {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 2: Ranking Prediction & Authority Coverage ──────────────── */}
      <div className="card p-6 reveal space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <h3 className="font-display font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--aurora)]" /> Ranking Prediction & Entity Coverage
          </h3>
          <button
            onClick={() => setShowRanking(!showRanking)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono flex items-center gap-1"
          >
            {showRanking ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{showRanking ? 'Collapse' : 'Expand'}</span>
          </button>
        </div>

        {showRanking && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-4 bg-[var(--bg-depth)] rounded-2xl border border-[var(--border-subtle)] space-y-3">
              <h4 className="font-bold text-xs text-[var(--text-primary)] font-mono uppercase">Predicted SERP Position</h4>
              <div className="flex items-end gap-2">
                <span className="font-mono text-5xl font-bold text-[var(--aurora)]">#{ranking.predicted_rank}</span>
                <span className="text-[var(--text-muted)] text-sm mb-1 font-mono">
                  [{positionRange[0]}–{positionRange[1]}]
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">{ranking.improvement_potential}</p>
              <div className="flex items-center gap-2 pt-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-[var(--aurora)] to-[var(--plasma)]"
                  style={{ width: `${ranking.confidence * 100}%`, maxWidth: '100%' }}
                />
                <span className="font-mono text-xs text-[var(--text-muted)]">{(ranking.confidence * 100).toFixed(0)}% model confidence</span>
              </div>

              {ranking.optimization_gaps && ranking.optimization_gaps.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
                  <p className="font-mono text-xs text-[var(--text-muted)] mb-2 uppercase font-bold">Optimization Gaps</p>
                  <ul className="space-y-1">
                    {ranking.optimization_gaps.map((gap: string, i: number) => (
                      <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5">
                        <span className="text-[var(--solar)] shrink-0">•</span> {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-4 bg-[var(--bg-depth)] rounded-2xl border border-[var(--border-subtle)] space-y-3">
              <h4 className="font-bold text-xs text-[var(--text-primary)] font-mono uppercase">Authority Entity Coverage</h4>
              <div className="flex items-end gap-2">
                <span className="font-mono text-5xl font-bold text-[var(--aurora)]">
                  {(authority.authority_score * 100).toFixed(0)}%
                </span>
                <span className="text-[var(--text-muted)] text-sm mb-1 font-mono">/{authority.total_checked} entities</span>
              </div>

              {authority.matched_entities.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] text-emerald-600 font-bold uppercase mb-1">Covered Entities</p>
                  <div className="flex flex-wrap gap-1">
                    {authority.matched_entities.slice(0, 4).map((e: string, i: number) => (
                      <span key={i} className="tag text-emerald-600 border-emerald-500/30 bg-emerald-500/10 text-[10px]">{e}</span>
                    ))}
                  </div>
                </div>
              )}

              {authority.missing_entities.length > 0 && (
                <div className="pt-2">
                  <p className="font-mono text-[10px] text-amber-500 font-bold uppercase mb-1">Missing High-Value Entities</p>
                  <div className="flex flex-wrap gap-1">
                    {authority.missing_entities.slice(0, 4).map((e: string, i: number) => (
                      <span key={i} className="tag text-[var(--solar)] border-[var(--solar)] text-[10px]">{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Priority Action Plan & Recommendations ─────────────────── */}
      {recommendations.length > 0 && (
        <div className="card p-6 reveal space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <h3 className="font-display font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Info className="w-4 h-4 text-[var(--aurora)]" />
              Executive Action Plan & Recommendations ({recommendations.length})
            </h3>
            <button
              onClick={() => setShowRecs(!showRecs)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono flex items-center gap-1"
            >
              {showRecs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>{showRecs ? 'Collapse' : 'Expand'}</span>
            </button>
          </div>

          {showRecs && (
            <div className="space-y-3">
              {recommendations.map((rec: any, i: number) => <RecCard key={i} rec={rec} />)}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

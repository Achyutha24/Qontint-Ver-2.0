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

function ScoreDial({ value, color, label }: { value: number; color: string; label: string }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const offset = circ - value * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
        <circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          style={{ stroke: color, strokeDasharray: circ, strokeDashoffset: offset, transition: 'stroke-dashoffset 1s ease-out' }}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" fill={color} fontSize="16" fontWeight="700" fontFamily="Space Mono">
          {Math.round(value * 100)}
        </text>
      </svg>
      <p className="text-xs text-[var(--text-muted)] font-mono text-center leading-tight">{label}</p>
    </div>
  )
}

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        {novelty.passed ? (
          <span className="tag text-[var(--aurora)] border-[var(--aurora)]">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> NOVELTY PASSED
          </span>
        ) : (
          <span className="tag text-[var(--solar)] border-[var(--solar)]">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> NOVELTY FAILED
          </span>
        )}
        {loop_required && <span className="tag text-[var(--solar)] border-[var(--solar)]">REVISION REQUIRED</span>}
        <span className="ml-auto font-mono text-xs text-[var(--text-muted)]">{total_processing_time_ms}ms pipeline</span>
      </div>

      <div className="card p-6 reveal">
        <h3 className="font-display font-semibold text-[var(--text-primary)] mb-5 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[var(--aurora)]" /> Novelty Breakdown
        </h3>
        <div className="flex flex-wrap justify-around gap-4">
          <ScoreDial value={novelty.novelty_score} color="var(--aurora)" label="Overall Novelty" />
          <ScoreDial value={novelty.entity_novelty} color="var(--plasma)" label="Entity Novelty" />
          <ScoreDial value={novelty.relationship_novelty} color="var(--stellar)" label="Relationship" />
          <ScoreDial value={novelty.semantic_diversity} color="var(--gold)" label="Semantic Diversity" />
        </div>
        <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap gap-4 text-sm">
          <div>
            <p className="font-mono text-xs text-[var(--text-muted)] mb-0.5">Verdict</p>
            <p className="text-[var(--text-primary)] font-medium">{novelty.verdict}</p>
          </div>
          <div>
            <p className="font-mono text-xs text-[var(--text-muted)] mb-0.5">Similarity Score</p>
            <p className="text-[var(--text-primary)] font-medium">{(novelty.similarity_score * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-mono text-xs text-[var(--text-muted)] mb-0.5">Threshold</p>
            <p className="text-[var(--text-primary)] font-medium">{novelty.threshold}</p>
          </div>
        </div>
        {novelty.reasoning && novelty.reasoning.length > 0 && (
          <div className="mt-4 bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg p-3">
            <p className="font-mono text-xs text-[var(--text-muted)] mb-1 uppercase">Analysis Reasoning</p>
            <ul className="space-y-1">
              {novelty.reasoning.map((reason: string, i: number) => (
                <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5">
                  <span className="text-[var(--aurora)] shrink-0">→</span> {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 reveal">
        <div className="lg:col-span-2 card p-6">
          <h3 className="font-display font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--aurora)]" /> Ranking Prediction
          </h3>
          <div className="flex items-end gap-2 mb-3">
            <span className="font-mono text-5xl font-bold text-[var(--aurora)]">#{ranking.predicted_rank}</span>
            <span className="text-[var(--text-muted)] text-sm mb-1 font-mono">
              [{positionRange[0]}–{positionRange[1]}]
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-2">{ranking.improvement_potential}</p>
          <div className="flex items-center gap-2 mt-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-[var(--aurora)] to-[var(--plasma)]"
              style={{ width: `${ranking.confidence * 100}%`, maxWidth: '100%' }}
            />
            <span className="font-mono text-xs text-[var(--text-muted)]">{(ranking.confidence * 100).toFixed(0)}% conf</span>
          </div>
          {ranking.optimization_gaps && ranking.optimization_gaps.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
              <p className="font-mono text-xs text-[var(--text-muted)] mb-2 uppercase">Optimization Gaps</p>
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

        <div className="card p-5">
          <h3 className="font-display font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--aurora)]" /> Authority Coverage
          </h3>
          <div className="flex items-end gap-2 mb-3">
            <span className="font-mono text-5xl font-bold text-[var(--aurora)]">
              {(authority.authority_score * 100).toFixed(0)}%
            </span>
            <span className="text-[var(--text-muted)] text-sm mb-1">/{authority.total_checked} entities</span>
          </div>
          {authority.missing_entities.length > 0 && (
            <div>
              <p className="font-mono text-xs text-[var(--text-muted)] mb-1.5">Missing</p>
              <div className="flex flex-wrap gap-1">
                {authority.missing_entities.slice(0, 3).map((e: string, i: number) => (
                  <span key={i} className="tag text-[var(--solar)] border-[var(--solar)]">{e}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="reveal">
          <h3 className="font-display font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--text-secondary)]" />
            Recommendations ({recommendations.length})
          </h3>
          <div className="space-y-3">
            {recommendations.map((rec: any, i: number) => <RecCard key={i} rec={rec} />)}
          </div>
        </div>
      )}
    </motion.div>
  )
}

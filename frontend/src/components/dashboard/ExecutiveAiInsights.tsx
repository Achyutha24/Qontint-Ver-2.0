import { Sparkles, CheckCircle2, AlertCircle, Lightbulb, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export interface ExecutiveAiInsightsProps {
  lastAnalysisKeyword?: string | null
  seoScore?: number | null
  sweetSpotKeywords?: number
  activeDomainName: string
}

export default function ExecutiveAiInsights({
  lastAnalysisKeyword,
  seoScore,
  sweetSpotKeywords = 0,
  activeDomainName,
}: ExecutiveAiInsightsProps) {
  const navigate = useNavigate()

  return (
    <div className="card p-6 border border-[var(--aurora)]/30 bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-depth)] shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--aurora)]" />
          <h3 className="font-bold text-base text-[var(--text-primary)]">Executive AI Insights</h3>
        </div>
        <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/20 uppercase tracking-wider">
          Live Workspace Telemetry
        </span>
      </div>

      <div className="space-y-3">
        {/* Opportunity 1 */}
        <div className="p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 flex-shrink-0 mt-0.5">
            <CheckCircle2 size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-[var(--text-primary)]">Top Opportunity Identified</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
              Found <strong className="text-[var(--text-primary)]">{sweetSpotKeywords} Sweet Spot keywords</strong> for {activeDomainName} with high commercial intent and minimal competition.
            </p>
          </div>
          <button onClick={() => navigate('/app/keywords')} className="text-xs text-[var(--aurora)] font-bold hover:underline flex-shrink-0">
            Explore
          </button>
        </div>

        {/* Opportunity 2 */}
        {lastAnalysisKeyword ? (
          <div className="p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[var(--aurora)]/10 text-[var(--aurora)] flex-shrink-0 mt-0.5">
              <Lightbulb size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-[var(--text-primary)]">Recent Quality Improvement</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Analysis for <strong className="text-[var(--aurora)]">"{lastAnalysisKeyword}"</strong> achieved an SEO score of <strong className="text-emerald-600">{seoScore ?? 92}%</strong>.
              </p>
            </div>
            <button onClick={() => navigate('/app/reports')} className="text-xs text-[var(--aurora)] font-bold hover:underline flex-shrink-0">
              View Report
            </button>
          </div>
        ) : (
          <div className="p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 flex-shrink-0 mt-0.5">
              <AlertCircle size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-[var(--text-primary)]">Pending Content Analysis</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                No recent content analysis run for {activeDomainName}. Paste your draft to unlock NLP entity insights.
              </p>
            </div>
            <button onClick={() => navigate('/app/analyze')} className="text-xs text-[var(--aurora)] font-bold hover:underline flex-shrink-0 flex items-center gap-1">
              Analyze <ArrowRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

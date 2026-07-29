import { Clock, Cpu, Zap, FileText, Globe, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export interface ActivityItem {
  id: string
  title: string
  type: 'analysis' | 'article' | 'report' | 'serp'
  time: string
  route: string
  detail?: string
}

export default function RecentActivityTimeline({ lastAnalysisKeyword }: { lastAnalysisKeyword?: string | null }) {
  const navigate = useNavigate()

  const items: ActivityItem[] = [
    ...(lastAnalysisKeyword ? [{
      id: '1',
      title: `Completed Neural Analysis for "${lastAnalysisKeyword}"`,
      type: 'analysis' as const,
      time: 'Just now',
      route: '/app/reports',
      detail: 'SEO Compliance: 92% | Novelty: 44%',
    }] : []),
    {
      id: '2',
      title: 'Generated B2B Technical Blueprint Article',
      type: 'article' as const,
      time: '2 hours ago',
      route: '/app/generate',
      detail: 'Saved in AI Content Studio',
    },
    {
      id: '3',
      title: 'Ran Live SERP Competitor Audit',
      type: 'serp' as const,
      time: '5 hours ago',
      route: '/app/serp-intel',
      detail: 'Scanned Top 3 Google Search Results',
    },
    {
      id: '4',
      title: 'Generated Executive Compliance Report',
      type: 'report' as const,
      time: '1 day ago',
      route: '/app/reports',
      detail: 'Exported Executive Summary PDF',
    },
  ]

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'analysis': return <Cpu size={14} className="text-[var(--aurora)]" />
      case 'article': return <Zap size={14} className="text-emerald-500" />
      case 'report': return <FileText size={14} className="text-blue-500" />
      case 'serp': return <Globe size={14} className="text-purple-500" />
    }
  }

  return (
    <div className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[var(--aurora)]" />
          <h3 className="font-bold text-base text-[var(--text-primary)]">Recent Workspace Activity</h3>
        </div>
        <span className="text-xs font-mono text-[var(--text-muted)]">Live Stream</span>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div
            key={item.id}
            onClick={() => navigate(item.route)}
            className="p-3 bg-[var(--bg-depth)] hover:bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] hover:border-[var(--aurora)]/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] flex-shrink-0 mt-0.5">
                {getIcon(item.type)}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--aurora)] transition-colors">
                  {item.title}
                </h4>
                {item.detail && <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">{item.detail}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{item.time}</span>
              <ArrowRight size={12} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

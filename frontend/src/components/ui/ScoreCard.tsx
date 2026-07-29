import { useState } from 'react'
import { Info } from 'lucide-react'

export interface ScoreCardProps {
  score: number // 0-100 or 0.0-1.0
  metricKey?: string
  customTitle?: string
  customDescription?: string
  customSubtext?: string
  color?: string
  className?: string
}

export const METRIC_METADATA: Record<string, {
  title: string
  description: string
  whyItMatters: string
  howToImprove: string
}> = {
  overall: {
    title: 'Overall Content Quality Score',
    description: 'Measures the overall quality of the content.',
    whyItMatters: 'Search engines reward content that excels across multiple quality dimensions.',
    howToImprove: 'Address highlighted content gaps, improve readability, and enrich entity coverage.',
  },
  seo: {
    title: 'Search Engine Optimization Score',
    description: 'Measures how well the content follows SEO best practices.',
    whyItMatters: 'High SEO compliance ensures search crawlers can index and rank your page effectively.',
    howToImprove: 'Optimize title tags, H2/H3 headings, meta descriptions, and keyword alignment.',
  },
  semantic: {
    title: 'Semantic Relevance Score',
    description: 'Measures how closely the content matches the search topic.',
    whyItMatters: 'Google rankers rely on semantic vector embeddings to gauge topical relevance.',
    howToImprove: 'Include related subtopics, domain-specific terminology, and contextually rich sections.',
  },
  novelty: {
    title: 'Content Novelty Score',
    description: 'Measures how unique the content is compared to competitors.',
    whyItMatters: 'Unique insights differentiate your content from generic competitor regurgitation.',
    howToImprove: 'Add original statistics, expert quotes, framework diagrams, or unique case studies.',
  },
  readability: {
    title: 'Readability Score',
    description: 'Measures how easy the content is to read.',
    whyItMatters: 'Accessible formatting keeps readers engaged and lowers bounce rate.',
    howToImprove: 'Shorten dense paragraphs, use active voice, and organize content with clear subheadings.',
  },
  authority: {
    title: 'Content Authority Score',
    description: 'Measures the credibility and trustworthiness of the content.',
    whyItMatters: 'E-E-A-T signals demonstrate expertise and trustworthy industry knowledge.',
    howToImprove: 'Cite official technical standards, authoritative research, and entity references.',
  },
  entity: {
    title: 'Entity Coverage Score',
    description: 'Measures how well important entities are covered.',
    whyItMatters: 'Knowledge graph entities establish topic completeness in Google\'s Knowledge Vault.',
    howToImprove: 'Incorporate recognized organizations, technologies, products, and core concepts.',
  },
  intent: {
    title: 'Search Intent Match Score',
    description: 'Measures how well the content satisfies user search intent.',
    whyItMatters: 'Fulfilling buyer/informational intent prevents users from returning to SERP.',
    howToImprove: 'Directly answer primary intent questions near the top of the article.',
  },
  keyword: {
    title: 'Keyword Optimization Score',
    description: 'Measures how effectively keywords are optimized throughout the content.',
    whyItMatters: 'Balanced keyword distribution ensures relevance without triggering penalties.',
    howToImprove: 'Naturally place primary & secondary keywords across intro, H2 tags, and body copy.',
  },
  relationship: {
    title: 'Entity Relationship Score',
    description: 'Measures the depth of semantic connections between entities.',
    whyItMatters: 'Connected concepts build topical authority across complex domains.',
    howToImprove: 'Explain how entities relate to one another within industry workflows.',
  },
  diversity: {
    title: 'Semantic Diversity Score',
    description: 'Measures the richness of vocabulary and topical depth.',
    whyItMatters: 'Diverse vocabulary signals comprehensive topic mastery.',
    howToImprove: 'Vary terminology and cover tangential industry sub-domains.',
  },
}

export function getQualityBadge(pct: number): { label: string; icon: string; badgeClass: string; strokeColor: string } {
  if (pct >= 90) {
    return {
      label: 'Excellent',
      icon: '🟢',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
      strokeColor: '#10B981',
    }
  }
  if (pct >= 75) {
    return {
      label: 'Good',
      icon: '🟠',
      badgeClass: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
      strokeColor: '#F97316',
    }
  }
  if (pct >= 60) {
    return {
      label: 'Average',
      icon: '🟡',
      badgeClass: 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20',
      strokeColor: '#EAB308',
    }
  }
  return {
    label: 'Needs Improvement',
    icon: '🔴',
    badgeClass: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
    strokeColor: '#EF4444',
  }
}

export default function ScoreCard({
  score,
  metricKey,
  customTitle,
  customDescription,
  customSubtext,
  color,
  className = '',
}: ScoreCardProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Normalize score to integer [0, 100]
  const pct = Math.max(0, Math.min(100, Math.round(score <= 1.0 && score > 0 ? score * 100 : score)))
  const badge = getQualityBadge(pct)

  const meta = (metricKey && METRIC_METADATA[metricKey]) || {
    title: customTitle || 'Content Metric Score',
    description: customDescription || 'Measures content performance metric.',
    whyItMatters: 'Essential for overall content quality and search engine performance.',
    howToImprove: 'Review analysis insights and follow optimization suggestions.',
  }

  const title = customTitle || meta.title
  const description = customSubtext || customDescription || meta.description

  // SVG Circular Math (80x80 container, radius 32)
  const r = 32
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const strokeColor = color || badge.strokeColor

  // Derived "Why this score?" data from real score value
  const positiveContributor = pct >= 75
    ? 'Strong alignment with high-authority SERP standards and topic coverage.'
    : 'Baseline formatting and entity references are present.'

  const negativeContributor = pct < 90
    ? 'Potential content gaps or unoptimized entity relationships detected compared to Top 3 competitors.'
    : 'Minimal gaps detected.'

  return (
    <div className={`p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--aurora)]/40 transition-all shadow-sm flex flex-col justify-between items-center text-center relative group w-full min-w-0 min-h-[240px] overflow-hidden ${className}`}>
      {/* Top Header: Title & Info Icon */}
      <div className="flex items-start justify-between gap-2 w-full mb-3">
        <h4 className="font-bold text-xs text-[var(--text-primary)] leading-tight text-left min-w-0 flex-1 line-clamp-2">
          {title}
        </h4>
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            className="text-[var(--text-muted)] hover:text-[var(--aurora)] transition-colors p-1 focus:outline-none"
            aria-label={`Information about ${title}`}
          >
            <Info size={14} />
          </button>

          {/* Interactive Tooltip Popover */}
          {showTooltip && (
            <div className="absolute right-0 top-7 z-50 w-64 p-3 bg-[var(--bg-depth)] text-[var(--text-primary)] rounded-xl border border-[var(--border-subtle)] shadow-2xl text-xs space-y-2 pointer-events-none font-sans text-left">
              <p className="font-bold text-[var(--aurora)] text-[11px] uppercase tracking-wider">{title}</p>
              <p className="text-[11px] text-[var(--text-secondary)]"><span className="font-bold">What it measures:</span> {meta.description}</p>
              <p className="text-[11px] text-[var(--text-secondary)]"><span className="font-bold">Why it matters:</span> {meta.whyItMatters}</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400"><span className="font-bold">How to improve:</span> {meta.howToImprove}</p>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Centered Circular Progress Arc */}
      <div className="relative w-20 h-20 my-2 flex-shrink-0 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="5" className="opacity-25" />
          <circle
            cx="40" cy="40" r={r} fill="none" stroke={strokeColor} strokeWidth="5" strokeLinecap="round"
            style={{ strokeDasharray: circ, strokeDashoffset: offset, transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold font-mono text-[var(--text-primary)]">{pct}%</span>
        </div>
      </div>

      {/* Quality Status Badge */}
      <div className="my-2">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono ${badge.badgeClass}`}>
          <span>{badge.icon}</span>
          <span>{badge.label}</span>
        </span>
      </div>

      {/* Short Description */}
      <p className="text-[11px] text-[var(--text-muted)] leading-normal line-clamp-2 text-center w-full mt-1">
        {description}
      </p>

      {/* "Why this score?" Expansion Trigger */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-3 text-[10px] font-mono text-[var(--aurora)] font-bold hover:underline flex items-center gap-1 focus:outline-none"
      >
        {isExpanded ? 'Hide Breakdown ▲' : 'Why this score? ▼'}
      </button>

      {/* Expanded Breakdown Drawer */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] w-full text-left space-y-2 text-[11px] font-sans">
          <p className="font-bold text-[var(--aurora)] uppercase tracking-wider text-[10px]">Why This Score?</p>
          <div className="p-2 bg-[var(--bg-depth)] rounded-lg space-y-1">
            <p className="text-[var(--text-primary)] font-medium"><span className="text-emerald-500 font-bold">+ Positive:</span> {positiveContributor}</p>
            <p className="text-[var(--text-muted)]"><span className="text-amber-500 font-bold">- Gaps:</span> {negativeContributor}</p>
          </div>
          <div className="p-2 bg-[var(--aurora)]/5 border border-[var(--aurora)]/20 rounded-lg">
            <p className="text-[var(--aurora)] font-bold text-[10px] uppercase">Priority Action</p>
            <p className="text-[var(--text-secondary)] text-[11px]">{meta.howToImprove}</p>
          </div>
        </div>
      )}
    </div>
  )
}

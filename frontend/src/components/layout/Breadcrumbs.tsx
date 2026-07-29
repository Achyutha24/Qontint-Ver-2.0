import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Home, Briefcase } from 'lucide-react'
import { useDomain } from '../../context/DomainContext'

const ROUTE_LABELS: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/analyze': 'Analyze',
  '/app/generate': 'AI Content Studio',
  '/app/intelligence': 'Query Intelligence',
  '/app/serp-intel': 'SERP Intelligence',
  '/app/graph': 'Knowledge Graph',
  '/app/reports': 'Executive Reports',
  '/app/workspace': 'Workspace Hub',
  '/app/youtube': 'YouTube Intelligence',
  '/app/keywords': 'Keywords Explorer',
}

export default function Breadcrumbs() {
  const location = useLocation()
  const { activeDomainName } = useDomain()

  const currentPath = location.pathname
  const pageLabel = ROUTE_LABELS[currentPath] || 'Overview'

  // Retrieve last analyzed keyword from localStorage if available
  let activeKeyword: string | null = null
  try {
    const raw = localStorage.getItem('qontint_last_analysis')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.keyword) activeKeyword = parsed.keyword
    }
  } catch (_) {}

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono py-1 overflow-x-auto">
      <Link
        to="/app/dashboard"
        className="flex items-center gap-1 hover:text-[var(--aurora)] transition-colors no-underline text-[var(--text-muted)]"
      >
        <Home size={12} />
      </Link>

      <ChevronRight size={12} className="opacity-40 flex-shrink-0" />

      <Link
        to="/app/workspace"
        className="flex items-center gap-1 hover:text-[var(--aurora)] transition-colors no-underline text-[var(--text-muted)] truncate max-w-[140px]"
      >
        <Briefcase size={12} />
        <span className="truncate">{activeDomainName}</span>
      </Link>

      <ChevronRight size={12} className="opacity-40 flex-shrink-0" />

      <span className="font-semibold text-[var(--text-primary)] whitespace-nowrap">
        {pageLabel}
      </span>

      {activeKeyword && (currentPath.includes('analyze') || currentPath.includes('reports') || currentPath.includes('graph')) && (
        <>
          <ChevronRight size={12} className="opacity-40 flex-shrink-0" />
          <span className="text-[var(--aurora)] truncate max-w-[180px]">
            "{activeKeyword}"
          </span>
        </>
      )}
    </nav>
  )
}

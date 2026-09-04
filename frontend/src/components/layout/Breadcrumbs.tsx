import { useLocation } from 'react-router-dom'

const ROUTE_LABELS: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/analyze': 'Analyze',
  '/app/generate': 'AI Content Studio',
  '/app/intelligence': 'Query Intelligence',
  '/app/serp-intel': 'SERP Intelligence',
  '/app/graph': 'ERP Graph',
  '/app/reports': 'Executive Reports',

  '/app/workspace': 'Workspace Hub',
  '/app/youtube': 'YouTube Intelligence',
  '/app/keywords': 'Keywords Explorer',
  '/app/settings': 'Settings',
  '/app/help': 'Help & Docs',
  '/app/about': 'About Qontint',
}

export default function Breadcrumbs() {
  const location = useLocation()
  const pageLabel = ROUTE_LABELS[location.pathname] || 'Overview'

  // Keep the breadcrumb intentionally minimal. Workspace/domain and keyword
  // context already appear elsewhere on the page and should not be repeated
  // as navigation crumbs.
  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-xs text-[var(--text-muted)] font-mono py-1">
      <span className="font-semibold text-[var(--text-primary)] whitespace-nowrap">{pageLabel}</span>
    </nav>
  )
}

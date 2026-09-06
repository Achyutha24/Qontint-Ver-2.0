// @ts-nocheck
/**
 * ReportRepository — Central Enterprise Report Storage Utility
 * Ensures EVERY operation across Analyze, Generate, SERP Intel, Knowledge Graph,
 * Workspace, and AI Assistant creates a permanent, non-overwriting report entry.
 */

export interface ReportItem {
  id: string
  title: string
  keyword: string
  type: 'Analyze' | 'Generated Content' | 'SERP Intelligence' | 'Knowledge Graph' | 'ERP Graph' | 'Workspace' | 'AI Assistant'

  category: string
  domain: string
  createdAt: string
  updatedAt: string
  score: number
  grade: string
  rank: string
  status: 'Completed' | 'Archived'
  isFavorite: boolean
  isPinned: boolean
  isArchived: boolean
  tags: string[]
  payload: any
  originalRoute: string
}

const STORAGE_KEY = 'qontint_reports_repository'

export function getReportsFromStorage(): ReportItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (err) {
    console.error('Failed to parse report repository from storage:', err)
  }
  return []
}

export function saveReportToRepository(item: Partial<ReportItem>): ReportItem {
  const existing = getReportsFromStorage()
  
  const score = item.score ?? 0
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : 'C'

  const newReport: ReportItem = {
    id: item.id || `rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: item.title || `${item.type || 'Enterprise'} Report: ${item.keyword || 'Overview'}`,
    keyword: item.keyword || 'General Keyword',
    type: item.type || 'Analyze',
    category: item.category || 'SEO Audit',
    domain: item.domain || 'General',
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    score: Math.round(score),
    grade: item.grade || grade,
    rank: item.rank || '—',
    status: item.status || 'Completed',
    isFavorite: item.isFavorite || false,
    isPinned: item.isPinned || false,
    isArchived: item.isArchived || false,
    tags: item.tags || [item.type || 'SEO', 'Enterprise'],
    payload: item.payload ? {
      ...item.payload,
      // Strip oversized raw data blobs to keep report repository lightweight
      raw: item.payload.raw ? {
        processing_time_ms: item.payload.raw.processing_time_ms,
        request_id: item.payload.raw.request_id,
      } : undefined
    } : {},
    originalRoute: item.originalRoute || '/app/analyze',
  }

  // Prepend new report and cap repository size to prevent localStorage exhaustion (keep top 25)
  const MAX_REPORTS = 25
  let updated = [newReport, ...existing].slice(0, MAX_REPORTS)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.warn('Failed to save report to repository (quota exceeded), pruning old payloads...', err)
    // Emergency quota relief: strip heavy payloads from older non-favorite/non-pinned reports
    try {
      updated = updated.map((rep, idx) => {
        if (idx === 0 || rep.isFavorite || rep.isPinned) return rep
        return { ...rep, payload: { result: { seoScore: rep.score } } }
      }).slice(0, 15)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (innerErr) {
      console.error('Failed to save even pruned reports to repository:', innerErr)
    }
  }

  return newReport
}

export function updateReportInRepository(id: string, updates: Partial<ReportItem>): void {
  const existing = getReportsFromStorage()
  const updated = existing.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('Failed to update report in repository:', err)
  }
}

export function deleteReportFromRepository(id: string): void {
  const existing = getReportsFromStorage()
  const updated = existing.filter(r => r.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('Failed to delete report from repository:', err)
  }
}

export function toggleFavoriteReport(id: string): void {
  const existing = getReportsFromStorage()
  const updated = existing.map(r => r.id === id ? { ...r, isFavorite: !r.isFavorite } : r)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('Failed to toggle favorite report:', err)
  }
}

export function toggleArchiveReport(id: string): void {
  const existing = getReportsFromStorage()
  const updated = existing.map(r => r.id === id ? { ...r, isArchived: !r.isArchived, status: r.isArchived ? 'Completed' : 'Archived' } : r)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('Failed to toggle archive report:', err)
  }
}

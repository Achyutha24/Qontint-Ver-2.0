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
  type: 'Analyze' | 'Generated Content' | 'SERP Intelligence' | 'Knowledge Graph' | 'Workspace' | 'AI Assistant'
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
  
  const score = item.score ?? 85
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
    rank: item.rank || '#3',
    status: item.status || 'Completed',
    isFavorite: item.isFavorite || false,
    isPinned: item.isPinned || false,
    isArchived: item.isArchived || false,
    tags: item.tags || [item.type || 'SEO', 'Enterprise'],
    payload: item.payload || {},
    originalRoute: item.originalRoute || '/app/analyze',
  }

  // Prepend new report so newest reports appear first without overwriting prior reports
  const updated = [newReport, ...existing]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('Failed to save report to repository:', err)
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

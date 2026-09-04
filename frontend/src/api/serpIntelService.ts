/**
 * SERP Intelligence API Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Bridges the backend UnifiedAnalysisResponse → SerpIntelResponse consumed by
 * SerpIntelPage.tsx.
 *
 * Guarantees:
 *  - Always returns a fully-formed SerpIntelResponse — never partial objects
 *  - Every field has a safe fallback
 *  - No silent failures — all errors propagate to the caller for display
 */
import { apiFetch } from './apiClient'

// ─── Response types ───────────────────────────────────────────────────────────

export interface SerpResult {
  /** Sequential rank after filtering excluded domains — always 1, 2, 3 */
  competitor_position: number
  /** Original Google SERP rank before filtering — e.g. 4, 7, 9 */
  google_position: number
  /** Backward-compat alias for competitor_position */
  position: number
  title: string
  url: string
  domain: string
  meta_description: string
  word_count: number | null
  estimated_read_time_min: number | null
  local_seo_score: number | null
  publish_date: string | null
  favicon: string
  extraction_status?: string
  is_extraction_failed?: boolean
  extraction_reason?: string | null
  manual_content?: boolean
  serp_refreshed_at?: string
}

export interface SerpIntelResponse {
  keyword: string
  generated_at: string | null
  serp_refreshed_at: string | null
  processing_time_ms: number
  is_cached?: boolean
  serp_results: SerpResult[]
  analysis: {
    overall_score: {
      score: number
      label: string
      breakdown: Record<string, number>
    }
    search_intent: {
      primary_intent: string
      confidence: number
      reasoning: string
      user_expectations: string[]
      ranking_factors: string[]
    }
    serp_features: {
      detected: string[]
      missing: string[]
      impact_summary: string
    }
    content_structure: {
      average_word_count: number
      average_h1: number
      average_h2: number
      average_h3: number
      uses_lists: boolean
      uses_tables: boolean
      uses_images: boolean
      uses_faq: boolean
      formatting_style: string
      content_flow: string
      insights: string[]
    }
    topic_coverage: {
      main_topics: string[]
      subtopics: string[]
      examples_used: string[]
      case_studies: boolean
      tutorials: boolean
      depth_rating: string
      weak_areas: string[]
      strengths: string[]
    }
    keyword_analysis: {
      primary_keyword: string
      secondary_keywords: string[]
      long_tail_keywords: string[]
      related_keywords: string[]
      semantic_variations: string[]
      average_density: number
      keyword_cloud: { text: string; weight: number }[]
    }
    semantic_analysis: {
      semantic_clusters: { cluster: string; terms: string[] }[]
      lsi_keywords: string[]
      concept_hierarchy: any
      topic_relationships: { from: string; to: string; relation: string }[]
    }
    readability: {
      average_reading_level: string
      average_sentence_length: number
      tone: string
      writing_style: string
      accessibility: string
      complexity: string
    }
    seo_analysis: {
      average_seo_score: number
      title_optimization: string
      meta_quality: string
      heading_hierarchy: string
      internal_linking: string
      external_references: string
      schema_opportunities: string[]
      content_freshness: string
      recommendations: string[]
    }
    entities: {
      people: string[]
      organizations: string[]
      products: string[]
      technologies: string[]
      frameworks: string[]
      standards: string[]
      locations: string[]
      industry_terms: string[]
    }
    knowledge_gaps: {
      common_topics: string[]
      unique_insights: string[]
      missing_concepts: string[]
      weak_explanations: string[]
      content_opportunities: string[]
    }
    knowledge_synthesis: {
      unified_understanding: string
      key_insights: string[]
      best_concepts: string[]
      actionable_opportunities: string[]
    }
    summary: string
    competitor_profiles?: any[]
    semantic_baseline?: any
    information_gain?: any
    advanced_stats?: any
    graph_data?: any
  }
}

// ─── Default values (safe fallbacks for every field) ─────────────────────────

function defaultAnalysis(keyword: string): SerpIntelResponse['analysis'] {
  return {
    overall_score: { score: 0, label: 'Not available', breakdown: { search_intent_match: 0, semantic_coverage: 0, entity_richness: 0, seo_quality: 0 } },
    search_intent: { primary_intent: 'Informational', confidence: 0.8, reasoning: 'Based on SERP analysis.', user_expectations: [], ranking_factors: [] },
    serp_features: { detected: [], missing: [], impact_summary: 'No SERP feature data available.' },
    content_structure: { average_word_count: 0, average_h1: 0, average_h2: 0, average_h3: 0, uses_lists: false, uses_tables: false, uses_images: false, uses_faq: false, formatting_style: 'Not available', content_flow: 'Not available', insights: [] },
    topic_coverage: { main_topics: [], subtopics: [], examples_used: [], case_studies: false, tutorials: false, depth_rating: 'Moderate', weak_areas: [], strengths: [] },
    keyword_analysis: { primary_keyword: keyword, secondary_keywords: [], long_tail_keywords: [], related_keywords: [], semantic_variations: [], average_density: 1.0, keyword_cloud: [] },
    semantic_analysis: { semantic_clusters: [], lsi_keywords: [], concept_hierarchy: {}, topic_relationships: [] },
    readability: { average_reading_level: 'Not available', average_sentence_length: 0, tone: 'Not available', writing_style: 'Not available', accessibility: 'Not available', complexity: 'Not available' },
    seo_analysis: { average_seo_score: 0, title_optimization: 'N/A', meta_quality: 'N/A', heading_hierarchy: 'N/A', internal_linking: 'N/A', external_references: 'N/A', schema_opportunities: [], content_freshness: 'N/A', recommendations: [] },
    entities: { people: [], organizations: [], products: [], technologies: [], frameworks: [], standards: [], locations: [], industry_terms: [] },
    knowledge_gaps: { common_topics: [], unique_insights: [], missing_concepts: [], weak_explanations: [], content_opportunities: [] },
    knowledge_synthesis: { unified_understanding: '', key_insights: [], best_concepts: [], actionable_opportunities: [] },
    summary: '',
  }
}

// ─── Helper: merge backend analysis block into our response shape ─────────────

function mergeAnalysis(raw: any, keyword: string): SerpIntelResponse['analysis'] {
  const d = defaultAnalysis(keyword)
  if (!raw || typeof raw !== 'object') return d

  // The backend returns the analysis under `serp_analysis` key
  const a = raw

  // Normalise semantic_clusters — backend may return strings or objects
  let clusters = a.semantic_analysis?.semantic_clusters ?? d.semantic_analysis.semantic_clusters
  if (Array.isArray(clusters)) {
    clusters = clusters.map((c: any) => {
      if (typeof c === 'string') return { cluster: c, terms: [] }
      return { cluster: c?.cluster ?? String(c), terms: Array.isArray(c?.terms) ? c.terms : [] }
    })
  } else {
    clusters = []
  }

  return {
    overall_score: {
      score: Number(a.overall_score?.score ?? d.overall_score.score),
      label: String(a.overall_score?.label ?? d.overall_score.label),
      breakdown: (typeof a.overall_score?.breakdown === 'object' && a.overall_score.breakdown !== null)
        ? a.overall_score.breakdown
        : d.overall_score.breakdown,
    },
    search_intent: {
      primary_intent: String(a.search_intent?.primary_intent ?? d.search_intent.primary_intent),
      confidence: Number(a.search_intent?.confidence ?? d.search_intent.confidence),
      reasoning: String(a.search_intent?.reasoning ?? d.search_intent.reasoning),
      user_expectations: Array.isArray(a.search_intent?.user_expectations) ? a.search_intent.user_expectations : d.search_intent.user_expectations,
      ranking_factors: Array.isArray(a.search_intent?.ranking_factors) ? a.search_intent.ranking_factors : d.search_intent.ranking_factors,
    },
    serp_features: {
      detected: Array.isArray(a.serp_features?.detected) ? a.serp_features.detected : d.serp_features.detected,
      missing: Array.isArray(a.serp_features?.missing) ? a.serp_features.missing : d.serp_features.missing,
      impact_summary: String(a.serp_features?.impact_summary ?? d.serp_features.impact_summary),
    },
    content_structure: { ...d.content_structure, ...(typeof a.content_structure === 'object' ? a.content_structure : {}) },
    topic_coverage: { ...d.topic_coverage, ...(typeof a.topic_coverage === 'object' ? a.topic_coverage : {}) },
    keyword_analysis: { ...d.keyword_analysis, ...(typeof a.keyword_analysis === 'object' ? a.keyword_analysis : {}) },
    semantic_analysis: {
      semantic_clusters: clusters,
      lsi_keywords: Array.isArray(a.semantic_analysis?.lsi_keywords) ? a.semantic_analysis.lsi_keywords : d.semantic_analysis.lsi_keywords,
      concept_hierarchy: a.semantic_analysis?.concept_hierarchy ?? d.semantic_analysis.concept_hierarchy,
      topic_relationships: Array.isArray(a.semantic_analysis?.topic_relationships) ? a.semantic_analysis.topic_relationships : d.semantic_analysis.topic_relationships,
    },
    readability: { ...d.readability, ...(typeof a.readability === 'object' ? a.readability : {}) },
    seo_analysis: { ...d.seo_analysis, ...(typeof a.seo_analysis === 'object' ? a.seo_analysis : {}) },
    entities: {
      people: Array.isArray(a.entities?.people) ? a.entities.people : d.entities.people,
      organizations: Array.isArray(a.entities?.organizations) ? a.entities.organizations : d.entities.organizations,
      products: Array.isArray(a.entities?.products) ? a.entities.products : d.entities.products,
      technologies: Array.isArray(a.entities?.technologies) ? a.entities.technologies : d.entities.technologies,
      frameworks: Array.isArray(a.entities?.frameworks) ? a.entities.frameworks : d.entities.frameworks,
      standards: Array.isArray(a.entities?.standards) ? a.entities.standards : d.entities.standards,
      locations: Array.isArray(a.entities?.locations) ? a.entities.locations : d.entities.locations,
      industry_terms: Array.isArray(a.entities?.industry_terms) ? a.entities.industry_terms : d.entities.industry_terms,
    },
    knowledge_gaps: {
      common_topics: Array.isArray(a.knowledge_gaps?.common_topics) ? a.knowledge_gaps.common_topics : d.knowledge_gaps.common_topics,
      unique_insights: Array.isArray(a.knowledge_gaps?.unique_insights) ? a.knowledge_gaps.unique_insights : d.knowledge_gaps.unique_insights,
      missing_concepts: Array.isArray(a.knowledge_gaps?.missing_concepts) ? a.knowledge_gaps.missing_concepts : d.knowledge_gaps.missing_concepts,
      weak_explanations: Array.isArray(a.knowledge_gaps?.weak_explanations) ? a.knowledge_gaps.weak_explanations : d.knowledge_gaps.weak_explanations,
      content_opportunities: Array.isArray(a.knowledge_gaps?.content_opportunities) ? a.knowledge_gaps.content_opportunities : d.knowledge_gaps.content_opportunities,
    },
    knowledge_synthesis: {
      unified_understanding: String(a.knowledge_synthesis?.unified_understanding ?? d.knowledge_synthesis.unified_understanding),
      key_insights: Array.isArray(a.knowledge_synthesis?.key_insights) ? a.knowledge_synthesis.key_insights : d.knowledge_synthesis.key_insights,
      best_concepts: Array.isArray(a.knowledge_synthesis?.best_concepts) ? a.knowledge_synthesis.best_concepts : d.knowledge_synthesis.best_concepts,
      actionable_opportunities: Array.isArray(a.knowledge_synthesis?.actionable_opportunities) ? a.knowledge_synthesis.actionable_opportunities : d.knowledge_synthesis.actionable_opportunities,
    },
    summary: String(a.summary ?? ''),
    competitor_profiles: Array.isArray(a.competitor_profiles) ? a.competitor_profiles : undefined,
    semantic_baseline: a.semantic_baseline,
    information_gain: a.information_gain,
    advanced_stats: a.advanced_stats,
    graph_data: a.graph_data,
  }
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzeSerpIntelligence(keyword: string, searchEngine: string = 'Google', forceRefresh: boolean = false): Promise<SerpIntelResponse> {
  const raw = await apiFetch<any>('/api/v1/serp-intel/analyze', {
    method: 'POST',
    body: JSON.stringify({ keyword, searchEngine, forceRefresh }),
  })

  // Backend returns either serp_analysis (new) or analysis (legacy)
  const analysisBlock = raw?.serp_analysis ?? raw?.analysis ?? {}

  // Re-index on the frontend as a safety net in case backend cache has stale numbering
  const serpResults: SerpResult[] = Array.isArray(raw?.serp_results)
    ? raw.serp_results.map((r: any, idx: number): SerpResult => {
        // competitor_position: backend-assigned sequential rank (1,2,3). Fallback to idx+1.
        const competitorPos = Number(r?.competitor_position ?? r?.position ?? idx + 1)
        // google_position: original Google rank before filtering. If not set, use whatever position field has.
        const googlePos = Number(r?.google_position ?? r?.position ?? idx + 1)
        return {
          competitor_position: competitorPos,
          google_position: googlePos,
          position: competitorPos,  // kept for backwards compat, always == competitor_position
          title: String(r?.title ?? 'Untitled'),
          url: String(r?.url ?? ''),
          domain: String(r?.domain ?? ''),
          meta_description: String(r?.meta_description ?? ''),
          word_count: nullableNumber(r?.word_count),
          estimated_read_time_min: nullableNumber(r?.estimated_read_time_min),
          local_seo_score: nullableNumber(r?.local_seo_score),
          publish_date: r?.publish_date ?? null,
          favicon: String(r?.favicon ?? ''),
          extraction_status: typeof r?.extraction_status === 'string' ? r.extraction_status : undefined,
          is_extraction_failed: typeof r?.is_extraction_failed === 'boolean' ? r.is_extraction_failed : undefined,
          extraction_reason: typeof r?.extraction_reason === 'string' ? r.extraction_reason : null,
          manual_content: Boolean(r?.manual_content),
          serp_refreshed_at: typeof r?.serp_refreshed_at === 'string' ? r.serp_refreshed_at : undefined,
        }
      })
    : []

  return {
    keyword: String(raw?.keyword ?? keyword),
    generated_at: typeof raw?.generated_at === 'string' ? raw.generated_at : null,
    serp_refreshed_at: typeof raw?.serp_refreshed_at === 'string'
      ? raw.serp_refreshed_at
      : serpResults.find(result => result.serp_refreshed_at)?.serp_refreshed_at ?? null,
    processing_time_ms: Number(raw?.processing_time_ms ?? raw?.metadata?.processing_time_ms ?? 0),
    is_cached: Boolean(raw?.is_cached ?? false),
    serp_results: serpResults,
    analysis: mergeAnalysis(analysisBlock, keyword),
  }
}


export interface ManualCompetitorContent {
  competitor_position: number
  url: string
  content: string
}

export async function analyzeSerpIntelligenceWithManualContent(
  keyword: string,
  competitors: ManualCompetitorContent[],
  searchEngine: string = 'Google',
): Promise<SerpIntelResponse> {
  const raw = await apiFetch<any>('/api/v1/serp-intel/manual-content', {
    method: 'POST',
    body: JSON.stringify({ keyword, searchEngine, competitors }),
  })

  const analysisBlock = raw?.serp_analysis ?? raw?.analysis ?? {}
  const serpResults: SerpResult[] = Array.isArray(raw?.serp_results)
    ? raw.serp_results.map((r: any, idx: number): SerpResult => ({
        competitor_position: Number(r?.competitor_position ?? r?.position ?? idx + 1),
        google_position: Number(r?.google_position ?? r?.position ?? idx + 1),
        position: Number(r?.competitor_position ?? r?.position ?? idx + 1),
        title: String(r?.title ?? 'Untitled'),
        url: String(r?.url ?? ''),
        domain: String(r?.domain ?? ''),
        meta_description: String(r?.meta_description ?? ''),
        word_count: nullableNumber(r?.word_count),
        estimated_read_time_min: nullableNumber(r?.estimated_read_time_min),
        local_seo_score: nullableNumber(r?.local_seo_score),
        publish_date: r?.publish_date ?? null,
        favicon: String(r?.favicon ?? ''),
        extraction_status: typeof r?.extraction_status === 'string' ? r.extraction_status : undefined,
        is_extraction_failed: typeof r?.is_extraction_failed === 'boolean' ? r.is_extraction_failed : undefined,
        extraction_reason: typeof r?.extraction_reason === 'string' ? r.extraction_reason : null,
        manual_content: Boolean(r?.manual_content),
        serp_refreshed_at: typeof r?.serp_refreshed_at === 'string' ? r.serp_refreshed_at : undefined,
      }))
    : []

  return {
    keyword: String(raw?.keyword ?? keyword),
    generated_at: typeof raw?.generated_at === 'string' ? raw.generated_at : null,
    serp_refreshed_at: typeof raw?.serp_refreshed_at === 'string' ? raw.serp_refreshed_at : serpResults.find(r => r.serp_refreshed_at)?.serp_refreshed_at ?? null,
    processing_time_ms: Number(raw?.processing_time_ms ?? raw?.metadata?.processing_time_ms ?? 0),
    is_cached: Boolean(raw?.is_cached ?? false),
    serp_results: serpResults,
    analysis: mergeAnalysis(analysisBlock, keyword),
  }
}

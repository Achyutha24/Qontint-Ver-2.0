export interface FeatureFlags {
  // Production Features (Active by default)
  competitorAnalysis: boolean
  serpOverview: boolean
  semanticTopicClusters: boolean
  executiveSummary: boolean
  recommendations: boolean
  benchmarkMatrix: boolean
  serpTimeline: boolean
  competitorCards: boolean

  // Beta Features (Hidden by default in UI)
  knowledgeGaps: boolean
  informationGain: boolean

  // Experimental Features (Hidden by default in UI)
  noveltyScore: boolean
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  competitorAnalysis: true,
  serpOverview: true,
  semanticTopicClusters: true,
  executiveSummary: true,
  recommendations: true,
  benchmarkMatrix: true,
  serpTimeline: true,
  competitorCards: true,

  // Beta & Experimental hidden by default in production UI
  knowledgeGaps: false,
  informationGain: false,
  noveltyScore: false,
}

export const DEV_FEATURE_FLAGS: FeatureFlags = {
  competitorAnalysis: true,
  serpOverview: true,
  semanticTopicClusters: true,
  executiveSummary: true,
  recommendations: true,
  benchmarkMatrix: true,
  serpTimeline: true,
  competitorCards: true,

  // Enabled in Dev Mode
  knowledgeGaps: true,
  informationGain: true,
  noveltyScore: true,
}

export const FeatureFlags = DEFAULT_FEATURE_FLAGS

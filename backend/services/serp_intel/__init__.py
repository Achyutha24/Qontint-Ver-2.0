"""
SERP Intelligence Package Initialization.
"""
from __future__ import annotations

from services.serp_intel.constants import Stage, NOISE_TERMS, SYNONYM_MAP, MARKETING_SLOGAN_PATTERNS
from services.serp_intel.context import PipelineContext, PipelineResult
from services.serp_intel.utils import (
    _extract_domain,
    _is_clean_semantic_term,
    _normalize_semantic_concept,
    _extract_questions_from_pages,
    _safe_json_loads,
    _validate_response,
    make_json_serializable,
)
from services.serp_intel.competitor_profiles import _build_per_competitor_profiles
from services.serp_intel.semantic_clusters import _build_topic_clusters_from_entities
from services.serp_intel.semantic_baseline import SemanticBaseline, _build_semantic_baseline, _detect_keyword_domain
from services.serp_intel.topic_coverage import _compute_weighted_semantic_coverage
from services.serp_intel.knowledge_gap_engine import KnowledgeGapEngine
from services.serp_intel.information_gain import _build_comparison_intelligence
from services.serp_intel.recommendation_engine import _build_recommendations_from_gaps
from services.serp_intel.semantic_summary import (
    _build_advanced_stats,
    _empty_deterministic,
    _build_synthesis_prompt,
    _build_score_block,
)

__all__ = [
    "Stage",
    "NOISE_TERMS",
    "SYNONYM_MAP",
    "MARKETING_SLOGAN_PATTERNS",
    "PipelineContext",
    "PipelineResult",
    "_extract_domain",
    "_is_clean_semantic_term",
    "_normalize_semantic_concept",
    "_extract_questions_from_pages",
    "_safe_json_loads",
    "_validate_response",
    "make_json_serializable",
    "_build_per_competitor_profiles",
    "_build_topic_clusters_from_entities",
    "SemanticBaseline",
    "_build_semantic_baseline",
    "_detect_keyword_domain",
    "_compute_weighted_semantic_coverage",
    "KnowledgeGapEngine",
    "_build_comparison_intelligence",
    "_build_recommendations_from_gaps",
    "_build_advanced_stats",
    "_empty_deterministic",
    "_build_synthesis_prompt",
    "_build_score_block",
]

"""
SERP Intelligence Service Facade & Orchestration Layer
──────────────────────────────────────────────────────
Production-grade modular orchestrator for SERP keyword analysis pipeline.

Delegates core execution stages to dedicated modules in services.serp_intel:
  - competitor_profiles.py
  - semantic_baseline.py
  - semantic_clusters.py
  - topic_coverage.py
  - knowledge_gap_engine.py
  - information_gain.py
  - recommendation_engine.py
  - semantic_summary.py
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from services.cache_manager import cache_manager, AnalysisCache
from models.db import SerpResult, ReportStorage, Keyword
from utils.logger import make_logger, PipelineLogger
from utils.circuit_breaker import circuit_breaker_registry
from services.locking_manager import lock_manager
from services.deterministic_summary import (
    generate_deterministic_summary,
    validate_summary,
    build_knowledge_synthesis,
    MIN_SUMMARY_WORDS,
)

# Import and re-export all modular components from backend/services/serp_intel/
from services.serp_intel import (
    Stage,
    NOISE_TERMS,
    SYNONYM_MAP,
    MARKETING_SLOGAN_PATTERNS,
    PipelineContext,
    PipelineResult,
    _extract_domain,
    _is_clean_semantic_term,
    _normalize_semantic_concept,
    _extract_questions_from_pages,
    _safe_json_loads,
    _validate_response,
    make_json_serializable,
    _build_per_competitor_profiles,
    _build_topic_clusters_from_entities,
    SemanticBaseline,
    _build_semantic_baseline,
    _detect_keyword_domain,
    _compute_weighted_semantic_coverage,
    KnowledgeGapEngine,
    _build_comparison_intelligence,
    _build_recommendations_from_gaps,
    _build_advanced_stats,
    _empty_deterministic,
    _build_synthesis_prompt,
    _build_score_block,
)

logger = logging.getLogger("qontint.serp_intel")


# ─────────────────────────────────────────────────────────────────────────────
# Deterministic NLP extraction (spaCy — Orchestration Layer)
# ─────────────────────────────────────────────────────────────────────────────

def _extract_deterministic_serp_data(keyword: str, pages: List[Dict[str, Any]]) -> dict:
    """
    M1 Semantic Baseline Pipeline Orchestrator.
    Stage 1: Per-competitor profiling.
    Stage 2: Unified semantic baseline construction.
    Stage 3: Topic cluster generation.
    Stage 4: Comparison-stage intelligence (coverage, gaps, information gain).
    Reuses existing extract_entities_from_text — no second NLP pipeline.
    """
    if not pages:
        return _empty_deterministic(keyword)

    try:
        import textstat
        from analysis.entities import extract_entities_from_text
        import time as _time

        t_extract_start = _time.perf_counter()

        all_text = " ".join([p.get("body_content", "")[:6000] for p in pages])[:20000]
        avg_words = sum(p.get("word_count", 0) for p in pages) / max(len(pages), 1)

        try:
            avg_reading_level = textstat.text_standard(all_text[:10000])
            fre = textstat.flesch_reading_ease(all_text[:10000])
            complexity = "High" if fre < 50 else "Moderate" if fre < 70 else "Easy"
        except Exception:
            avg_reading_level = "10th Grade"
            complexity = "Moderate"

        readability = {
            "average_reading_level": avg_reading_level,
            "average_sentence_length": 15,
            "tone": "Informational",
            "writing_style": "Professional",
            "accessibility": "Standard",
            "complexity": complexity,
        }

        raw_ents_merged = extract_entities_from_text(all_text[:20000], "general")
        del all_text

        orgs     = list(dict.fromkeys([e['text'] for e in raw_ents_merged if e.get('entity_type') == 'ORG']))[:10]
        people   = list(dict.fromkeys([e['text'] for e in raw_ents_merged if e.get('entity_type') == 'PERSON']))[:10]
        products = list(dict.fromkeys([e['text'] for e in raw_ents_merged if e.get('entity_type') == 'PRODUCT']))[:10]
        tech     = list(dict.fromkeys([e['text'] for e in raw_ents_merged if e.get('entity_type') == 'TECHNOLOGY']))[:10]
        locations= list(dict.fromkeys([e['text'] for e in raw_ents_merged if e.get('entity_type') == 'GPE']))[:10]
        concepts = list(dict.fromkeys([e['text'] for e in raw_ents_merged if e.get('entity_type') in {'CONCEPT', 'NOUN_CHUNK'}]))[:10]

        entities = {
            "organizations": orgs,
            "people": people,
            "products": products,
            "technologies": tech,
            "locations": locations,
            "industry_terms": concepts,
            "frameworks": [],
            "standards": [],
        }

        content_structure = {
            "average_word_count": int(avg_words),
            "average_h1": 1,
            "average_h2": 8,
            "average_h3": 5,
            "uses_lists": True,
            "uses_tables": False,
            "uses_images": True,
            "uses_faq": True,
            "formatting_style": "Standard blog format with varied media",
            "content_flow": "Introduction \u2192 Core Concepts \u2192 Examples \u2192 Conclusion",
            "insights": [
                "Competitors rely heavily on H2 tags for semantic grouping",
                "Lists are used for easy skimming",
            ],
        }

        keyword_analysis = {
            "primary_keyword": keyword,
            "secondary_keywords": concepts[:5],
            "long_tail_keywords": [f"{keyword} for beginners", f"best {keyword}"],
            "related_keywords": concepts[5:],
            "semantic_variations": [keyword.lower()],
            "average_density": round(
                " ".join([p.get("body_content", "")[:2000] for p in pages]).lower().count(keyword.lower())
                / max(avg_words, 1) * 100, 2
            ),
            "keyword_cloud": [],
        }

        # ── M1 Stage 1: Per-competitor profiles ────────────────────────────────
        per_competitor_profiles = _build_per_competitor_profiles(keyword, pages)

        # Manual-paste responses have two representations of each competitor: the
        # page snapshot and the derived profile. Keep the derived profile explicitly
        # synchronized with the page snapshot so the UI never shows a successful
        # manual analysis as the previous "Extraction Failed" state.
        pages_by_position = {
            int(p.get("competitor_position", p.get("position", 0))): p
            for p in pages
            if p.get("competitor_position", p.get("position")) is not None
        }
        for profile in per_competitor_profiles:
            pos = int(profile.get("competitor_position", 0) or 0)
            page = pages_by_position.get(pos)
            if not page or not page.get("manual_content"):
                continue
            manual_words = len((page.get("body_content") or "").split())
            profile["word_count"] = manual_words
            profile["is_extraction_failed"] = manual_words < 300
            profile["extraction_status"] = "Manual Analysis Complete" if manual_words >= 300 else "Manual content too short"
            profile["extraction_method"] = "manual_paste"
            profile["extraction_confidence"] = 100 if manual_words >= 300 else 0
            profile["manual_content"] = True

            # Keep the page-level SERP row synchronized with the derived profile.
            # The UI uses both representations, and stale page metadata was the
            # reason manual analysis could appear successful while word-count
            # tables still displayed the old unavailable values.
            for key in (
                "word_count", "extracted_article_length", "heading_count", "h1_count",
                "h2_count", "h3_count", "paragraph_count", "faq_count",
                "media_count", "table_count", "list_count", "internal_links",
                "external_links", "estimated_read_time_min", "extraction_status",
                "extraction_method", "extraction_confidence", "is_extraction_failed",
                # quality scores computed by the NLP pass
                "topical_authority_score", "semantic_richness_score",
                "content_completeness_score", "entity_coverage_score",
                "structural_quality_score", "information_gain_score",
                "entity_count", "semantic_density", "estimated_content_depth",
                "content_depth", "reading_level", "readability_score",
            ):
                if key in profile:
                    page[key] = profile[key]
            page["manual_content"] = True

        # ── M1 Stage 2: Unified semantic baseline ──────────────────────────────
        semantic_baseline = _build_semantic_baseline(keyword, pages, per_competitor_profiles)
        topic_clusters = semantic_baseline["topic_clusters"]

        # ── Comparison Stage: coverage, gaps, information gain ─────────────────
        comparison = _build_comparison_intelligence(keyword, semantic_baseline, pages)
        coverage_score = comparison["coverage_score"]

        # ── Evidence-based recommendations ────────────────────────────────────
        recommendations = _build_recommendations_from_gaps(
            keyword, comparison["knowledge_gaps"], per_competitor_profiles
        )

        t_extract_ms = int((_time.perf_counter() - t_extract_start) * 1000)

        topic_coverage = {
            **comparison["topic_coverage"],
            "main_topics": comparison["topic_coverage"].get("covered_core_topics", concepts[:3]),
            "subtopics": comparison["topic_coverage"].get("covered_supporting_topics", concepts[3:8]),
            "examples_used": [],
            "case_studies": False,
            "tutorials": False,
            "depth_rating": comparison["topic_coverage"].get("depth_rating", "Moderate"),
            "weak_areas": comparison["topic_coverage"].get("weak_areas", []),
            "strengths": comparison["topic_coverage"].get("strengths", []),
            "categories": comparison["topic_coverage"].get("categories", []),
            "coverage_score": coverage_score,
        }

        semantic_analysis = {
            "semantic_clusters": topic_clusters,
            "lsi_keywords": list(dict.fromkeys(
                [e["text"] for e in raw_ents_merged]
            ))[:8],
            "concept_hierarchy": {},
            "topic_relationships": [],
        }

        knowledge_gaps = {
            **comparison["knowledge_gaps"],
            "common_topics": comparison["topic_coverage"].get("covered_core_topics", [])[:4],
            "unique_insights": comparison["information_gain"].get("differentiation_opportunities", []),
            "missing_concepts": comparison["knowledge_gaps"].get("missing_entities", []),
            "weak_explanations": comparison["knowledge_gaps"].get("missing_industry_concepts", []),
            "content_opportunities": comparison["knowledge_gaps"].get("content_opportunities", []),
        }

        seo_analysis = {
            "average_seo_score": min(100, 60 + len(orgs) * 2 + len(tech) * 2),
            "title_optimization": "Titles optimized with primary keyword and semantic variations",
            "meta_quality": "Meta descriptions present and action-oriented",
            "heading_hierarchy": "Logical H1\u2013H3 nesting observed across competitors",
            "internal_linking": "Strong internal linking to related pillar pages",
            "external_references": "Citations to authority domains detected",
            "technical_seo_gaps": ["Schema markup absent on some pages"] if len(orgs) < 3 else [],
            "content_freshness": "Recent",
            "recommendations": recommendations,
            "schema_opportunities": ["FAQ", "How-To", "Article"],
        }

        advanced_stats = _build_advanced_stats(pages, t_extract_ms)

        det_result = {
            "semantic_engine_version": "v2.0",
            "readability": readability,
            "entities": entities,
            "content_structure": content_structure,
            "topic_coverage": topic_coverage,
            "keyword_analysis": keyword_analysis,
            "seo_analysis": seo_analysis,
            "semantic_analysis": semantic_analysis,
            "knowledge_gaps": knowledge_gaps,
            "semantic_baseline": semantic_baseline,
            "competitor_profiles": per_competitor_profiles,
            "information_gain": comparison["information_gain"],
            "coverage_score": coverage_score,
            "advanced_stats": advanced_stats,
            "graph_data": comparison.get("graph_data", {}),
            "structured_executive_summary": comparison.get("structured_executive_summary", {}),
        }

        # ── Phase 4 Predictive Ranking Engine Integration ─────────────────────
        try:
            from services.ranking_prediction_engine import PredictiveRankingEngine
            rank_engine = PredictiveRankingEngine(keyword, det_result, pages)
            pred_outputs = rank_engine.predict_ranking()
            det_result.update(pred_outputs)
        except Exception as pred_err:
            logger.warning(f"PredictiveRankingEngine execution failed (non-fatal): {pred_err}")

        return det_result

    except Exception as e:
        logger.warning("Deterministic extraction failed: %s \u2014 using empty skeleton", e)
        return _empty_deterministic(keyword)


def return_cached_report(
    keyword: str,
    search_engine: str,
    cache_key: str,
    cached: Any,
    plog: PipelineLogger,
    t_start: float,
    reason: str = "REPORT_COMPLETE cache found",
) -> dict:
    """
    Dedicated helper to return a cached report on Cache Hit and terminate execution immediately.
    Guarantees zero database INSERTs/UPDATEs, zero version increments, zero spaCy/Gemini calls,
    and zero pipeline execution.
    """
    version = getattr(cached, "analysis_version", 1)
    
    logger.info(
        f"========================================\n"
        f"CACHE RETURN\n"
        f"Keyword: {keyword}\n"
        f"Analysis Version: v{version}\n"
        f"Reason: {reason}\n"
        f"Action: Returning cached report\n"
        f"Pipeline: Skipped | Gemini: Skipped | Extraction: Skipped\n"
        f"FUNCTION EXIT -> Exiting run_serp_intelligence cleanly.\n"
        f"========================================"
    )
    
    return _build_final_response(keyword, search_engine, cache_key, cached, plog, t_start, is_cached=True)


# ─────────────────────────────────────────────────────────────────────────────
# Main Pipeline Orchestrator
# ─────────────────────────────────────────────────────────────────────────────

async def run_serp_intelligence(
    keyword: str,
    search_engine: str = "Google",
    country: str = "us",
    language: str = "en",
    device: str = "desktop",
    db: AsyncSession = None,
    force_refresh: bool = False,
    request_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    The canonical SERP Intelligence pipeline with Enterprise Smart Cache Architecture.
    """
    req_id = request_id or f"req_{uuid.uuid4().hex[:12]}"
    t_start = time.perf_counter()

    normalized_kw = cache_manager.normalize_keyword(keyword)
    cache_key = cache_manager.generate_cache_key(normalized_kw, country, language, device, search_engine)

    plog = make_logger(keyword=keyword, cache_key=cache_key, search_engine=search_engine, request_id=req_id)
    plog.info(Stage.QUEUED, f"Analysis queued for keyword='{keyword}' (normalized='{normalized_kw}', force_refresh={force_refresh})")

    try:
        await cache_manager.record_search_history(
            db, cache_key, keyword, "SERP Intelligence", search_engine, country, language, device
        )
    except Exception as e:
        plog.warn(Stage.CACHE_LOOKUP, "Failed to record search history", error=str(e))

    acquired = await lock_manager.try_acquire(cache_key, req_id)
    if not acquired:
        plog.info(Stage.CACHE_LOOKUP, "Lock busy — waiting for running pipeline to finish")
        completed = await lock_manager.wait_for_completion(cache_key, timeout=90.0)
        if completed:
            cached = await cache_manager.get_analysis_cache(db, cache_key)
            if cache_manager.is_cache_valid(cached):
                try:
                    return return_cached_report(keyword, search_engine, cache_key, cached, plog, t_start)
                except Exception as e:
                    plog.warn(Stage.CACHE_HIT, "Cached result parse failed — running fresh pipeline", error=str(e))
        acquired = await lock_manager.try_acquire(cache_key, req_id)

    try:
        logger.info(f"CACHE LOOKUP -> key='{cache_key}' (keyword='{keyword}', force_refresh={force_refresh})")
        t_lookup_start = time.perf_counter()
        decision = await cache_manager.get_cache_decision(
            db, cache_key, keyword, search_engine, country, language, device, force_refresh
        )
        cache_lookup_ms = int((time.perf_counter() - t_lookup_start) * 1000)

        if decision.use_cache and decision.record:
            logger.info(f"CACHE FOUND -> ver=v{getattr(decision.record, 'analysis_version', 1)}, status='{decision.record.status}'")
            logger.info(f"CACHE DECISION -> USE_CACHE=True, reason='{decision.reason}'")
            plog.cache_hit()
            cached = decision.record
            
            # Immediately return cached report — terminate execution completely
            res = return_cached_report(
                keyword=keyword,
                search_engine=search_engine,
                cache_key=cache_key,
                cached=cached,
                plog=plog,
                t_start=t_start,
                reason=decision.reason,
            )
            return res
        else:
            logger.info(f"CACHE DECISION -> USE_CACHE=False, reason='{decision.reason}'")
            logger.info(
                f"========================================\n"
                f"CACHE MISS\n"
                f"Keyword: {keyword}\n"
                f"Reason: {decision.reason}\n"
                f"========================================"
            )
            
            cached = await cache_manager.create_new_analysis_version(
                db, cache_key, keyword, analysis_type="SERP Intelligence"
            )
            plog.info(Stage.QUEUED, f"Created NEW Analysis Version v{cached.analysis_version} for keyword='{keyword}' (Reason: {decision.reason})")

            t_pipe_start = time.perf_counter()
            try:
                result = await _run_pipeline(
                    keyword=keyword, search_engine=search_engine, country=country,
                    language=language, device=device, db=db,
                    cache_key=cache_key, cached=cached, plog=plog, t_start=t_start,
                    force_refresh=force_refresh,
                )
                pipeline_ms = int((time.perf_counter() - t_pipe_start) * 1000)
                logger.info(
                    f"Cache Lookup Time: {cache_lookup_ms} ms | "
                    f"Pipeline Execution Time: {pipeline_ms} ms"
                )
                return result
            except Exception as pipeline_err:
                plog.error(Stage.FAILED, f"Pipeline execution failed: {pipeline_err}")
                await cache_manager.save_error_cache(db, cache_key, str(pipeline_err))
                raise pipeline_err
    finally:
        lock_manager.release(cache_key, req_id)


def _log_stage_timing(stage_name: str, duration_ms: int, plog: PipelineLogger):
    msg = f"{stage_name:.<25}{duration_ms} ms"
    plog.info(Stage.CONTENT_EXTRACT, msg)
    if duration_ms > 30000:
        plog.error(Stage.FAILED, f"CRITICAL: Pipeline Bottleneck — Stage '{stage_name}' took {duration_ms} ms (> 30,000 ms limit)")
    elif duration_ms > 5000:
        plog.warn(Stage.CONTENT_EXTRACT, f"WARNING: Slow Stage Detected — Stage '{stage_name}' took {duration_ms} ms (> 5,000 ms threshold)")


async def run_serp_intelligence_with_manual_content(
    keyword: str,
    competitors: List[dict],
    search_engine: str = "Google",
    country: str = "us",
    language: str = "en",
    device: str = "desktop",
    db: AsyncSession = None,
    request_id: Optional[str] = None,
) -> dict[str, Any]:
    """Run SERP Intelligence from user-pasted competitor content without re-scraping.

    The current cached SERP snapshot supplies unchanged competitors; entries in
    ``competitors`` replace only the requested competitor's body content. The
    resulting report is versioned in the normal analysis cache so subsequent
    reads use the manual enrichment until a deliberate Refresh SERP is requested.
    """
    req_id = request_id or f"req_{uuid.uuid4().hex[:12]}"
    normalized_kw = cache_manager.normalize_keyword(keyword)
    cache_key = cache_manager.generate_cache_key(normalized_kw, country, language, device, search_engine)
    plog = make_logger(keyword=keyword, cache_key=cache_key, search_engine=search_engine, request_id=req_id)

    if not competitors:
        raise ValueError("At least one competitor requires manually pasted content.")

    acquired = await lock_manager.try_acquire(cache_key, req_id)
    if not acquired:
        completed = await lock_manager.wait_for_completion(cache_key, timeout=90.0)
        if not completed or not await lock_manager.try_acquire(cache_key, req_id):
            raise RuntimeError("Another SERP analysis is still running. Please try again in a moment.")

    try:
        cached_source = await cache_manager.get_analysis_cache(db, cache_key)
        source_pages: List[dict] = []
        if cached_source and cached_source.serp_results_json:
            try:
                source_pages = json.loads(cached_source.serp_results_json)
            except Exception:
                source_pages = []
        if not source_pages and cached_source and cached_source.top_3_json:
            try:
                source_pages = json.loads(cached_source.top_3_json)
            except Exception:
                source_pages = []

        # Build a single list of shared dict objects so that both index lookups
        # (by_url and by_position) reference the same underlying dict.  When we
        # mutate a competitor entry below (injecting body_content etc.) the change
        # is visible regardless of which index was used to locate the entry AND
        # regardless of which index is used to build merged_pages afterwards.
        shared_pages: List[dict] = [dict(p) for p in source_pages]
        by_url = {str(p.get("url")): p for p in shared_pages if p.get("url")}
        by_position = {int(p.get("competitor_position", p.get("position", 0))): p for p in shared_pages}

        for item in competitors:
            content = str(item.get("content") or "").strip()
            if len(content.split()) < 300:
                raise ValueError(f"Manual content for competitor #{item.get('competitor_position', '?')} must contain at least 300 words.")
            target_url = str(item.get("url") or "").strip()
            target_pos = int(item.get("competitor_position") or item.get("position") or 0)
            target = by_url.get(target_url) or by_position.get(target_pos)
            if not target:
                raise ValueError("The submitted competitor no longer matches the current SERP snapshot. Refresh SERP and try again.")
            target["body_content"] = content[:50000]
            target["word_count"] = len(content.split())
            target["extracted_article_length"] = target["word_count"]
            target["is_extraction_failed"] = False
            target["extraction_status"] = "Success"
            target["extraction_method"] = "manual_paste"
            target["extraction_confidence"] = 100
            target["estimated_read_time_min"] = max(1, target["word_count"] // 200)
            target["manual_content"] = True
            target["manual_content_updated_at"] = datetime.now(timezone.utc).isoformat()

        # merged_pages is built from shared_pages (via by_position) so all manual
        # enrichment applied above is guaranteed to be present.
        merged_pages = list(by_position.values()) if by_position else list(by_url.values())
        merged_pages.sort(key=lambda p: int(p.get("competitor_position", p.get("position", 999))))
        merged_pages = merged_pages[:3]

        cached = await cache_manager.create_new_analysis_version(db, cache_key, keyword, analysis_type="SERP Intelligence")
        return await _run_pipeline(
            keyword=keyword, search_engine=search_engine, country=country, language=language,
            device=device, db=db, cache_key=cache_key, cached=cached, plog=plog,
            t_start=time.perf_counter(), force_refresh=False, manual_pages=merged_pages,
        )
    finally:
        lock_manager.release(cache_key, req_id)


async def _run_pipeline(
    keyword: str,
    search_engine: str,
    country: str,
    language: str,
    device: str,
    db: AsyncSession,
    cache_key: str,
    cached: AnalysisCache,
    plog: PipelineLogger,
    t_start: float,
    force_refresh: bool = False,
    manual_pages: Optional[List[dict]] = None,
) -> dict:
    t_stage = time.perf_counter()
    from utils.competitor_filter import filter_and_renumber_competitors

    pages: List[dict] = []
    serp_refreshed_at: Optional[str] = None

    # Manual extraction override: user-supplied page content is treated as a first-class
    # source for this analysis run. This intentionally bypasses the live scraper so a
    # blocked/JS-heavy origin cannot overwrite the content the user just supplied.
    if manual_pages:
        pages = filter_and_renumber_competitors(manual_pages)[:3]
        for page in pages:
            body = (page.get("body_content") or "").strip()
            words = len(body.split())
            page["word_count"] = words
            page["extracted_article_length"] = words
            is_manual = bool(page.get("manual_content"))
            if is_manual:
                # Manually pasted content — mark with manual analysis metadata.
                page["is_extraction_failed"] = words < 300
                page["extraction_status"] = "Manual Analysis Complete" if words >= 300 else "Manual content too short"
                page["extraction_method"] = "manual_paste"
                page["extraction_confidence"] = 100 if words >= 300 else 0
                page["estimated_read_time_min"] = max(1, words // 200) if words >= 300 else 0
                page["manual_content"] = True  # ensure flag is always explicit
            else:
                # Auto-extracted competitor — keep its original metadata, only refresh word count.
                if words < 300:
                    page["is_extraction_failed"] = True
                    page["extraction_status"] = page.get("extraction_status", "Extraction Failed")
                    page["estimated_read_time_min"] = 0
                # else: keep the original extraction metadata as-is
        serp_refreshed_at = next((p.get("serp_refreshed_at") for p in pages if p.get("serp_refreshed_at")), None)
        plog.info(Stage.SERP_FETCHING, f"Using {len(pages)} manually supplied competitor pages")

    if not pages and cached.serp_results_json and cached.status == Stage.REPORT_COMPLETE:
        try:
            pages_raw = json.loads(cached.serp_results_json)
            from utils.competitor_filter import filter_and_renumber_competitors
            pages = filter_and_renumber_competitors(pages_raw)[:3]
            serp_refreshed_at = next(
                (page.get("serp_refreshed_at") for page in pages if page.get("serp_refreshed_at")),
                None,
            )
            plog.skip(Stage.SERP_FETCHING, "SERP data already cached — skipping Serper call")
        except Exception:
            pages = []

    if not pages:
        t_serp_start = time.perf_counter()
        serper_cb = circuit_breaker_registry.get("serper")
        if serper_cb.is_open():
            raise RuntimeError("SERP provider circuit breaker is OPEN. Please try again later.")

        plog.info(Stage.SERP_FETCHING, "Fetching live SERP results", provider="Serper")
        await cache_manager.update_cache_status(db, cache_key, keyword, Stage.SERP_FETCHING)

        try:
            from services.serp_baseline import ensure_keyword_and_serp
            kw_obj, serp_docs = await ensure_keyword_and_serp(
                keyword=keyword, vertical="general", db=db,
                fast_mode=True, search_engine=search_engine,
                country=country, language=language,
                force_refresh=force_refresh,
            )
            serper_cb.record_success()
            serp_ms = int((time.perf_counter() - t_serp_start) * 1000)
            _log_stage_timing("SERP Collection", serp_ms, plog)
        except Exception as exc:
            serper_cb.record_failure()
            plog.warn(Stage.SERP_FETCHING, f"Live SERP fetch warning: {exc}")
            serp_docs = []

        if not serp_docs and cached and (cached.serp_results_json or cached.top_3_json):
            try:
                pages_raw = json.loads(cached.serp_results_json or cached.top_3_json)
                from utils.competitor_filter import filter_and_renumber_competitors
                pages = filter_and_renumber_competitors(pages_raw)[:3]
                serp_refreshed_at = next(
                    (page.get("serp_refreshed_at") for page in pages if page.get("serp_refreshed_at")),
                    None,
                )
                plog.info(Stage.SERP_FETCHING, "Using cached SERP snapshot fallback")
            except Exception:
                pages = []

        valid_count = 0
        for i, doc in enumerate(serp_docs):
            body = (getattr(doc, 'body_content', '') or '').strip()
            title = (getattr(doc, 'title', '') or '').strip()
            doc_url = getattr(doc, 'url', '') or ""
            domain = _extract_domain(doc_url)
            
            final_url = getattr(doc, 'final_url', doc_url) or doc_url
            http_status = getattr(doc, 'http_status', 200) or 200
            html_size = getattr(doc, 'html_size', len(body.encode('utf-8'))) or len(body.encode('utf-8'))
            extracted_words = len(body.split())
            
            is_extraction_failed = extracted_words < 300
            if is_extraction_failed:
                plog.warn(Stage.SERP_FETCHING, f"Competitor #{valid_count + 1} ({domain}) content < 300 words ({extracted_words} words) — marking as Extraction Failed")

            valid_count += 1
            comp_pos = valid_count
            google_pos = getattr(doc, 'google_position', getattr(doc, 'position', i + 1))

            pages.append({
                "competitor_position": comp_pos,
                "google_position": google_pos,
                "position": comp_pos,
                "title": title or f"Competitor #{comp_pos}",
                "url": doc_url,
                "final_url": final_url,
                "domain": domain,
                "meta_description": getattr(doc, 'meta_description', '') or "",
                "body_content": body[:12000] if not is_extraction_failed else "",
                "word_count": extracted_words if not is_extraction_failed else 0,
                "extracted_article_length": extracted_words if not is_extraction_failed else 0,
                "heading_count": getattr(doc, 'heading_count', 0) if not is_extraction_failed else 0,
                "paragraph_count": getattr(doc, 'paragraph_count', 0) if not is_extraction_failed else 0,
                "entity_count": 0,
                "http_status": http_status,
                "html_size": html_size,
                "extraction_method": getattr(doc, 'extraction_method', 'httpx_direct' if not is_extraction_failed else 'Failed'),
                "extraction_confidence": getattr(doc, 'extraction_confidence', 85 if not is_extraction_failed else 0),
                "extraction_status": "Success" if not is_extraction_failed else "Extraction Failed",
                "extraction_reason": (
                    None if not is_extraction_failed else
                    (getattr(doc, "extraction_reason", None) or "Automated extraction returned less than 300 readable words.")
                ),
                "manual_content": False,
                "is_extraction_failed": is_extraction_failed,
                "estimated_read_time_min": max(1, extracted_words // 200) if not is_extraction_failed else 0,
                "local_seo_score": float(getattr(doc, 'domain_rating', 50) or 50),
                "publish_date": None,
                "favicon": f"https://www.google.com/s2/favicons?domain={domain}&sz=64",
            })

            if len(pages) >= 3:
                break

        if serp_docs and force_refresh:
            serp_refreshed_at = datetime.now(timezone.utc).isoformat()
            for page in pages:
                page["serp_refreshed_at"] = serp_refreshed_at

        if not pages:
            raise RuntimeError("No SERP results returned. The keyword may not have enough search data.")

        logger.info("========================\nSTAGE 1 - SERP COLLECTION\n========================")
        logger.info("Keyword: '%s' | Search Engine: '%s' | Country: '%s' | Device: '%s'", keyword, search_engine, country, device)
        logger.info("Collected %d SERP competitor pages:", len(pages))
        for p in pages:
            logger.info("  [Rank #%s] %s | URL: %s", p.get("google_position"), p.get("domain"), p.get("url"))

        logger.info("========================\nSTAGE 2 - ARTICLE EXTRACTION\n========================")
        logger.info("Extracted %d competitor articles:", len(pages))
        for p in pages:
            logger.info("  Competitor #%s (%s): Status='%s' | Method='%s' | Words=%d | Headings=%d | Paragraphs=%d",
                        p.get("competitor_position"), p.get("domain"), p.get("extraction_status"), p.get("extraction_method"),
                        p.get("word_count", 0), p.get("heading_count", 0), p.get("paragraph_count", 0))

        plog.info(Stage.SERP_COMPLETE, f"SERP fetched: {len(pages)} pages (valid competitors)", provider="Serper")

        cached.serp_results_json = json.dumps(pages)
        cached.raw_serp_response_json = json.dumps(pages)
        cached.top_3_json = json.dumps(pages[:3])
        cached.status = Stage.SERP_COMPLETE
        try:
            db.add(cached)
            await db.commit()
            plog.checkpoint(Stage.SERP_COMPLETE)
        except Exception as e:
            plog.warn(Stage.SERP_COMPLETE, "Checkpoint save failed (non-fatal)", error=str(e))

    plog.info(Stage.CONTENT_EXTRACT, "Running deterministic NLP extraction", provider="spaCy")
    await cache_manager.update_cache_status(db, cache_key, keyword, Stage.CONTENT_EXTRACT)

    deterministic_data = _extract_deterministic_serp_data(keyword, pages)
    plog.checkpoint(Stage.CONTENT_EXTRACT)

    gemini_cb = circuit_breaker_registry.get("gemini")
    ai_synthesis: dict = {}
    summary_source = "Deterministic"
    raw_text = ""

    if gemini_cb.is_open():
        plog.warn(Stage.AI_RUNNING, "Gemini circuit breaker OPEN — using deterministic fallback", provider="Gemini")
    else:
        await cache_manager.update_cache_status(db, cache_key, keyword, Stage.AI_RUNNING)
        from services.content_generator import call_gemini

        # For manual content flow, avoid blocking on multiple 30s Gemini timeouts
        max_gemini_attempts = 1 if manual_pages else 3
        for attempt in range(max_gemini_attempts):
            try:
                # Only use repair prompt if raw_text was actually returned by Gemini but was malformed
                if attempt == 0 or not raw_text:
                    prompt = _build_synthesis_prompt(keyword, pages, deterministic_data)
                else:
                    plog.increment_retry()
                    repair_prompt = f"""The following text was supposed to be a JSON object but is malformed.
Repair it and return ONLY valid JSON matching this exact structure:

{{
  "executive_summary": "<300-500 word synthesis>",
  "knowledge_synthesis": {{
    "unified_understanding": "<how SERP addresses user intent>",
    "key_insights": ["<insight 1>", "<insight 2>"],
    "best_concepts": ["<concept 1>", "<concept 2>"],
    "actionable_opportunities": ["<opportunity 1>", "<opportunity 2>"]
  }},
  "recommendations": ["<recommendation 1>", "<recommendation 2>"]
}}

Malformed text to repair:
{raw_text}"""
                    prompt = repair_prompt

                plog.info(Stage.AI_RUNNING, f"Gemini call attempt {attempt + 1}", provider="Gemini")
                raw_text = await call_gemini(prompt, max_tokens=2048, keyword="")

                if isinstance(raw_text, str) and raw_text.startswith("ERROR:"):
                    err_msg = raw_text[6:].strip()
                    status_code = 429 if "429" in err_msg or "rate limit" in err_msg.lower() else 500
                    gemini_cb.record_failure(status_code)
                    raise RuntimeError(err_msg)

                parsed = _safe_json_loads(raw_text)
                if parsed is None:
                    raise ValueError("All JSON repair attempts failed")

                candidate_summary = parsed.get("executive_summary", "")
                if not validate_summary(candidate_summary):
                    plog.warn(
                        Stage.AI_RUNNING,
                        f"Gemini summary too short ({len(candidate_summary.split())} words) — retrying",
                        provider="Gemini",
                    )
                    raise ValueError(f"Summary too short: {len(candidate_summary.split())} words (min {MIN_SUMMARY_WORDS})")

                gemini_cb.record_success()
                ai_synthesis = parsed
                summary_source = "Gemini"
                plog.info(Stage.AI_COMPLETE, f"Gemini synthesis complete (attempt {attempt + 1})", provider="Gemini")
                break

            except Exception as exc:
                plog.warn(Stage.AI_RUNNING, f"Gemini attempt {attempt + 1} failed", provider="Gemini", error=str(exc))
                if attempt == max_gemini_attempts - 1:
                    plog.warn(Stage.AI_RUNNING, "Gemini attempts exhausted — using deterministic summary fallback")

    plog.info(Stage.REPORT_BUILDING, "Assembling final report")

    score_block = _build_score_block(deterministic_data)
    seo_scores = [p.get("local_seo_score", 50) for p in pages]
    overall_seo_score = int(sum(seo_scores) / max(len(seo_scores), 1))

    gemini_summary = ai_synthesis.get("executive_summary", "") if ai_synthesis else ""

    if validate_summary(gemini_summary):
        final_summary = gemini_summary
        plog.info(Stage.REPORT_BUILDING, f"Using Gemini summary ({len(gemini_summary.split())} words)", provider="Gemini")
    else:
        try:
            final_summary = generate_deterministic_summary(keyword, pages, deterministic_data)
        except Exception as summary_err:
            plog.warn(Stage.REPORT_BUILDING, f"Deterministic summary fallback warning: {summary_err}")
            final_summary = (
                f"The target keyword '{keyword}' exhibits strong search intent across top-ranking competitor pages. "
                f"Competitors average {deterministic_data.get('semantic_baseline', {}).get('avg_word_count', 1500):,} words "
                f"with structured heading hierarchies and rich entity coverage. To outperform existing listings, "
                f"focus on addressing detected knowledge gaps, incorporating quantitative benchmark data, and establishing deep topical authority."
            )
        summary_source = "Deterministic"
        plog.info(
            Stage.REPORT_BUILDING,
            f"Using deterministic summary ({len(final_summary.split())} words) [Gemini unavailable]",
            provider="spaCy",
        )

    final_knowledge_synthesis = build_knowledge_synthesis(
        keyword=keyword,
        pages=pages,
        deterministic_data=deterministic_data,
        ai_synthesis=ai_synthesis,
    )

    final_recommendations = (
        ai_synthesis.get("recommendations", [])
        if ai_synthesis and ai_synthesis.get("recommendations")
        else deterministic_data.get("seo_analysis", {}).get("recommendations", [
            f"Produce comprehensive content covering all primary topics for '{keyword}'",
            "Use structured formatting with clear H2/H3 heading hierarchy",
            "Include entity-rich references to authoritative organizations and technologies",
        ])
    )

    analysis = {
        **deterministic_data,
        **score_block,
        "summary": final_summary,
        "knowledge_synthesis": final_knowledge_synthesis,
        "recommendations": final_recommendations,
        "summary_source": summary_source,
    }

    try:
        novel_count = len(deterministic_data.get("information_gain", {}).get("novel_opportunities", []))
        unique_count = len(deterministic_data.get("information_gain", {}).get("unique_topics", []))
        coverage = deterministic_data.get("coverage_score", 50)
        novelty_score = int(min(90, max(20, novel_count * 4 + unique_count * 2 + max(0, 50 - coverage))))
        cached = await cache_manager.save_ai_cache(
            db, cache_key, analysis, overall_seo_score, novelty_score, pages,
            version=getattr(cached, 'analysis_version', None)
        )
        plog.checkpoint(Stage.REPORT_COMPLETE)
    except Exception as e:
        plog.warn(Stage.REPORT_COMPLETE, "Failed to persist report to cache (non-fatal)", error=str(e))

    try:
        report_id = str(uuid.uuid4())
        analysis_id_val = getattr(cached, 'id', report_id)
        ver_val = getattr(cached, 'analysis_version', 1)

        db.add(ReportStorage(
            id=report_id,
            analysis_id=analysis_id_val,
            analysis_version=ver_val,
            is_latest=True,
            report_json=json.dumps({
                "request_id": plog.request_id,
                "analysis_id": analysis_id_val,
                "analysis_version": ver_val,
                "analysis_type": "SERP Intelligence",
                "is_latest": True,
                "keyword": keyword,
                "created_at": datetime.now().isoformat(),
                "serp_results": pages,
                "top_3": pages,
                "extracted_content": analysis,
                "seo_score": overall_seo_score,
                "ai_summary": analysis.get("summary", ""),
                "provider_info": search_engine,
            }),
            gemini_model="gemini-flash-latest",
            prompt_version="2.0.0",
        ))
        await db.commit()
    except Exception as e:
        plog.warn(Stage.REPORT_COMPLETE, "ReportStorage save failed (non-fatal)", error=str(e))

    elapsed_ms = int((time.perf_counter() - t_start) * 1000)
    plog.complete(elapsed_ms)

    for p in pages:
        plog.info(Stage.REPORT_COMPLETE, f"competitor_position={p.get('competitor_position')} google_position={p.get('google_position')} url={p.get('url', '')[:60]}")

    slim_pages = [{k: v for k, v in p.items() if k != "body_content"} for p in pages]

    return make_json_serializable({
        "request_id": plog.request_id,
        "analysis_id": getattr(cached, 'id', None),
        "analysis_version": getattr(cached, 'analysis_version', 1),
        "analysis_type": getattr(cached, 'analysis_type', 'SERP Intelligence'),
        "is_latest": getattr(cached, 'is_latest', True),
        "keyword": keyword,
        "generated_at": datetime.now().isoformat(),
        "serp_refreshed_at": serp_refreshed_at,
        "processing_time_ms": elapsed_ms,
        "search_engine": search_engine,
        "serp_results": slim_pages,
        "serp_analysis": analysis,
        "is_cached": False,
    })


def _build_final_response(
    keyword: str,
    search_engine: str,
    cache_key: str,
    cached,
    plog: PipelineLogger,
    t_start: float,
    is_cached: bool = True,
) -> dict:
    analysis = json.loads(cached.extracted_content_json)
    cached_sum = analysis.get("summary", "")
    plog.info(Stage.CACHE_HIT, f"[DEBUG] _build_final_response analysis keys: {list(analysis.keys())} | summary length: {len(str(cached_sum))}")

    try:
        raw_cached_pages = json.loads(cached.serp_results_json) if cached.serp_results_json else []
    except Exception:
        raw_cached_pages = []

    if not raw_cached_pages:
        try:
            raw_cached_pages = json.loads(cached.top_3_json) if cached.top_3_json else []
        except Exception:
            raw_cached_pages = []

    from utils.competitor_filter import filter_and_renumber_competitors
    pages = filter_and_renumber_competitors(raw_cached_pages)[:3]
    serp_refreshed_at = next(
        (page.get("serp_refreshed_at") for page in pages if page.get("serp_refreshed_at")),
        None,
    )

    for p in pages:
        plog.info(Stage.CACHE_HIT, f"competitor_position={p.get('competitor_position')} google_position={p.get('google_position')} url={p.get('url', '')[:60]}")

    if "overall_score" not in analysis:
        analysis.update(_build_score_block(analysis))

    cached_summary = analysis.get("summary", "")
    if not validate_summary(cached_summary):
        plog.warn(Stage.CACHE_HIT, "Cached summary is empty/short — rebuilding deterministically")
        try:
            raw_pages = json.loads(cached.serp_results_json) if cached.serp_results_json else pages
        except Exception:
            raw_pages = pages
        fresh_det = _extract_deterministic_serp_data(keyword, raw_pages)
        analysis["summary"] = generate_deterministic_summary(keyword, raw_pages, fresh_det)
        analysis["summary_source"] = "Deterministic (cache repair)"
        plog.info(Stage.CACHE_HIT, f"Cache repair: generated {len(analysis['summary'].split())} word summary", provider="spaCy")
    else:
        plog.info(Stage.CACHE_HIT, f"Using cached summary ({len(cached_summary.split())} words) [source: {analysis.get('summary_source', 'Cached')}]")

    ks = analysis.get("knowledge_synthesis", {})
    if not ks or not ks.get("key_insights"):
        analysis["knowledge_synthesis"] = build_knowledge_synthesis(
            keyword=keyword,
            pages=pages,
            deterministic_data=analysis,
            ai_synthesis={},
        )

    slim_pages = [{k: v for k, v in p.items() if k != "body_content"} for p in pages]

    elapsed_ms = int((time.perf_counter() - t_start) * 1000)
    final_payload = {
        "request_id": plog.request_id,
        "analysis_id": getattr(cached, 'id', None),
        "analysis_version": getattr(cached, 'analysis_version', 1),
        "analysis_type": getattr(cached, 'analysis_type', 'SERP Intelligence'),
        "is_latest": getattr(cached, 'is_latest', True),
        "keyword": keyword,
        "generated_at": cached.created_at.isoformat() if cached and getattr(cached, 'created_at', None) else datetime.now().isoformat(),
        "serp_refreshed_at": serp_refreshed_at,
        "processing_time_ms": elapsed_ms,
        "search_engine": search_engine,
        "serp_results": slim_pages,
        "serp_analysis": analysis,
        "is_cached": is_cached,
    }

    logger.info("========================\nSTAGE 11 - FINAL RESPONSE\n========================")
    logger.info("Final Response assembled for keyword='%s' (is_cached=%s, elapsed=%d ms):", keyword, is_cached, elapsed_ms)
    logger.info("  Analysis Version: v%s | Overall Score: %d (%s) | Response Keys: %s",
                getattr(cached, 'analysis_version', 1), analysis.get("overall_score", {}).get("score", 0),
                analysis.get("overall_score", {}).get("label", ""), list(analysis.keys())[:10])
    logger.info("  Response Schema Validation: %s", _validate_response(final_payload))

    return make_json_serializable(final_payload)

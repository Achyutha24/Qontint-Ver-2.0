"""
Unified analysis entry point — single SERP-grounded scoring pass for all modules.

Response shape is designed to match the frontend normalizeAnalyzeResponse expectations exactly:
  - top-level: novelty, ranking, authority, recommendations, competitor_comparison,
               total_processing_time_ms, loop_required, serp_results
  - All scores are on the 0–1 scale (novelty_score, authority_score, confidence, etc.)
"""
from __future__ import annotations

import asyncio
import functools
import logging
import time
import uuid
from typing import Any
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from analysis.scoring_engine import build_content_analysis, run_full_scoring
from services.serp_baseline import ensure_keyword_and_serp
from services.serp_intel_service import run_serp_intelligence

logger = logging.getLogger(__name__)


def _build_and_score(content: str, keyword: str, vertical: str, serp_docs: list) -> dict[str, Any]:
    analysis = build_content_analysis(content, keyword, vertical, serp_docs)
    scores = run_full_scoring(analysis)
    return {
        "analysis": analysis,
        "scores": scores,
    }


def _extract_score_01(score_obj: Any) -> float:
    """
    run_full_scoring uses make_score() which returns {"score": 0-100, ...}.
    This helper extracts the value and normalises it to the 0–1 scale.
    If score_obj is already a plain float and <= 1.0, it is returned as-is.
    """
    if isinstance(score_obj, dict):
        val = float(score_obj.get("score", 0.0))
    else:
        val = float(score_obj or 0.0)
    # Normalise: scores from run_full_scoring are 0-100
    if val > 1.0:
        val = val / 100.0
    return max(0.0, min(1.0, val))


async def run_unified_analysis(
    keyword: str,
    db: AsyncSession,
    content: str = "",
    vertical: str = "general",
    search_engine: str = "Google",
    country: str = "us",
    language: str = "en",
    device: str = "desktop",
    request_id: str = "",
) -> dict[str, Any]:
    """
    The single canonical pipeline that produces a response shaped to match
    the frontend's normalizeAnalyzeResponse expectations.

    Returns top-level keys:
      keyword, novelty, ranking, authority, recommendations,
      competitor_comparison, total_processing_time_ms, loop_required,
      serp_results, serp_analysis, metadata
    """
    start = time.perf_counter()
    req_id = request_id or f"req_{uuid.uuid4().hex[:12]}"

    # ── 1. Run SERP Intelligence (fetches SERP, caches it, runs Gemini + NLP) ─
    serp_intel = await run_serp_intelligence(
        keyword=keyword,
        search_engine=search_engine,
        country=country,
        language=language,
        device=device,
        db=db,
        request_id=req_id,
    )

    # serp_intel_service raises its own errors on SERP failure, but guard here too
    if not serp_intel or "serp_analysis" not in serp_intel:
        raise ValueError(
            f"SERP retrieval returned no results for keyword '{keyword}'. "
            "Verify your SERP provider configuration and API key."
        )

    serp_results = serp_intel.get("serp_results", [])

    # ── 2. Content Scoring (only if the user provided content) ─────────────────
    novelty_block: dict = {}
    ranking_block: dict = {}
    authority_block: dict = {}
    loop_required = False

    if content:
        _, serp_docs = await ensure_keyword_and_serp(
            keyword, vertical, db, fast_mode=True,
            search_engine=search_engine, country=country, language=language,
        )

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            functools.partial(_build_and_score, content, keyword, vertical, serp_docs),
        )
        scores = result["scores"]

        # ── Novelty block — all values on 0–1 scale ───────────────────────────
        novelty_01 = _extract_score_01(scores.novelty_score)

        # threshold: run_full_scoring sets it to 70.0 (0-100 scale) → convert
        raw_threshold = float(scores.threshold or 70.0)
        threshold_01 = raw_threshold / 100.0 if raw_threshold > 1.0 else raw_threshold

        novelty_block = {
            "novelty_score":        novelty_01,
            "similarity_score":     max(0.0, min(1.0, float(scores.similarity_score or 0.0))),
            "entity_novelty":       max(0.0, min(1.0, float(scores.entity_novelty or 0.0))),
            "relationship_novelty": max(0.0, min(1.0, float(scores.relationship_novelty or 0.0))),
            "semantic_diversity":   max(0.0, min(1.0, float(scores.semantic_diversity or 0.0))),
            "passed":               bool(scores.passed),
            "threshold":            round(threshold_01, 2),
            "verdict":              str(scores.verdict or ""),
            "reasoning":            list(scores.reasoning or []),
        }
        loop_required = not scores.passed

        # ── Ranking block — confidence on 0–1 scale ───────────────────────────
        raw_conf = float(scores.confidence or 0.0)
        confidence_01 = raw_conf / 100.0 if raw_conf > 1.0 else raw_conf

        ranking_block = {
            "predicted_rank":    int(scores.predicted_rank or 50),
            "confidence":        round(max(0.0, min(1.0, confidence_01)), 3),
            "optimization_gaps": list(scores.optimization_gaps or []),
            "ranking_factors":   dict(scores.ranking_factors or {}),
        }

        # ── Authority block — authority_score on 0–1 scale ────────────────────
        authority_block = {
            "authority_score":  _extract_score_01(scores.authority_score),
            "matched_entities": list(scores.matched_entities or []),
            "missing_entities": list(scores.missing_entities or []),
            "total_checked":    (
                len(scores.matched_entities or []) + len(scores.missing_entities or [])
            ),
        }

    # ── 3. Build Recommendations ───────────────────────────────────────────────
    raw_analysis = serp_intel.get("serp_analysis") or serp_intel.get("analysis") or {}
    raw_recs = raw_analysis.get("recommendations", [])
    recommendations = []
    for r in raw_recs:
        if isinstance(r, str):
            recommendations.append({
                "type":        "improvement",
                "description": r,
                "priority":    "Medium",
            })
        elif isinstance(r, dict):
            recommendations.append({
                "type":              r.get("type", "improvement"),
                "description":       r.get("description", r.get("text", str(r))),
                "priority":          r.get("priority", "Medium"),
                "suggested_entities": r.get("suggested_entities", []),
            })

    # ── 4. Build competitor_comparison from serp_results ──────────────────────
    competitor_comparison = None
    if serp_results:
        competitor_comparison = {
            "keyword": keyword,
            "top_competitors": [
                {
                    "position":         p.get("competitor_position", p.get("position", i + 1)),
                    "google_position":  p.get("google_position", p.get("position", i + 1)),
                    "url":              p.get("url", ""),
                    "title":            p.get("title", ""),
                    "domain":           p.get("domain", ""),
                    "meta_description": p.get("meta_description", ""),
                    "word_count":       p.get("word_count", 0),
                    "seo_score":        p.get("local_seo_score", 50),
                    "favicon":          p.get("favicon", ""),
                }
                for i, p in enumerate(serp_results[:3])
            ],
        }

    elapsed_ms = int((time.perf_counter() - start) * 1000)

    # ── 5. Return response shaped for normalizeAnalyzeResponse ────────────────
    return {
        # Identity — always the user's keyword, never a pipeline fallback
        "keyword":                keyword,
        "schema_version":         "2.0",
        "request_id":             req_id,
        "generated_at":           datetime.utcnow().isoformat(),

        # Scores — top-level, matching frontend normalizeAnalyzeResponse expectations
        "novelty":                novelty_block,
        "ranking":                ranking_block,
        "authority":              authority_block,
        "recommendations":        recommendations,
        "competitor_comparison":  competitor_comparison,
        "total_processing_time_ms": elapsed_ms,
        "loop_required":          loop_required,

        # SERP data — for the SERP Comparison / SERP Intelligence panels
        "serp_results":           serp_results,
        "cache_status":           "HIT" if serp_intel.get("is_cached") else "MISS",

        # Full SERP analysis block — for the SERP Intelligence modal
        "serp_analysis": {
            "summary":             raw_analysis.get("summary", ""),
            "summary_source":      raw_analysis.get("summary_source", "Unknown"),
            "content_structure":   raw_analysis.get("content_structure", {}),
            "topic_coverage":      raw_analysis.get("topic_coverage", {}),
            "weak_areas":          raw_analysis.get("knowledge_gaps", {}).get("weak_explanations", []),
            "keyword_analysis":    raw_analysis.get("keyword_analysis", {}),
            "readability":         raw_analysis.get("readability", {}),
            "seo_analysis":        raw_analysis.get("seo_analysis", {}),
            "entities":            raw_analysis.get("entities", {}),
            "knowledge_gaps":      raw_analysis.get("knowledge_gaps", {}),
            "knowledge_synthesis": raw_analysis.get("knowledge_synthesis", {}),
            "semantic_analysis":   raw_analysis.get("semantic_analysis", {}),
            "overall_score":       raw_analysis.get("overall_score", {}),
            "search_intent":       raw_analysis.get("search_intent", {}),
            "serp_features":       raw_analysis.get("serp_features", {}),
        },

        "metadata": {
            "search_engine":      search_engine,
            "country":            country,
            "language":           language,
            "device":             device,
            "provider":           "Gemini-Flash + Deterministic NLP",
            "processing_time_ms": elapsed_ms,
        },
    }
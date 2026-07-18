"""
Unified analysis entry point — single SERP-grounded scoring pass for all modules.
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
from services.content_generator import generate_competitor_comparison
from services.serp_intel_service import run_serp_intelligence

logger = logging.getLogger(__name__)

def _build_and_score(content: str, keyword: str, vertical: str, serp_docs: list) -> dict[str, Any]:
    analysis = build_content_analysis(content, keyword, vertical, serp_docs)
    scores = run_full_scoring(analysis)
    return {
        "analysis": analysis,
        "scores": scores,
    }

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
    The single canonical pipeline that produces UnifiedAnalysisResponse
    for both Analyze and SERP Intelligence.
    """
    start = time.perf_counter()
    req_id = request_id or f"req_{uuid.uuid4().hex[:12]}"

    # 1. Run SERP Intelligence (fetches SERP, caches it, runs Gemini + NLP)
    serp_intel = await run_serp_intelligence(
        keyword=keyword,
        search_engine=search_engine,
        country=country,
        language=language,
        device=device,
        db=db,
        request_id=req_id,
    )

    # Extract the top 3 formatted competitor results from serp_intel
    serp_results = serp_intel.get("serp_results", [])

    # 2. Content Scoring (only if content is provided by the user)
    content_scores = None
    if content:
        class DummyDoc:
            def __init__(self, d):
                self.title = d.get("title")
                self.url = d.get("url")
                self.meta_description = d.get("snippet", "")
                self.body_content = d.get("body_content", "")
                self.position = d.get("rank", 99)
                self.domain_rating = 50.0

        _, serp_docs = await ensure_keyword_and_serp(
            keyword, vertical, db, fast_mode=True,
            search_engine=search_engine, country=country, language=language,
        )

        loop = asyncio.get_event_loop()
        scoring_task = loop.run_in_executor(
            None,
            functools.partial(_build_and_score, content, keyword, vertical, serp_docs),
        )
        result = await scoring_task
        scores = result["scores"]

        content_scores = {
            "seo": scores.seo_score,
            "novelty": scores.novelty_score,
            "semantic_coverage": scores.semantic_coverage,
            "intent_match": scores.intent_match,
            "authority": scores.authority_score,
            "overall": scores.overall_score,
            "readability": scores.readability_score,
        }

    # 3. Build Canonical Response
    # The new serp_intel_service returns the full analysis block under "serp_analysis"
    # Support both old ("analysis") and new ("serp_analysis") keys for backwards compat
    raw_analysis = serp_intel.get("serp_analysis") or serp_intel.get("analysis") or {}

    response = {
        "schema_version": "1.0",
        "analysis_version": "1.0",
        "request_id": req_id,
        "generated_at": datetime.utcnow().isoformat(),
        "provider": "Gemini-Flash + Deterministic NLP",
        "cache_status": "HIT" if serp_intel.get("is_cached") else "MISS",
        "keyword": keyword,
        "metadata": {
            "search_engine": search_engine,
            "country": country,
            "language": language,
            "device": device,
            "processing_time_ms": int((time.perf_counter() - start) * 1000),
        },
        "serp_results": serp_results,
        "content_scores": content_scores,
        "serp_analysis": {
            "summary":            raw_analysis.get("summary", ""),
            "summary_source":     raw_analysis.get("summary_source", "Unknown"),
            "content_structure":  raw_analysis.get("content_structure", {}),
            "topic_coverage":     raw_analysis.get("topic_coverage", {}),
            "weak_areas":         raw_analysis.get("knowledge_gaps", {}).get("weak_explanations", []),
            "keyword_analysis":   raw_analysis.get("keyword_analysis", {}),
            "readability":        raw_analysis.get("readability", {}),
            "seo_analysis":       raw_analysis.get("seo_analysis", {}),
            "entities":           raw_analysis.get("entities", {}),
            "knowledge_gaps":     raw_analysis.get("knowledge_gaps", {}),
            "knowledge_synthesis":raw_analysis.get("knowledge_synthesis", {}),
            "recommendations":    raw_analysis.get("recommendations", []),
            "semantic_analysis":  raw_analysis.get("semantic_analysis", {}),
            "overall_score":      raw_analysis.get("overall_score", {}),
            "search_intent":      raw_analysis.get("search_intent", {}),
            "serp_features":      raw_analysis.get("serp_features", {}),
        },
        "report_metadata": {
            "url": f"/app/analyze?kw={keyword}",
        },
    }

    return response
"""
Unified analysis entry point — single SERP-grounded scoring pass for all modules.
"""
from __future__ import annotations

import asyncio
import functools
import logging
import time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from analysis.scoring_engine import build_content_analysis, run_full_scoring
from config import settings
from services.serp_baseline import ensure_keyword_and_serp
from services.content_generator import generate_competitor_comparison
from services.serp_providers import get_serp_provider

logger = logging.getLogger(__name__)


def _build_and_score(content: str, keyword: str, vertical: str, serp_docs: list) -> dict[str, Any]:
    analysis = build_content_analysis(content, keyword, vertical, serp_docs)
    scores = run_full_scoring(analysis)
    return {
        "analysis": analysis,
        "scores": scores,
    }


from fastapi import HTTPException

async def run_unified_analysis(
    content: str,
    keyword: str,
    vertical: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Run full NLP + scoring pipeline with shared ContentAnalysis."""
    start = time.perf_counter()
    _, serp_docs = await ensure_keyword_and_serp(keyword, vertical, db, fast_mode=True)

    loop = asyncio.get_event_loop()
    
    # Fetch Live SERP data if provider is available
    provider = get_serp_provider()
    live_serp_task = provider.search(keyword, max_results=3)
    
    scoring_task = loop.run_in_executor(
        None,
        functools.partial(_build_and_score, content, keyword, vertical, serp_docs),
    )
    
    live_serp_results = []
    try:
        live_serp_results, result = await asyncio.gather(live_serp_task, scoring_task)
    except Exception as e:
        logger.error(f"Error during parallel execution (SERP or Scoring): {e}")
        # Fallback if live SERP completely blows up
        result = await loop.run_in_executor(
            None,
            functools.partial(_build_and_score, content, keyword, vertical, serp_docs),
        )

    if not live_serp_results:
        logger.warning("No live competitors found, using local serp docs for competitor comparison.")
        live_serp_results = serp_docs[:3]
    
    # Run comparison asynchronously
    try:
        competitor_comparison = await generate_competitor_comparison(content, keyword, vertical, live_serp_results)
    except Exception as e:
        logger.error(f"Error generating competitor comparison: {e}")
        competitor_comparison = None

    
    scores = result["scores"]
    elapsed_ms = int((time.perf_counter() - start) * 1000)

    novelty_result = {
        "novelty_score": scores.novelty_score,
        "similarity_score": scores.similarity_score,
        "entity_novelty": scores.entity_novelty,
        "relationship_novelty": scores.relationship_novelty,
        "semantic_diversity": scores.semantic_diversity,
        "passed": scores.passed,
        "threshold": scores.threshold,
        "verdict": scores.verdict,
        "reasoning": scores.reasoning,
        "processing_time_ms": elapsed_ms,
    }
    authority_result = {
        "matched_entities": scores.matched_entities,
        "missing_entities": scores.missing_entities,
        "authority_score": scores.authority_score,
    }
    ranking_result = {
        "predicted_rank": scores.predicted_rank,
        "confidence": scores.confidence,
        "ranking_factors": scores.ranking_factors,
        "optimization_gaps": scores.optimization_gaps,
        "model_version": "deterministic_serp_v2",
        "processing_time_ms": elapsed_ms,
    }

    # Override competitor summary with actual python calculated metrics
    if competitor_comparison and "summary_table" in competitor_comparison:
        our_article = competitor_comparison["summary_table"].get("our_article", {})
        our_article["seo_score"] = f"{int(scores.seo_score)}/100"
        our_article["overall_competitive_score"] = f"{int(scores.seo_score)}/100"
        our_article["intent_match"] = f"{int(scores.intent_match)}/100"
        competitor_comparison["summary_table"]["our_article"] = our_article

    final_result = {
        "novelty": novelty_result,
        "authority": authority_result,
        "ranking": ranking_result,
        "competitor_comparison": competitor_comparison,
        "serp_grounded": scores.serp_grounded,
        "debug": scores.debug,
        "total_processing_time_ms": elapsed_ms,
    }
    
    # Save to Analysis History and Graph DB
    import json
    import uuid
    from models.db import AnalysisHistory, Entity, EntityOccurrence
    from sqlalchemy import select
    
    history_entry = AnalysisHistory(
        keyword=keyword,
        vertical=vertical,
        content=content,
        full_json_report=json.dumps(final_result)
    )
    db.add(history_entry)
    
    # Automatically extract entities for Graph Page and commit to DB
    analysis_obj = result["analysis"]
    entity_cache = {}
    for ent_data in analysis_obj.content_entities:
        text = ent_data["text"]
        if text in entity_cache:
            entity = entity_cache[text]
            entity.frequency += 1
        else:
            # Check DB
            ent_res = await db.execute(select(Entity).where(Entity.text == text, Entity.vertical == vertical))
            ent_obj = ent_res.scalar_one_or_none()
            if ent_obj:
                ent_obj.frequency += 1
                entity = ent_obj
            else:
                entity = Entity(
                    id=str(uuid.uuid4()),
                    text=text,
                    entity_type=ent_data.get("entity_type", "CONCEPT"),
                    vertical=vertical,
                    frequency=1,
                )
                db.add(entity)
            entity_cache[text] = entity
            
        # Add occurrence (linking to history_entry via serp_result_id fallback or new column if it existed, but we'll use a dummy serp_result_id for user content to allow Graph Page to read it, or just use the first serp doc)
        if serp_docs:
            db.add(EntityOccurrence(
                id=str(uuid.uuid4()),
                entity_id=entity.id,
                serp_result_id=serp_docs[0].id,
                confidence=ent_data.get("confidence", 1.0),
            ))

    await db.commit()

    return final_result

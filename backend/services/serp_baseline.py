"""Load and ensure SERP competitor baseline for scoring."""
from __future__ import annotations

import logging
from typing import Any
import urllib.parse

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.db import Keyword, SerpResult
from services.serp_collector import collect_serp_for_keyword

logger = logging.getLogger(__name__)


async def ensure_keyword_and_serp(
    keyword: str,
    vertical: str,
    db: AsyncSession,
    *,
    fast_mode: bool = True,
    search_engine: str = "Google",
    country: str = "us",
    language: str = "en"
) -> tuple[Any, list[SerpResult]]:
    """Ensure keyword exists and SERP rows are available; returns (keyword, serp_docs)."""
    kw_result = await db.execute(
        select(Keyword).where(Keyword.query == keyword, Keyword.vertical == vertical)
    )
    kw_obj = kw_result.scalars().first()

    if not kw_obj:
        kw_obj = Keyword(query=keyword, vertical=vertical)
        db.add(kw_obj)
        await db.commit()
        await db.refresh(kw_obj)

    count_res = await db.execute(
        select(func.count(SerpResult.id)).where(SerpResult.keyword_id == kw_obj.id)
    )
    serp_count = count_res.scalar() or 0

    min_required = settings.ANALYZE_SERP_MAX_RESULTS

    # !! Eagerly capture id as plain Python string to prevent greenlet errors
    # if a rollback inside collect_serp_for_keyword expires the ORM object !!
    kw_id: str = str(kw_obj.id)

    # Only skip collection if this specific keyword already has enough data
    if serp_count < min_required:
        logger.info("Collecting SERP baseline for '%s' (had %d rows, need %d)", keyword, serp_count, min_required)
        try:
            await collect_serp_for_keyword(kw_id, vertical, db, force_refresh=False, fast_mode=fast_mode, country=country, language=language)
        except Exception as exc:
            logger.warning("SERP collection failed for '%s': %s — will use whatever is in DB", keyword, exc)

    # Fetch top 30 results to allow for strict filtering
    serp_res = await db.execute(
        select(SerpResult)
        .where(SerpResult.keyword_id == kw_id)
        .order_by(SerpResult.position.asc())
        .limit(30)
    )
    raw_serp_docs = list(serp_res.scalars().all())

    from utils.competitor_filter import filter_and_renumber_competitors
    filtered_competitors = filter_and_renumber_competitors(raw_serp_docs)
    
    # We must return SerpResult objects (or objects with similar attributes) 
    # for compatibility with scoring_engine.py. We'll reconstruct them or patch them.
    # Actually, it's safer to just return the original SerpResult objects but patched with new position.
    
    serp_docs = []
    for comp in filtered_competitors:
        # Find the matching original ORM object
        for doc in raw_serp_docs:
            if doc.url == comp["url"]:
                # !! IMPORTANT: Do NOT assign to doc.position — that's a DB column !!
                # Instead attach competitor_position and google_position as plain
                # Python attributes that SQLAlchemy does NOT track/persist.
                # The DB column `position` always stores the original Google SERP rank.
                object.__setattr__(doc, 'competitor_position', comp["competitor_position"])
                object.__setattr__(doc, 'google_position', comp["google_position"])
                serp_docs.append(doc)
                break
        
        if len(serp_docs) >= settings.ANALYZE_MAX_SERP_DOCS:
            break

    # Fallback if somehow still empty
    if len(serp_docs) == 0 and len(raw_serp_docs) == 0:
        logger.debug("Keyword '%s' has no SERP docs, adding vertical fallback", keyword)
        fallback = await db.execute(
            select(SerpResult)
            .where(SerpResult.vertical == vertical)
            .order_by(SerpResult.collected_at.desc())
            .limit(30)
        )
        seen_urls: set[str] = set()
        raw_fallback_docs = []
        for row in fallback.scalars().all():
            if row.url not in seen_urls:
                raw_fallback_docs.append(row)
                seen_urls.add(row.url)
                
        fallback_filtered = filter_and_renumber_competitors(raw_fallback_docs)
        
        for comp in fallback_filtered:
            for doc in raw_fallback_docs:
                if doc.url == comp["url"]:
                    doc.position = comp["competitor_position"]
                    doc.google_position = comp["google_position"]
                    serp_docs.append(doc)
                    break
                    
            if len(serp_docs) >= settings.ANALYZE_MAX_SERP_DOCS:
                break

    return kw_obj, serp_docs

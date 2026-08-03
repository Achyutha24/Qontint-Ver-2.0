import json
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import urllib.parse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.db import AnalysisCache, SearchHistory, ContentStorage

logger = logging.getLogger(__name__)

class CacheManager:
    @staticmethod
    def generate_cache_key(keyword: str, country: str, language: str, device: str, search_provider: str, location: str = "default", safe_search: str = "off") -> str:
        key_string = f"{keyword.lower().strip()}|{country}|{language}|{device}|{search_provider}|{location}|{safe_search}"
        return hashlib.sha256(key_string.encode('utf-8')).hexdigest()

    @staticmethod
    def generate_content_hash(text: str) -> str:
        return hashlib.sha256(text.encode('utf-8')).hexdigest()

    @staticmethod
    async def get_analysis_cache(db: AsyncSession, cache_key: str, version: Optional[int] = None) -> Optional[AnalysisCache]:
        """Fetch analysis record for cache_key (defaults to is_latest == True)."""
        if version is not None:
            stmt = select(AnalysisCache).filter(
                AnalysisCache.cache_key == cache_key,
                AnalysisCache.analysis_version == version
            )
        else:
            stmt = select(AnalysisCache).filter(
                AnalysisCache.cache_key == cache_key,
                AnalysisCache.is_latest == True
            ).order_by(AnalysisCache.analysis_version.desc())
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_content_storage(db: AsyncSession, url: str) -> Optional[ContentStorage]:
        result = await db.execute(select(ContentStorage).filter(ContentStorage.url == url))
        return result.scalars().first()

    @staticmethod
    async def create_new_analysis_version(
        db: AsyncSession,
        cache_key: str,
        keyword: str,
        analysis_type: str = "SERP Intelligence",
        expiry_hours: int = 24
    ) -> AnalysisCache:
        """
        Versioned Analysis Architecture:
        Creates a NEW immutable version row for keyword execution.
        Sets is_latest = False on older version records.
        """
        stmt = select(AnalysisCache).filter(AnalysisCache.cache_key == cache_key)
        res = await db.execute(stmt)
        existing_rows = res.scalars().all()

        max_ver = 0
        for row in existing_rows:
            row.is_latest = False
            if row.analysis_version and row.analysis_version > max_ver:
                max_ver = row.analysis_version

        new_version = max_ver + 1
        new_cache = AnalysisCache(
            cache_key=cache_key,
            keyword=keyword,
            analysis_version=new_version,
            analysis_type=analysis_type,
            is_latest=True,
            status="QUEUED",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            expiry_time=datetime.now() + timedelta(hours=expiry_hours)
        )
        db.add(new_cache)
        await db.commit()
        await db.refresh(new_cache)
        return new_cache

    @staticmethod
    async def update_cache_status(db: AsyncSession, cache_key: str, keyword: str, status: str, expiry_hours: int = 24) -> AnalysisCache:
        cache = await CacheManager.get_analysis_cache(db, cache_key)
        if not cache:
            cache = await CacheManager.create_new_analysis_version(db, cache_key, keyword, expiry_hours=expiry_hours)
        
        cache.status = status
        cache.updated_at = datetime.now()
        cache.expiry_time = datetime.now() + timedelta(hours=expiry_hours)
        await db.commit()
        await db.refresh(cache)
        return cache

    @staticmethod
    async def save_raw_serp_cache(db: AsyncSession, cache_key: str, raw_json: str, provider: str, credits: int, response_time_ms: int) -> AnalysisCache:
        cache = await CacheManager.get_analysis_cache(db, cache_key)
        if cache:
            cache.raw_serp_response_json = raw_json
            cache.provider_info = provider
            cache.credits_consumed = credits
            cache.response_time_ms = response_time_ms
            cache.status = "SERP_FETCHED"
            cache.updated_at = datetime.now()
            await db.commit()
            await db.refresh(cache)
        return cache

    @staticmethod
    async def save_pages_cache(db: AsyncSession, cache_key: str, pages_data: List[Dict[str, Any]]) -> AnalysisCache:
        cache = await CacheManager.get_analysis_cache(db, cache_key)
        if cache:
            cache.serp_results_json = json.dumps(pages_data)
            cache.serp_snapshot_json = json.dumps(pages_data)
            cache.status = "CONTENT_EXTRACTED"
            cache.updated_at = datetime.now()
            await db.commit()
            await db.refresh(cache)
        return cache

    @staticmethod
    async def save_ai_cache(db: AsyncSession, cache_key: str, analysis: Dict[str, Any], seo_score: int, novelty_score: int, top_3: List[Dict[str, Any]]) -> AnalysisCache:
        cache = await CacheManager.get_analysis_cache(db, cache_key)
        if cache:
            cache.extracted_content_json = json.dumps(analysis)
            cache.top_3_json = json.dumps(top_3)
            cache.seo_score = seo_score
            cache.novelty_score = novelty_score
            cache.ai_summary = analysis.get("summary", "")
            cache.status = "REPORT_COMPLETE"
            cache.updated_at = datetime.now()

            # Store immutable semantic snapshots
            cache.semantic_snapshot_json = json.dumps(analysis.get("semantic_baseline", {}))
            cache.entity_snapshot_json = json.dumps(analysis.get("entities", {}))
            cache.cluster_snapshot_json = json.dumps(analysis.get("semantic_analysis", {}).get("semantic_clusters", []))
            cache.recommendation_snapshot_json = json.dumps(analysis.get("seo_analysis", {}).get("recommendations", []))

            await db.commit()
            await db.refresh(cache)
        return cache
        
    @staticmethod
    async def save_error_cache(db: AsyncSession, cache_key: str, error_msg: str) -> AnalysisCache:
        cache = await CacheManager.get_analysis_cache(db, cache_key)
        if cache:
            cache.error_log = error_msg
            cache.status = "FAILED"
            await db.commit()
        return cache

    @staticmethod
    async def record_search_history(db: AsyncSession, cache_key: str, keyword: str, page_name: str, search_engine: str, country: str, language: str, device: str):
        result = await db.execute(
            select(SearchHistory).filter(
                SearchHistory.cache_key == cache_key, 
                SearchHistory.page_name == page_name
            )
        )
        history = result.scalars().first()
        if history:
            history.access_count += 1
            history.last_accessed = datetime.now()
        else:
            history = SearchHistory(
                keyword=keyword,
                normalized_keyword=keyword.lower().strip(),
                page_name=page_name,
                search_engine=search_engine,
                country=country,
                language=language,
                device=device,
                cache_key=cache_key
            )
            db.add(history)
        await db.commit()

cache_manager = CacheManager()

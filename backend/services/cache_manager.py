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
    async def get_analysis_cache(db: AsyncSession, cache_key: str) -> Optional[AnalysisCache]:
        result = await db.execute(select(AnalysisCache).filter(AnalysisCache.cache_key == cache_key))
        return result.scalars().first()

    @staticmethod
    async def get_content_storage(db: AsyncSession, url: str) -> Optional[ContentStorage]:
        result = await db.execute(select(ContentStorage).filter(ContentStorage.url == url))
        return result.scalars().first()

    @staticmethod
    async def save_content_storage(db: AsyncSession, url: str, content: str, html: str, http_status: int, etag: Optional[str], last_modified: Optional[str]) -> ContentStorage:
        from sqlalchemy.exc import IntegrityError
        content_hash = CacheManager.generate_content_hash(content)
        
        result = await db.execute(select(ContentStorage).filter(ContentStorage.url == url))
        storage = result.scalars().first()

        if storage:
            storage.downloaded_html = html
            storage.extracted_text = content
            storage.word_count = len(content.split())
            storage.content_hash = content_hash
            storage.http_status = http_status
            storage.etag_header = etag
            storage.last_modified_header = last_modified
            storage.updated_at = datetime.now()
            try:
                await db.commit()
                await db.refresh(storage)
            except Exception:
                await db.rollback()
        else:
            storage = ContentStorage(
                url=url,
                downloaded_html=html,
                extracted_text=content,
                word_count=len(content.split()),
                content_hash=content_hash,
                http_status=http_status,
                etag_header=etag,
                last_modified_header=last_modified
            )
            db.add(storage)
            try:
                await db.commit()
                await db.refresh(storage)
            except IntegrityError:
                # Race condition: another concurrent request inserted the same URL first
                await db.rollback()
                # Load the existing record that won the race
                result = await db.execute(select(ContentStorage).filter(ContentStorage.url == url))
                storage = result.scalars().first()
            except Exception:
                await db.rollback()
                raise
        
        return storage

    @staticmethod
    async def update_cache_status(db: AsyncSession, cache_key: str, keyword: str, status: str, expiry_hours: int = 24) -> AnalysisCache:
        cache = await CacheManager.get_analysis_cache(db, cache_key)
        if not cache:
            cache = AnalysisCache(
                cache_key=cache_key,
                keyword=keyword,
                status=status,
                expiry_time=datetime.now() + timedelta(hours=expiry_hours)
            )
            db.add(cache)
        else:
            cache.status = status
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
            await db.commit()
            await db.refresh(cache)
        return cache

    @staticmethod
    async def save_pages_cache(db: AsyncSession, cache_key: str, pages_data: List[Dict[str, Any]]) -> AnalysisCache:
        cache = await CacheManager.get_analysis_cache(db, cache_key)
        if cache:
            cache.serp_results_json = json.dumps(pages_data)
            cache.status = "CONTENT_EXTRACTED"
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

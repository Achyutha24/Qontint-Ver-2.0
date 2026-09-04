import json
import hashlib
import logging
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import urllib.parse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.db import AnalysisCache, SearchHistory, ContentStorage

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 24

def make_json_serializable(obj: Any) -> Any:
    """Recursively convert custom objects, sets, datetimes, and numpy types to JSON-serializable primitives."""
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, set):
        return [make_json_serializable(item) for item in obj]
    if isinstance(obj, (list, tuple)):
        return [make_json_serializable(item) for item in obj]
    if isinstance(obj, dict):
        return {str(k): make_json_serializable(v) for k, v in obj.items() if not str(k).startswith("_")}
    if hasattr(obj, "to_dict") and callable(getattr(obj, "to_dict")):
        return make_json_serializable(obj.to_dict())
    if hasattr(obj, "__dict__"):
        return {str(k): make_json_serializable(v) for k, v in obj.__dict__.items() if not str(k).startswith("_")}
    return str(obj)


class CacheDecision:
    """Dataclass encapsulating centralized cache lookup decision."""
    def __init__(self, use_cache: bool, record: Optional[AnalysisCache], reason: str):
        self.use_cache = use_cache
        self.record = record
        self.reason = reason


class CacheManager:
    @staticmethod
    def normalize_keyword(keyword: str) -> str:
        """Normalize keyword before cache key generation or lookup."""
        if not keyword:
            return ""
        cleaned = keyword.lower().strip()
        cleaned = re.sub(r'[^\w\s\-]', '', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned.strip()

    @staticmethod
    def generate_cache_key(keyword: str, country: str, language: str, device: str, search_provider: str, location: str = "default", safe_search: str = "off") -> str:
        norm_kw = CacheManager.normalize_keyword(keyword)
        key_string = f"{norm_kw}|{country}|{language}|{device}|{search_provider}|{location}|{safe_search}"
        return hashlib.sha256(key_string.encode('utf-8')).hexdigest()

    @staticmethod
    def generate_content_hash(text: str) -> str:
        return hashlib.sha256(text.encode('utf-8')).hexdigest()

    @staticmethod
    def is_cache_valid(cache: Optional[AnalysisCache]) -> bool:
        """Verify cache record is fully complete, non-expired, and has valid JSON analysis payload."""
        if not cache:
            return False
        if cache.status != "REPORT_COMPLETE":
            return False
        if not cache.extracted_content_json or len(cache.extracted_content_json.strip()) < 10:
            return False
        if cache.expiry_time and cache.expiry_time <= datetime.now():
            return False
        return True

    @staticmethod
    def is_cache_stale_for_background_refresh(cache: Optional[AnalysisCache], stale_ratio: float = 0.8) -> bool:
        """Check if cache is valid but age exceeds stale ratio (default 80% of 24h TTL = 19.2 hours)."""
        if not CacheManager.is_cache_valid(cache):
            return False
        if not cache.created_at:
            return False
        age_seconds = (datetime.now() - cache.created_at).total_seconds()
        ttl_seconds = CACHE_TTL_HOURS * 3600
        return age_seconds >= (ttl_seconds * stale_ratio)

    @staticmethod
    async def get_latest_completed_cache(db: AsyncSession, cache_key: str) -> Optional[AnalysisCache]:
        """Fetch the latest completed, non-expired cache record for cache_key regardless of is_latest flag."""
        stmt = (
            select(AnalysisCache)
            .filter(
                AnalysisCache.cache_key == cache_key,
                AnalysisCache.status == "REPORT_COMPLETE"
            )
            .order_by(AnalysisCache.analysis_version.desc())
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()
        now = datetime.now()
        for row in rows:
            if row.extracted_content_json and len(row.extracted_content_json.strip()) >= 10:
                if not row.expiry_time or row.expiry_time > now:
                    return row
        return None

    @staticmethod
    async def get_cache_decision(
        db: AsyncSession,
        cache_key: str,
        keyword: str,
        search_engine: str = "Google",
        country: str = "us",
        language: str = "en",
        device: str = "desktop",
        force_refresh: bool = False,
        pipeline_version: str = "2.0-semantic",
    ) -> CacheDecision:
        """
        Centralized Single Source of Truth Cache Decision Engine.
        Returns a CacheDecision object detailing whether to use cache and the exact reason.
        """
        if force_refresh:
            return CacheDecision(
                use_cache=False,
                record=None,
                reason="Refresh SERP requested (force_refresh=True)"
            )

        completed_cache = await CacheManager.get_latest_completed_cache(db, cache_key)
        if not completed_cache:
            stmt = select(AnalysisCache).filter(AnalysisCache.cache_key == cache_key)
            res = await db.execute(stmt)
            any_row = res.scalars().first()
            if not any_row:
                reason = "No cache record found"
            else:
                reason = "No completed cache found (previous run incomplete or failed)"
            return CacheDecision(use_cache=False, record=None, reason=reason)

        now = datetime.now()
        if completed_cache.expiry_time and completed_cache.expiry_time <= now:
            return CacheDecision(
                use_cache=False,
                record=completed_cache,
                reason="Cache expired"
            )

        if not completed_cache.extracted_content_json or len(completed_cache.extracted_content_json.strip()) < 10:
            return CacheDecision(
                use_cache=False,
                record=completed_cache,
                reason="Cache content payload empty or corrupted"
            )

        # Do not keep serving a completed report whose entire Top-3 SERP snapshot
        # failed extraction. This was the main reason a temporary scraper/provider
        # failure could make multiple keywords appear permanently "Not available"
        # until the user manually clicked Refresh SERP. A partially successful
        # snapshot remains cacheable so the user can use the manual fallback for
        # only the blocked competitors.
        try:
            snapshot_raw = completed_cache.serp_results_json or completed_cache.top_3_json or "[]"
            snapshot = json.loads(snapshot_raw)
            top_three = snapshot[:3] if isinstance(snapshot, list) else []
            if top_three and len([p for p in top_three if isinstance(p, dict)]) == len(top_three) and all(
                bool(page.get("is_extraction_failed")) or int(page.get("word_count") or 0) < 300
                for page in top_three
            ):
                return CacheDecision(
                    use_cache=False,
                    record=completed_cache,
                    reason="Cached SERP snapshot contains only failed extractions; retrying live SERP collection"
                )
        except Exception:
            # A malformed snapshot should be treated as stale rather than trusted.
            return CacheDecision(
                use_cache=False,
                record=completed_cache,
                reason="Cached SERP snapshot is malformed; rebuilding live SERP collection"
            )

        return CacheDecision(
            use_cache=True,
            record=completed_cache,
            reason="Completed cache found"
        )

    @staticmethod
    async def get_analysis_cache(db: AsyncSession, cache_key: str, version: Optional[int] = None) -> Optional[AnalysisCache]:
        """Fetch analysis record for cache_key (defaults to latest completed if available, else is_latest == True)."""
        if version is not None:
            stmt = select(AnalysisCache).filter(
                AnalysisCache.cache_key == cache_key,
                AnalysisCache.analysis_version == version
            )
            result = await db.execute(stmt)
            return result.scalars().first()

        completed = await CacheManager.get_latest_completed_cache(db, cache_key)
        if completed:
            return completed

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
        expiry_hours: int = CACHE_TTL_HOURS
    ) -> AnalysisCache:
        """
        Versioned Analysis Architecture:
        Creates a NEW immutable version row for keyword execution.
        Sets is_latest = False on older version records.
        Preserves previous serp_results_json if available.
        """
        stmt = select(AnalysisCache).filter(AnalysisCache.cache_key == cache_key)
        res = await db.execute(stmt)
        existing_rows = res.scalars().all()

        max_ver = 0
        prev_serp_json = None
        for row in existing_rows:
            row.is_latest = False
            if row.analysis_version and row.analysis_version > max_ver:
                max_ver = row.analysis_version
            if row.serp_results_json and not prev_serp_json:
                prev_serp_json = row.serp_results_json

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
            expiry_time=datetime.now() + timedelta(hours=expiry_hours),
            serp_results_json=prev_serp_json
        )
        db.add(new_cache)
        await db.commit()
        await db.refresh(new_cache)
        return new_cache

    @staticmethod
    async def update_cache_status(db: AsyncSession, cache_key: str, keyword: str, status: str, expiry_hours: int = CACHE_TTL_HOURS) -> Optional[AnalysisCache]:
        cache = await CacheManager.get_analysis_cache(db, cache_key)
        if not cache:
            logger.warning(f"update_cache_status called for status='{status}' but no active cache row found for key '{cache_key}' — skipping version creation")
            return None
        
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
            clean_pages = make_json_serializable(pages_data)
            cache.serp_results_json = json.dumps(clean_pages)
            cache.serp_snapshot_json = json.dumps(clean_pages)
            cache.status = "CONTENT_EXTRACTED"
            cache.updated_at = datetime.now()
            await db.commit()
            await db.refresh(cache)
        return cache

    @staticmethod
    async def save_ai_cache(
        db: AsyncSession,
        cache_key: str,
        analysis: Dict[str, Any],
        seo_score: int,
        novelty_score: int,
        top_3: List[Dict[str, Any]],
        version: Optional[int] = None,
    ) -> AnalysisCache:
        cache = await CacheManager.get_analysis_cache(db, cache_key, version=version)
        if cache:
            clean_analysis = make_json_serializable(analysis)
            clean_top3 = make_json_serializable(top_3)
            serialized_top3 = json.dumps(clean_top3)

            cache.extracted_content_json = json.dumps(clean_analysis)
            cache.top_3_json = serialized_top3
            # Also update serp_results_json so that _build_final_response reads the
            # same enriched pages on the next cache hit — critical for the manual
            # paste flow where the pipeline only updates top_3_json but the cache
            # response builder reads serp_results_json.
            cache.serp_results_json = serialized_top3
            cache.seo_score = seo_score
            cache.novelty_score = novelty_score
            cache.ai_summary = analysis.get("summary", "")
            cache.status = "REPORT_COMPLETE"
            cache.updated_at = datetime.now()

            # Store immutable semantic snapshots
            cache.semantic_snapshot_json = json.dumps(make_json_serializable(analysis.get("semantic_baseline", {})))
            cache.entity_snapshot_json = json.dumps(make_json_serializable(analysis.get("entities", {})))
            cache.cluster_snapshot_json = json.dumps(make_json_serializable(analysis.get("semantic_analysis", {}).get("semantic_clusters", [])))
            cache.recommendation_snapshot_json = json.dumps(make_json_serializable(analysis.get("seo_analysis", {}).get("recommendations", [])))

            await db.commit()
            await db.refresh(cache)
        return cache

        
    @staticmethod
    async def save_error_cache(db: AsyncSession, cache_key: str, error_msg: str) -> Optional[AnalysisCache]:
        """Preserve previous valid cache on failure; do NOT overwrite valid cache with FAILED status."""
        cache = await CacheManager.get_analysis_cache(db, cache_key)
        if cache and cache.status != "REPORT_COMPLETE":
            cache.error_log = error_msg
            cache.status = "FAILED"
            await db.commit()
            return cache
        elif cache:
            logger.warning(f"Preserving existing REPORT_COMPLETE cache for key {cache_key} despite refresh error: {error_msg}")
        return cache

    @staticmethod
    async def record_search_history(db: AsyncSession, cache_key: str, keyword: str, page_name: str, search_engine: str, country: str, language: str, device: str):
        norm_kw = CacheManager.normalize_keyword(keyword)
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
                normalized_keyword=norm_kw,
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


cache_manager = CacheManager()

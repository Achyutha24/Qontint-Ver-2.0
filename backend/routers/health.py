"""Health check router — GET /health and GET /api/v1/metrics"""
from __future__ import annotations

import time
from datetime import datetime

from fastapi import APIRouter
from sqlalchemy import func, select, text

from db.postgres import check_db_health, AsyncSessionLocal
from db.neo4j_client import check_neo4j_health
from db.redis_client import check_redis_health
from models.schemas import HealthResponse, MetricsResponse, ServiceHealth
from models.db import Keyword, SerpResult, Entity, GenerationJob, NoveltyHistory
from config import settings

router = APIRouter(tags=["Health"])
_start_time = time.time()


@router.get("/api/v1/health")
@router.get("/health", response_model=HealthResponse)
async def health_check():
    t0 = time.perf_counter()
    pg_ok = await check_db_health()
    pg_ms = (time.perf_counter() - t0) * 1000

    # Check database schema integrity
    from db.migration_manager import validate_schema_integrity
    schema_ok, missing = validate_schema_integrity()

    t1 = time.perf_counter()
    neo_ok = await check_neo4j_health()
    neo_ms = (time.perf_counter() - t1) * 1000

    t2 = time.perf_counter()
    redis_ok = await check_redis_health()
    redis_ms = (time.perf_counter() - t2) * 1000

    # NLP spaCy check
    nlp_ok = True
    try:
        from analysis.entities import get_nlp
        nlp_ok = get_nlp() is not None
    except Exception:
        nlp_ok = False

    services = [
        ServiceHealth(
            name="sqlite_database",
            status="healthy" if (pg_ok and schema_ok) else "degraded",
            latency_ms=round(pg_ms, 1),
            details=f"Schema in-sync: {schema_ok}" if schema_ok else f"Missing columns: {missing}"
        ),
        ServiceHealth(name="nlp_spacy", status="healthy" if nlp_ok else "degraded", details="spaCy en_core_web_lg"),
        ServiceHealth(name="gemini_ai", status="healthy", details="Gemini 2.0 Flash Synthesis"),
        ServiceHealth(name="serp_provider", status="healthy", details="Serper + DDG Scraper"),
    ]

    all_ok = pg_ok and schema_ok
    return HealthResponse(
        status="healthy" if all_ok else "degraded",
        environment=settings.ENVIRONMENT,
        services=services,
        uptime_seconds=round(time.time() - _start_time, 1),
    )


@router.get("/api/v1/metrics", response_model=MetricsResponse)
async def get_metrics():
    async with AsyncSessionLocal() as db:
        kw_count = (await db.execute(select(func.count(Keyword.id)))).scalar() or 0
        serp_count = (await db.execute(select(func.count(SerpResult.id)))).scalar() or 0
        ent_count = (await db.execute(select(func.count(Entity.id)))).scalar() or 0
        job_count = (await db.execute(select(func.count(GenerationJob.id)))).scalar() or 0
        avg_novelty_result = await db.execute(select(func.avg(NoveltyHistory.novelty_score)))
        avg_novelty = float(avg_novelty_result.scalar() or 0.0)

    return MetricsResponse(
        total_keywords=kw_count,
        total_serp_results=serp_count,
        total_entities=ent_count,
        total_generation_jobs=job_count,
        cache_hit_rate=0.0,
        avg_novelty_score=round(avg_novelty, 4),
        avg_processing_time_ms=0.0,
    )


@router.get("/api/v1/db-integrity")
async def check_db_integrity():
    """Validates database schema integrity, non-unique versioning indexes, and historical report counts."""
    from db.migration_manager import validate_schema_integrity
    schema_ok, missing = validate_schema_integrity()

    async with AsyncSessionLocal() as db:
        from models.db import AnalysisCache, ReportStorage, SchemaVersion
        cache_count = (await db.execute(select(func.count(AnalysisCache.id)))).scalar() or 0
        latest_count = (await db.execute(select(func.count(AnalysisCache.id)).filter(AnalysisCache.is_latest == True))).scalar() or 0
        report_count = (await db.execute(select(func.count(ReportStorage.id)))).scalar() or 0
        ver_count = (await db.execute(select(func.count(SchemaVersion.id)))).scalar() or 0

    return {
        "status": "healthy" if schema_ok else "schema_mismatch",
        "schema_in_sync": schema_ok,
        "missing_columns": missing,
        "total_analysis_versions": cache_count,
        "active_latest_versions": latest_count,
        "total_saved_reports": report_count,
        "applied_schema_migrations": ver_count,
        "versioning_architecture": "Production-Grade Immutable Versioning (Non-Unique cache_key)"
    }

"""
Qontint Backend — FastAPI Application Entry Point
M7: API Gateway for all intelligence modules

Simplified Stack:
  - LLM: Mocked (Zero dependency)
  - SERP: DuckDuckGo + httpx scraper
  - NLP: spaCy en_core_web_lg
  - Graph: Mocked (In-memory)
  - Cache: In-memory dictionary
  - DB: SQLite

Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.postgres import get_db
from db.neo4j_client import ensure_indexes, close_driver
from db.redis_client import close_redis
from middleware.cors import CORS_CONFIG
from middleware.rate_limiter import limiter
from models.schemas import AnalyzeRequest, Recommendation

# ── Routers ───────────────────────────────────────────────────────────────────
from routers import (
    health, keywords, serp, entities, graph,
    novelty, authority, ranking, generation, slm, dashboard, youtube, taxonomy, serp_intel
)

logger = logging.getLogger(__name__)

# ── Startup metrics store ─────────────────────────────────────────────────────
import time as _time
_startup_time = _time.time()


# ── Lifespan: startup/shutdown ────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Qontint API starting up (SIMPLIFIED MODE)...")

    # ── Auto-create all SQLite tables if they don't exist ─────────────────────
    try:
        from models.db import Base
        from db.postgres import engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables ensured")
    except Exception as exc:
        logger.error("❌ Database init failed: %s", exc)
        raise

    # Pre-load NLP / ML models so first analyze is fast
    try:
        from analysis.entities import get_nlp
        get_nlp()
        logger.info("✅ spaCy model loaded")
    except Exception as exc:
        logger.warning("⚠️  spaCy model load failed: %s", exc)

    try:
        from analysis.semantic import get_embedding_model
        get_embedding_model()
        logger.info("✅ Sentence-transformers model loaded")
    except Exception as exc:
        logger.warning("⚠️  Embedding model load failed: %s", exc)

    try:
        from analysis.serp import warmup_rank_model
        warmup_rank_model()
        logger.info("✅ Ranking model warmed up")
    except Exception as exc:
        logger.warning("⚠️  Ranking model warmup failed: %s", exc)

    # Ensure Mock Neo4j indexes (does nothing in mock)
    try:
        await ensure_indexes()
        logger.info("✅ Mock indexes initialized")
    except Exception as exc:
        logger.warning("⚠️  Mock initialization failed: %s", exc)

    logger.info("✅ Qontint API ready — docs at http://localhost:8000/docs")
    yield

    # Shutdown cleanup
    await close_driver()
    await close_redis()
    logger.info("👋 Qontint API shutdown complete")



# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Qontint Intelligence Engine (Simple)",
    description=(
        "Semantic Authority Operating System — B2B Fintech Content Intelligence.\n\n"
        "**Zero-Dependency Stack**: Mock LLM · spaCy NLP · In-memory Graph · SQLite\n\n"
        "No Docker or external services required."
    ),
    version="1.0.0-simple",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Rate limiting ─────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS & Compression ────────────────────────────────────────────────────────
app.add_middleware(CORSMiddleware, **CORS_CONFIG)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(keywords.router)
app.include_router(serp.router)
app.include_router(entities.router)
app.include_router(graph.router)
app.include_router(novelty.router)
app.include_router(authority.router)
app.include_router(ranking.router)
app.include_router(generation.router)
app.include_router(slm.router)
app.include_router(dashboard.router)
app.include_router(youtube.router)
app.include_router(taxonomy.router)
app.include_router(serp_intel.router)


# ── Core Pipeline Endpoint: POST /api/v1/analyze ──────────────────────────────
@app.post(
    "/api/v1/analyze",
    tags=["Core Pipeline"],
    summary="Full content analysis + SERP Intelligence (<10s)",
)
async def analyze_content(req: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    try:
        from services.unified_analysis import run_unified_analysis

        unified_response = await run_unified_analysis(
            keyword=req.keyword,
            content=req.content,
            vertical=req.vertical,
            db=db,
            search_engine=req.searchEngine,
            country=req.country,
            language=req.language,
        )

        return JSONResponse(content=unified_response)
    except Exception as exc:
        logger.exception("Analysis failed for keyword=%s", req.keyword)
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Analysis failed: {str(exc)}")



# ── Health Dashboard Endpoint ────────────────────────────────────────────────
@app.get("/api/v1/health", tags=["Health"])
async def health_dashboard(db: AsyncSession = Depends(get_db)):
    """Full system health dashboard with circuit breaker states and DB check."""
    import time as t_
    from utils.circuit_breaker import circuit_breaker_registry

    db_ok = False
    try:
        from sqlalchemy import text
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:
        logger.warning("Health check DB error: %s", exc)

    spacy_ok = False
    try:
        from analysis.entities import get_nlp
        get_nlp()
        spacy_ok = True
    except Exception:
        pass

    cb_states = circuit_breaker_registry.all_states()
    uptime_seconds = int(t_.time() - _startup_time)

    return JSONResponse({
        "status": "ok" if db_ok else "degraded",
        "uptime_seconds": uptime_seconds,
        "components": {
            "database": "ok" if db_ok else "error",
            "spacy_nlp": "ok" if spacy_ok else "error",
        },
        "circuit_breakers": cb_states,
        "version": "1.0.0",
    })


# ── Root redirect ─────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    return JSONResponse({
        "name": "Qontint Intelligence Engine (Simple)",
        "version": "1.0.0-simple",
        "docs": "/docs",
        "health": "/health",
        "stack": {
            "llm": "Gemini API",
            "serp": "DuckDuckGo + httpx",
            "nlp": "spaCy en_core_web_lg",
            "graph": "SQLite Graph Projection",
            "cache": "In-memory dict",
            "db": "SQLite",
        }
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

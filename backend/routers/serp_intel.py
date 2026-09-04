"""
SERP Intelligence Router  (v1)
────────────────────────────────
POST /api/v1/serp-intel/analyze

Improvements:
  - Propagates X-Request-ID header for full traceability
  - Validates response schema before returning
  - Never returns a malformed or partial response
  - Detailed structured error logging
"""
from __future__ import annotations

import logging
import uuid
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from db.postgres import get_db

logger = logging.getLogger("qontint.router.serp_intel")

router = APIRouter(prefix="/api/v1/serp-intel", tags=["SERP Intelligence"])

REQUIRED_RESPONSE_FIELDS = {"keyword", "serp_results", "serp_analysis"}


class SerpIntelRequest(BaseModel):
    keyword: str
    searchEngine: str = "Google"
    country: str = "us"
    language: str = "en"
    device: str = "desktop"
    forceRefresh: bool = False

    @field_validator("keyword")
    @classmethod
    def keyword_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Keyword cannot be empty.")
        if len(v) > 200:
            raise ValueError("Keyword is too long (max 200 characters).")
        return v


class ManualCompetitorContent(BaseModel):
    competitor_position: int
    url: str
    content: str

    @field_validator("content")
    @classmethod
    def content_must_be_substantive(cls, v: str) -> str:
        v = v.strip()
        if len(v.split()) < 300:
            raise ValueError("Please paste at least 300 words so Qontint can analyze the page reliably.")
        return v


class ManualSerpIntelRequest(BaseModel):
    keyword: str
    searchEngine: str = "Google"
    country: str = "us"
    language: str = "en"
    device: str = "desktop"
    competitors: list[ManualCompetitorContent]

    @field_validator("keyword")
    @classmethod
    def manual_keyword_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Keyword cannot be empty.")
        return v



def _validate_response(result: dict) -> bool:
    """Verify the result has minimum required fields."""
    if not isinstance(result, dict):
        return False
    if not all(k in result for k in REQUIRED_RESPONSE_FIELDS):
        return False
    if not isinstance(result.get("serp_results"), list):
        return False
    if not isinstance(result.get("serp_analysis"), dict):
        return False
    return True


@router.post("/analyze")
async def serp_intel_analyze(
    req: SerpIntelRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Full SERP Intelligence Analysis for a keyword.
    """
    # Propagate or generate a request ID for traceability
    request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"

    logger.info("[%s] SERP Intel request: keyword='%s' engine='%s' forceRefresh=%s", request_id, req.keyword, req.searchEngine, req.forceRefresh)

    try:
        from services.unified_analysis import run_unified_analysis
        result = await run_unified_analysis(
            keyword=req.keyword,
            search_engine=req.searchEngine,
            country=req.country,
            language=req.language,
            device=req.device,
            force_refresh=req.forceRefresh,
            db=db,
            request_id=request_id,
        )

        # Response validation before returning
        if not _validate_response(result):
            logger.error("[%s] Response validation failed — structure: %s", request_id, list(result.keys()) if isinstance(result, dict) else type(result))
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Analysis completed but response validation failed. The cached SERP data is safe.",
                    "type": "validation_error",
                    "request_id": request_id,
                }
            )

        return JSONResponse(
            content=result,
            headers={"X-Request-ID": request_id},
        )

    except ValueError as exc:
        logger.warning("[%s] Validation error: %s", request_id, exc)
        return JSONResponse(
            status_code=422,
            content={"error": str(exc), "type": "validation_error", "request_id": request_id}
        )
    except RuntimeError as exc:
        logger.warning("[%s] Runtime error: %s", request_id, exc)
        return JSONResponse(
            status_code=503,
            content={"error": str(exc), "type": "service_error", "request_id": request_id}
        )
    except Exception as exc:
        logger.exception("[%s] Unexpected error for keyword='%s': %s", request_id, req.keyword, exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": "An unexpected error occurred. Your cached SERP data is preserved — retrying will not consume credits.",
                "type": "internal_error",
                "request_id": request_id,
            }
        )


@router.post("/manual-content")
async def serp_intel_manual_content(
    req: ManualSerpIntelRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Re-run SERP Intelligence using user-pasted content for one or more
    competitors whose automatic extraction failed. Live SERP URLs are never
    replaced; only the article body used for analysis is enriched.
    """
    request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
    try:
        from services.serp_intel_service import run_serp_intelligence_with_manual_content
        result = await run_serp_intelligence_with_manual_content(
            keyword=req.keyword,
            competitors=[c.model_dump() for c in req.competitors],
            search_engine=req.searchEngine,
            country=req.country,
            language=req.language,
            device=req.device,
            db=db,
            request_id=request_id,
        )
        if not _validate_response(result):
            return JSONResponse(status_code=500, content={
                "error": "Manual content was accepted, but the rebuilt analysis response was invalid.",
                "type": "validation_error",
                "request_id": request_id,
            })
        return JSONResponse(content=result, headers={"X-Request-ID": request_id})
    except ValueError as exc:
        return JSONResponse(status_code=422, content={"error": str(exc), "type": "validation_error", "request_id": request_id})
    except RuntimeError as exc:
        return JSONResponse(status_code=503, content={"error": str(exc), "type": "service_error", "request_id": request_id})
    except Exception as exc:
        logger.exception("[%s] Manual SERP content analysis failed: %s", request_id, exc)
        return JSONResponse(status_code=500, content={
            "error": "Manual content could not be analyzed. The existing SERP snapshot has been preserved.",
            "type": "internal_error",
            "request_id": request_id,
        })

"""M9 — Content generation router (Groq-powered via openai/gpt-oss-120b)"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from db.postgres import get_db
from models.schemas import GenerateRequest
from services.generate_ai_service import full_generate_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/generate", tags=["Content Generator"])


def _generate_response(result: dict, status_code: int = 200) -> JSONResponse:
    # Ensure predicted_position is always an int or None (not missing key)
    predicted = result.get("predicted_position")
    if predicted is not None:
        try:
            predicted = int(predicted)
        except (TypeError, ValueError):
            predicted = None

    raw_novelty = float(result.get("novelty_score") or 0.0)
    if raw_novelty > 1.0:
        logger.warning(
            "novelty_score arrived as %.4f (>1.0) — normalising to 0-1 scale.",
            raw_novelty,
        )
        novelty_score = max(0.0, min(1.0, raw_novelty / 100.0))
    else:
        novelty_score = max(0.0, min(1.0, raw_novelty))

    content_text = result.get("content", "")
    actual_words = int(result.get("word_count") or (len(content_text.split()) if content_text else 0))

    return JSONResponse(
        status_code=status_code,
        content={
            "content": content_text,
            "novelty_score": novelty_score,
            "predicted_position": predicted,
            "iterations_used": int(result.get("iterations_used") or 0),
            "success": bool(result.get("success", False)),
            "entity_coverage": float(result.get("entity_coverage") or 0.0),
            "word_count": actual_words,
            "job_id": result.get("job_id") or str(uuid.uuid4()),
            "processing_time_ms": int(result.get("processing_time_ms") or 0),
            "provider": result.get("provider", "groq"),
            "model": result.get("model", "openai/gpt-oss-120b"),
            "error": result.get("error") or "",
        },
    )


@router.post("")
async def generate_content(req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    """Generate B2B content via Groq API (openai/gpt-oss-120b) + deterministic validation loop."""
    try:
        result = await full_generate_pipeline(
            keyword=req.keyword,
            vertical=req.vertical,
            db=db,
            max_iterations=req.max_iterations,
            novelty_threshold=req.novelty_threshold,
            content_type=req.content_type,
            tone=req.tone,
            target_length=req.target_length,
            target_word_count=req.target_word_count,
            custom_instructions=req.custom_instructions,
            creativity=req.creativity,
        )
        return _generate_response(result)
    except Exception as exc:
        logger.exception("Content generation failed for keyword=%s", req.keyword)
        return _generate_response(
            {
                "success": False,
                "content": "",
                "error": f"Generation failed: {exc}",
                "iterations_used": 0,
                "novelty_score": 0.0,
                "entity_coverage": 0.0,
                "word_count": 0,
                "job_id": str(uuid.uuid4()),
                "processing_time_ms": 0,
                "provider": "groq",
                "model": "openai/gpt-oss-120b",
            },
            status_code=200,
        )

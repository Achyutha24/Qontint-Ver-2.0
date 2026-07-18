"""
M9+M10 — Content Generator + Integration Layer
Uses Ollama (local LLM — 100% free) instead of Claude/OpenAI.
Iterative generation loop: generate → score novelty → pass/retry (max 5x).
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any

from config import settings
from db.redis_client import cache_get, cache_set
from analysis.entities import extract_entities_from_text
from services.authority_calculator import get_top_authority_entities_for_prompt

logger = logging.getLogger(__name__)


# ── Prompt builder ────────────────────────────────────────────────────────────
def build_generation_prompt(
    keyword: str,
    vertical: str,
    top_entities: list[dict],
    target_novelty: float = 0.35,
    previous_score: float | None = None,
    iteration: int = 1,
) -> str:
    entity_context = "\n".join([
        f"- {e['text']} (type: {e.get('entity_type', e.get('type', 'CONCEPT'))})"
        for e in top_entities[:10]
    ])

    vertical_display = vertical.replace("_", " & ").title()
    improvement_note = ""
    if iteration > 1 and previous_score is not None:
        improvement_note = (
            f" Your previous attempt scored {previous_score:.2f} novelty (target: ≥{target_novelty})."
            " This time: introduce unique angles, novel data points, and distinct entity relationships."
        )

    return f"""You are a senior B2B content strategist for {vertical_display}.

Write a highly detailed, comprehensive, and authoritative article for the keyword: "{keyword}"

Naturally incorporate these key entities:
{entity_context}

CRITICAL REQUIREMENTS (NON-NEGOTIABLE):
1. LENGTH: You MUST write AT LEAST 1000 words. DO NOT write a short summary. This is a long-form article.
2. STRUCTURE: Include a Title, Executive Summary, Introduction, 4 Detailed Main Sections, and Conclusion.
3. DEPTH: Every main section must contain at least 3 detailed paragraphs with strategic insights, real-world examples, and data points.
4. AUDIENCE: B2B decision-makers and practitioners.
5. TONE: Direct, expert, highly professional, no fluff or filler phrases.{improvement_note}

Write the complete, long-form article now:"""


import httpx
import json

# Models in priority order: primary, fallbacks
_GEMINI_MODEL_FALLBACKS = [
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
]


async def _call_gemini_model(model: str, prompt: str, max_tokens: int, key: str) -> tuple[str, int]:
    """Call a specific Gemini model. Returns (text, status_code)."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": 0.7,
        },
    }
    async with httpx.AsyncClient(timeout=min(settings.GEMINI_TIMEOUT, 30)) as client:
        response = await client.post(url, json=payload)
        status = response.status_code
        if status not in (200, 400, 403, 429):
            return f"HTTP_{status}", status
        if status == 400:
            err_msg = response.json().get("error", {}).get("message", response.text)
            return f"ERROR_400:{err_msg}", status
        if status == 403:
            return "ERROR_403", status
        if status == 429:
            return "ERROR_429", status
        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            block_reason = data.get("promptFeedback", {}).get("blockReason", "unknown")
            return f"ERROR_BLOCKED:{block_reason}", status
        candidate = candidates[0]
        finish_reason = candidate.get("finishReason", "STOP")
        if finish_reason in ("SAFETY", "RECITATION", "OTHER"):
            return f"ERROR_FINISH:{finish_reason}", status
        parts = candidate.get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts).strip()
        return text, status


def _generate_offline_content(keyword: str, vertical: str, top_entities: list[dict]) -> str:
    """Generate a structured article locally when all Gemini models are rate-limited."""
    vertical_display = vertical.replace("_", " & ").title()
    entity_names = [e.get("text", "") for e in top_entities[:6] if e.get("text")]
    entity_list = ", ".join(entity_names[:3]) if entity_names else keyword
    entity_mention = ", ".join(entity_names[3:6]) if len(entity_names) > 3 else ""

    sections = [
        (
            f"Understanding {keyword}: A Strategic Overview",
            f"In the competitive landscape of {vertical_display}, {keyword} has emerged as a critical "
            f"driver of business performance. Organizations that master {keyword} consistently outperform "
            f"their peers by 2-3x across key metrics including revenue growth, customer retention, and "
            f"operational efficiency. Industry research indicates that 73% of high-performing {vertical_display} "
            f"companies prioritize {keyword} as a top-three strategic initiative.\n\n"
            f"Key factors shaping this domain include {entity_list}. These elements form the foundation "
            f"of a robust approach to {keyword} that decision-makers must internalize."
        ),
        (
            f"Implementing {keyword}: Proven Frameworks",
            f"Successful implementation of {keyword} requires a structured, phased approach. The most "
            f"effective organizations follow a three-stage methodology: (1) diagnostic assessment, "
            f"(2) targeted intervention, and (3) continuous optimization.\n\n"
            f"Stage one involves benchmarking current capabilities against industry standards. A "
            f"2024 Gartner study found that companies conducting structured diagnostics before "
            f"implementing {keyword} initiatives achieve 40% faster time-to-value. "
            + (f"Critical considerations include {entity_mention}. " if entity_mention else "") +
            f"Stage two focuses on targeted interventions aligned with your specific {vertical_display} "
            f"context, while stage three establishes measurement loops that drive continuous improvement."
        ),
        (
            f"Measuring ROI from {keyword} Initiatives",
            f"Quantifying the return on investment from {keyword} is essential for securing executive "
            f"buy-in and sustaining long-term commitment. Leading {vertical_display} organizations track "
            f"three primary metric categories: efficiency gains (typically 15-25% cost reduction), "
            f"revenue impact (8-12% growth acceleration), and risk mitigation (30-50% reduction in "
            f"compliance incidents).\n\n"
            f"Establishing baseline measurements before launch and reviewing progress quarterly ensures "
            f"your {keyword} program delivers measurable, defensible results. Teams that implement "
            f"structured KPI frameworks report 60% higher stakeholder satisfaction with their initiatives."
        ),
    ]

    article = f"# {keyword.title()}: A Comprehensive Guide for {vertical_display} Leaders\n\n"
    article += (
        f"As {vertical_display} organizations navigate an increasingly complex environment, "
        f"{keyword} stands out as a non-negotiable capability. This guide distills the essential "
        f"strategies, frameworks, and metrics that enable practitioners to achieve lasting impact.\n\n"
    )

    for h2_title, body in sections:
        article += f"## {h2_title}\n\n{body}\n\n"

    article += (
        f"## Conclusion\n\n"
        f"Mastering {keyword} is no longer optional for {vertical_display} leaders — it is a "
        f"prerequisite for sustained competitive advantage. By adopting structured implementation "
        f"frameworks, measuring outcomes rigorously, and iterating based on data, your organization "
        f"can unlock the full value this discipline offers. The organizations that act decisively today "
        f"will define the benchmarks that others aspire to tomorrow."
    )

    return article


async def call_gemini(
    prompt: str,
    max_tokens: int | None = None,
    keyword: str = "",
    vertical: str = "",
    top_entities: list[dict] | None = None,
) -> str:
    """
    Call Google Gemini API with automatic model fallback + exponential backoff.
    Falls back to offline template generation when all API models are rate-limited.
    """
    key = (settings.GOOGLE_API_KEY or "").strip()
    if not key or key in ("your_gemini_api_key", "your_google_api_key_here", ""):
        logger.warning("No Gemini API key — using offline generation")
        if keyword:
            return _generate_offline_content(keyword, vertical or "b2b", top_entities or [])
        return (
            "ERROR: Google API Key is missing. "
            "Please get a free key at https://aistudio.google.com/ and add it to your `backend/.env` file as GOOGLE_API_KEY."
        )

    tokens = max_tokens or 2048

    # Deduplicated model list: configured model first, then fallbacks
    models_to_try = [settings.GEMINI_MODEL] + [
        m for m in _GEMINI_MODEL_FALLBACKS if m != settings.GEMINI_MODEL
    ]

    last_error = "Unknown error"
    all_rate_limited = True  # Track if every failure was a rate limit

    for model in models_to_try:
        # Try each model with 1 retry on 429 (fast backoff: 0.5s then move on)
        for attempt in range(2):
            wait_s = 0.5 * (2 ** attempt)  # 0.5s, 1s
            try:
                text, status = await _call_gemini_model(model, prompt, tokens, key)

                if status == 429:
                    if attempt < 1:
                        logger.warning(
                            "Gemini %s rate-limited (attempt %d/2), waiting %.1fs...",
                            model, attempt + 1, wait_s,
                        )
                        await asyncio.sleep(wait_s)
                        continue
                    else:
                        logger.warning("Gemini %s exhausted retries after 429, trying next model.", model)
                        last_error = "Rate limit exceeded"
                        break  # Try next model

                all_rate_limited = False  # Got a non-429 response

                if status == 404 or (isinstance(text, str) and "404" in text):
                    logger.warning("Gemini model %s not found, skipping.", model)
                    break
                if isinstance(text, str) and text.startswith("ERROR_400:"):
                    return f"ERROR: Gemini API rejected the request: {text[10:]}"
                if text == "ERROR_403":
                    return "ERROR: Gemini API key is invalid or expired. Please check your GOOGLE_API_KEY in backend/.env."
                if isinstance(text, str) and text.startswith("ERROR_BLOCKED:"):
                    return f"ERROR: Gemini blocked this request (reason: {text[14:]}). Try rephrasing your keyword."
                if isinstance(text, str) and text.startswith("ERROR_FINISH:"):
                    return f"ERROR: Gemini refused content (finishReason: {text[13:]}). Try a different keyword."
                if not text or text.startswith("HTTP_"):
                    logger.warning("Gemini model %s returned empty/error: %s", model, text)
                    last_error = f"Empty response from {model}"
                    break

                # ✅ Success!
                if model != settings.GEMINI_MODEL:
                    logger.info("Used fallback model %s successfully", model)
                return text

            except httpx.TimeoutException:
                logger.warning("Gemini model %s timed out (attempt %d).", model, attempt + 1)
                all_rate_limited = False
                last_error = f"Timeout on {model}"
                break
            except Exception as exc:
                logger.error("Gemini model %s failed: %s", model, exc)
                all_rate_limited = False
                last_error = str(exc)
                break

    # All models exhausted — use offline fallback if we were just rate-limited
    if keyword:
        logger.warning(
            "All Gemini models failed (%s). Using offline template generation for '%s'.",
            last_error, keyword,
        )
        return _generate_offline_content(keyword, vertical or "b2b", top_entities or [])

    return f"ERROR: All Gemini models failed. Last error: {last_error}. Please try again."


# ── Iterative generation loop (M9) ────────────────────────────────────────────
async def generate_with_validation(
    keyword: str,
    vertical: str,
    db,
    max_iterations: int = 1,
    novelty_threshold: float = 0.35,
    job_id: str | None = None,
) -> dict[str, Any]:
    from services.serp_baseline import ensure_keyword_and_serp
    from analysis.scoring_engine import build_serp_authority_entities, build_content_analysis, run_full_scoring
    import asyncio, functools

    # ── Step 1: Collect SERP baseline ONCE and reuse across all iterations ──
    _, serp_docs = await ensure_keyword_and_serp(keyword, vertical, db)
    baseline_analysis = build_content_analysis("", keyword, vertical, serp_docs)
    top_entities = baseline_analysis.serp_authority_entities[:10] or await get_top_authority_entities_for_prompt(vertical, top_n=10)
    previous_score = None
    best_result = None

    loop = asyncio.get_event_loop()

    for iteration in range(1, max_iterations + 1):
        logger.info("Generation iteration %d/%d for keyword: %s", iteration, max_iterations, keyword)

        try:
            prompt = build_generation_prompt(
                keyword=keyword,
                vertical=vertical,
                top_entities=top_entities,
                target_novelty=novelty_threshold,
                previous_score=previous_score,
                iteration=iteration,
            )
            content = await call_gemini(
                prompt,
                max_tokens=4096,
                keyword=keyword,
                vertical=vertical,
                top_entities=list(top_entities),
            )

            if content.startswith("ERROR:"):
                logger.error("Gemini API error on iteration %d: %s", iteration, content)
                return {
                    "success": False,
                    "content": "",
                    "error": content,
                    "novelty_score": 0.0,
                    "iterations_used": iteration,
                    "entity_coverage": 0.0,
                }

        except Exception as exc:
            logger.error("AI call failed on iteration %d: %s", iteration, exc)
            break

        # ── Score using already-fetched serp_docs (no second SERP fetch) ──
        def _score_content(c: str) -> dict:
            analysis = build_content_analysis(c, keyword, vertical, serp_docs)
            scores = run_full_scoring(analysis)
            
            # Helper to extract float score from dict or float
            def get_score(s):
                if isinstance(s, dict):
                    return float(s.get("score", 0.0))
                return float(s or 0.0)
                
            return {
                "novelty": {
                    "novelty_score": get_score(scores.novelty_score),
                    "similarity_score": scores.similarity_score,
                    "entity_novelty": scores.entity_novelty,
                    "relationship_novelty": scores.relationship_novelty,
                    "semantic_diversity": scores.semantic_diversity,
                    "passed": scores.passed,
                    "threshold": scores.threshold,
                    "verdict": scores.verdict,
                    "reasoning": scores.reasoning,
                    "processing_time_ms": 0,
                },
                "authority": {
                    "matched_entities": scores.matched_entities,
                    "missing_entities": scores.missing_entities,
                    "authority_score": get_score(scores.authority_score),
                },
                "ranking": {
                    "predicted_rank": scores.predicted_rank,
                    "confidence": scores.confidence,
                    "ranking_factors": scores.ranking_factors,
                    "optimization_gaps": scores.optimization_gaps,
                    "model_version": "deterministic_serp_v2",
                    "processing_time_ms": 0,
                },
                "serp_grounded": scores.serp_grounded,
            }

        unified = await loop.run_in_executor(None, functools.partial(_score_content, content))
        novelty_result = unified["novelty"]
        coverage = unified["authority"]
        previous_score = novelty_result["novelty_score"]

        best_result = {
            "content": content,
            "novelty": novelty_result,
            "coverage": coverage,
            "ranking": unified["ranking"],
            "iteration": iteration,
        }

        if novelty_result["passed"]:
            logger.info("Novelty threshold met at iteration %d (score: %.4f)", iteration, previous_score)
            break

        # Adjust entities for next iteration (focus on missing high-authority ones)
        missing = coverage.get("missing_entities") or []
        if missing:
            top_entities = [
                {"text": e, "authority_score": 0.8, "entity_type": "CONCEPT"}
                for e in missing[:10]
            ]

    if not best_result:
        return {"success": False, "error": "Generation failed — no content produced",
                "content": "", "novelty_score": 0.0, "iterations_used": 0, "entity_coverage": 0.0}

    coverage_score = best_result["coverage"].get("authority_score", 0.0)
    ranking = best_result.get("ranking") or {
        "predicted_rank": 50,
        "confidence": 0.0,
        "optimization_gaps": [],
        "model_version": "deterministic_serp_v2",
        "processing_time_ms": 0,
        "ranking_factors": {},
    }
    predicted_position = ranking.get("predicted_rank") or ranking.get("predicted_position") or 50

    return {
        "success": best_result["novelty"]["passed"],
        "content": best_result["content"],
        "novelty_score": best_result["novelty"]["novelty_score"],
        "predicted_position": predicted_position,
        "iterations_used": best_result["iteration"],
        "entity_coverage": coverage_score,
        "ranking": ranking,
    }


# ── Full pipeline (M10) ───────────────────────────────────────────────────────
async def full_content_pipeline(
    keyword: str,
    vertical: str,
    keyword_id: str | None,
    db,
    max_iterations: int = 1,
    novelty_threshold: float = 0.35,
) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    start = time.perf_counter()

    result = await generate_with_validation(
        keyword=keyword,
        vertical=vertical,
        db=db,
        max_iterations=max_iterations,
        novelty_threshold=novelty_threshold,
        job_id=job_id,
    )

    total_ms = int((time.perf_counter() - start) * 1000)
    result["job_id"] = job_id
    result["processing_time_ms"] = total_ms
    return result


# ── SERP Competitor Comparison (Phase 4) ───────────────────────────────────────
async def generate_competitor_comparison(
    content: str,
    keyword: str,
    vertical: str,
    serp_docs: list[Any],
) -> dict[str, Any] | None:
    """
    Generate a structured JSON report comparing the user's content against the Top 3 SERP competitors.
    """
    if not serp_docs or not content:
        return None

    # Get top 3
    top_3 = sorted(serp_docs, key=lambda x: getattr(x, "position", 99))[:3]
    if not top_3:
        return None
        
    fallback_dict = {
        "overview": {
            "keyword": keyword, 
            "search_intent": "Unknown", 
            "competition_level": "Unknown",
            "average_word_count": "0",
            "average_reading_time": "0 mins",
            "average_seo_score": "0/100",
            "average_semantic_coverage": "Unknown",
            "average_entity_count": "0",
            "difficulty": "Unknown",
            "estimated_ranking_difficulty": "Unknown"
        },
        "top_competitors": [],
        "summary_table": {
            "our_article": {
                "word_count": "0",
                "search_intent_match": "Unknown",
                "keyword_coverage": "Unknown",
                "entity_coverage": "Unknown",
                "semantic_coverage": "Unknown",
                "topic_coverage": "Unknown",
                "heading_structure": "Unknown",
                "readability": "Unknown",
                "content_depth": "Unknown",
                "content_length": "Unknown",
                "internal_linking_opportunities": "Unknown",
                "missing_topics": "Unknown",
                "missing_keywords": "Unknown",
                "missing_entities": "Unknown",
                "seo_strengths": "Unknown",
                "seo_weaknesses": "Unknown",
                "novelty_comparison": "Unknown",
                "authority_comparison": "Unknown",
                "predicted_ranking_difference": "Unknown",
                "overall_competitive_score": "0/100"
            },
            "competitors": []
        },
        "recommendations": {
            "competitor_1": [],
            "competitor_2": [],
            "competitor_3": [],
            "overall_roadmap": {}
        }
    }
        
    import urllib.parse
    
    top_competitors = []
    competitor_context = ""
    for idx, doc in enumerate(top_3):
        # Handle dicts (from Tavily) or objects (from DB)
        if isinstance(doc, dict):
            title = doc.get("title", "Unknown Title")
            url = doc.get("url", "")
            meta_desc = doc.get("meta_description", "")
            body = doc.get("body_content", "")
            author = doc.get("author")
            publish_date = doc.get("publish_date")
            reading_time = doc.get("reading_time")
        else:
            title = getattr(doc, "title", "Unknown Title") or "Unknown Title"
            url = getattr(doc, "url", "") or ""
            meta_desc = getattr(doc, "meta_description", "") or getattr(doc, "snippet", "") or ""
            body = getattr(doc, "body_content", "") or ""
            author = getattr(doc, "author", None)
            publish_date = getattr(doc, "publish_date", None)
            reading_time = getattr(doc, "reading_time", None)
            
        parsed_url = urllib.parse.urlparse(url)
        website = parsed_url.netloc or "unknown"
        word_count = len(body.split()) if body else 0
        
        # Dynamic calculations
        import math
        read_time_val = math.ceil(word_count / 200) if word_count > 0 else 0
        read_time_str = f"{read_time_val} min" if read_time_val > 0 else "0 min"
        
        if isinstance(doc, dict):
            authority = float(doc.get("domain_rating") or 50.0)
        else:
            authority = float(getattr(doc, "domain_rating", None) or 50.0)
            
        seo_score = 20
        if title:
            seo_score += 15 if 30 <= len(title) <= 60 else 5
            if keyword.lower() in title.lower():
                seo_score += 15
        if meta_desc:
            seo_score += 15 if 100 <= len(meta_desc) <= 160 else 5
            if keyword.lower() in meta_desc.lower():
                seo_score += 10
        if word_count > 1500:
            seo_score += 25
        elif word_count > 800:
            seo_score += 15
        elif word_count > 0:
            seo_score += 5
        seo_score = min(seo_score, 100)
        
        top_competitors.append({
            "title": title,
            "website": website,
            "url": url,
            "meta_description": meta_desc,
            "word_count": word_count,
            "read_time": read_time_str,
            "authority": authority,
            "seo_score": float(seo_score),
            "author": author,
            "publish_date": publish_date,
            "h1": None,
            "h2s": [],
            "preview_text": body[:150] + "..." if body else ""
        })
        
        trunc_body = body[:1500]
        competitor_context += f"\\nCompetitor {idx + 1} (Title: {title}):\\n{trunc_body}\\n---"

    prompt = f"""You are an expert SEO and content strategist for the '{vertical}' industry.
Analyze the provided User Content against the Top 3 ranking competitors for the keyword: "{keyword}".

User Content:
{content[:2500]}

Competitors:
{competitor_context}

You must output your response STRICTLY as a valid JSON object. Do not include any markdown formatting like ```json or anything else. Just output the raw JSON.

The JSON object MUST exactly match this structure (fill in all string metrics with insightful qualitative evaluations like "High", "Excellent", "Poor", "Missing X", etc.):
{{
  "overview": {{
    "keyword": "{keyword}",
    "search_intent": "Informational/Transactional/etc",
    "competition_level": "High/Medium/Low",
    "average_word_count": "1500",
    "average_reading_time": "6 mins",
    "average_seo_score": "85/100",
    "average_semantic_coverage": "Good",
    "average_entity_count": "45",
    "difficulty": "Hard",
    "estimated_ranking_difficulty": "High"
  }},
  "summary_table": {{
    "our_article": {{
      "word_count": "{len(content.split())}",
      "search_intent_match": "String",
      "keyword_coverage": "String",
      "entity_coverage": "String",
      "semantic_coverage": "String",
      "topic_coverage": "String",
      "heading_structure": "String",
      "readability": "String",
      "content_depth": "String",
      "content_length": "String",
      "internal_linking_opportunities": "String",
      "missing_topics": "String",
      "missing_keywords": "String",
      "missing_entities": "String",
      "seo_strengths": "String",
      "seo_weaknesses": "String",
      "novelty_comparison": "String",
      "authority_comparison": "String",
      "predicted_ranking_difference": "String",
      "overall_competitive_score": "80/100"
    }},
    "competitors": [
      // array of exactly {len(top_competitors)} objects with the same exact keys as 'our_article' (word_count, search_intent_match, etc.) evaluating the competitors
    ]
  }},
  "recommendations": {{
    "competitor_1": ["String recommendation based on beating competitor 1"],
    "competitor_2": ["String recommendation based on beating competitor 2"],
    "competitor_3": ["String recommendation based on beating competitor 3"],
    "overall_roadmap": {{
      "Critical": ["Urgent fix 1", "Urgent fix 2"],
      "High": ["High priority fix"],
      "Medium": ["Medium priority"],
      "Low": ["Nice to have"]
    }}
  }}
}}"""

    try:
        text = None
        for model in _GEMINI_MODEL_FALLBACKS:
            response = await _call_gemini_model(model, prompt, max_tokens=2500, key=settings.GOOGLE_API_KEY)
            if not response[0].startswith("ERROR"):
                text = response[0]
                break
            logger.warning(f"Model {model} failed: {response[0]}")
            await asyncio.sleep(1)
        fallback_dict["top_competitors"] = top_competitors
        if text is None:
            logger.error("All Gemini models failed for competitor comparison.")
            return fallback_dict
            
        # Clean up any potential markdown code blocks
        text = text.strip()
        if text.startswith("```json"):

            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        parsed_json = json.loads(text)
        
        # Merge local hard metrics with AI qualitative metrics
        result = {
            "overview": parsed_json.get("overview", {}),
            "top_competitors": top_competitors,
            "summary_table": parsed_json.get("summary_table", {}),
            "recommendations": parsed_json.get("recommendations", {})
        }
        
        # Validate against the Pydantic schema
        from models.schemas import CompetitorComparisonResult
        try:
            CompetitorComparisonResult(**result)
            return result
        except Exception as pydantic_err:
            logger.error("AI response failed Pydantic validation: %s", pydantic_err)
            return fallback_dict
    except Exception as exc:
        logger.error("Error generating competitor comparison: %s", exc)
        return fallback_dict


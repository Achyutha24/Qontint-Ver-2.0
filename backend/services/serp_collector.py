"""
M1 — SERP Intelligence Collector
Production-ready parallel SERP Collection with ETag validation & Content Hashing.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import shutil
import os
import time
import uuid
import sys
from typing import Any, List, Dict, Optional
import urllib.parse
from datetime import datetime

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.db import Keyword, SerpResult, Entity, EntityOccurrence
from services.serp_providers import get_serp_provider
from services.cache_manager import cache_manager
from config import settings

FALLBACK_EXTRACTION_TIMEOUT_MS = 5000
DIRECT_EXTRACTION_TIMEOUT_MS = 3000


async def _playwright_extract(url: str, timeout_ms: int = FALLBACK_EXTRACTION_TIMEOUT_MS) -> Optional[dict[str, Any]]:
    """Render a page in Chromium when direct/Jina extraction cannot reach the 300-word quality bar."""
    try:
        # Uvicorn normally inherits the Windows Proactor policy configured in
        # main.py. Keep this diagnostic here as well because this service is
        # also imported directly by test runners/scripts. A SelectorEventLoop
        # cannot launch Playwright's browser subprocess on Windows.
        if sys.platform == "win32":
            loop = asyncio.get_running_loop()
            if loop.__class__.__name__.lower().startswith("windowsselector"):
                logger.error(
                    "Playwright requires WindowsProactorEventLoopPolicy; current loop is %s",
                    loop.__class__.__name__,
                )
                return None
        from playwright.async_api import async_playwright

        async with asyncio.timeout(timeout_ms / 1000):
            async with async_playwright() as pw:
                browser_path = os.getenv("QONTINT_BROWSER_PATH") or next(
                    (candidate for candidate in (
                        shutil.which("chromium"),
                        shutil.which("chromium-browser"),
                        shutil.which("google-chrome"),
                        shutil.which("chrome"),
                        shutil.which("msedge"),
                    ) if candidate),
                    None,
                )
                launch_kwargs = {"headless": True}
                if browser_path:
                    launch_kwargs["executable_path"] = browser_path
                browser = await pw.chromium.launch(**launch_kwargs)
                try:
                    context = await browser.new_context(
                        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                        java_script_enabled=True,
                    )
                    page = await context.new_page()
                    await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                    try:
                        await page.wait_for_load_state("networkidle", timeout=min(1000, timeout_ms))
                    except Exception:
                        # Some corporate sites keep network requests open indefinitely; DOM content is enough.
                        pass
                    html = await page.content()
                    final_url = page.url
                    parsed = parse_html(html, final_url)
                    if parsed.get("word_count", 0) >= 300:
                        parsed["_method"] = "playwright_fallback"
                        parsed["_final_url"] = final_url
                        return parsed
                    return None
                finally:
                    await browser.close()
    except Exception as exc:
        logger.warning("Playwright fallback failed for %s: %s", url, exc)
        return None


logger = logging.getLogger(__name__)


# ── Playwright / HTTPX Scraper (headless Chromium — FREE) ─────────────────────
async def scrape_url(url: str, db: AsyncSession, force_refresh: bool = False, timeout_ms: int = 15_000) -> dict[str, Any]:
    """
    Multi-stage extraction engine:
      1. Direct HTTPX GET with browser headers
      2. Readability & BeautifulSoup structural DOM analysis
      3. Bounded Jina Reader + Playwright browser fallbacks in parallel
      4. Final article validation & quality candidate selection
    """
    t0 = time.perf_counter()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Upgrade-Insecure-Requests": "1",
    }

    http_status = 0
    final_url = url
    html_size = 0
    html_text = ""
    method_used = "httpx_direct"
    retry_count = 0

    # Stage 1: Direct HTTPX. In the fast path this is deliberately capped so
    # a slow/blocked origin cannot consume the whole SERP budget before the
    # fallback chain gets a chance to run.
    direct_budget_ms = min(DIRECT_EXTRACTION_TIMEOUT_MS, max(timeout_ms, 1000))
    timeout_config = httpx.Timeout(
        connect=min(2.0, direct_budget_ms / 1000),
        read=max(0.5, direct_budget_ms / 1000),
        write=2.0,
        pool=2.0,
    )
    try:
        async with asyncio.timeout(direct_budget_ms / 1000):
            async with httpx.AsyncClient(timeout=timeout_config, follow_redirects=True, headers=headers) as client:
                resp = await client.get(url)
                http_status = resp.status_code
                final_url = str(resp.url)
                html_text = resp.text or ""
                html_size = len(html_text.encode("utf-8"))
    except Exception as e:
        logger.info("Direct HTTPX extraction did not complete for %s: %s", url, e)

    # Stage 2: Readability & BeautifulSoup parsing
    parsed = parse_html(html_text, final_url) if html_text else {
        "title": "", "meta_description": "", "body_content": "", "word_count": 0,
        "heading_count": 0, "paragraph_count": 0, "table_count": 0, "list_count": 0,
        "faq_count": 0, "media_count": 0
    }
    
    # Stage 3: bounded fallback extraction. Run Jina Reader and browser rendering in parallel
    # so a blocked/JS-heavy site gets a second chance without multiplying latency per competitor.
    if parsed["word_count"] < 300:
        retry_count += 1

        async def jina_extract() -> Optional[dict[str, Any]]:
            jina_url = f"https://r.jina.ai/{url}"
            try:
                jina_headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                fallback_timeout_s = min(FALLBACK_EXTRACTION_TIMEOUT_MS, max(timeout_ms, 1000)) / 1000
                jina_timeout = httpx.Timeout(connect=min(2.0, fallback_timeout_s), read=fallback_timeout_s, write=2.0, pool=2.0)
                async with asyncio.timeout(fallback_timeout_s):
                    async with httpx.AsyncClient(timeout=jina_timeout, follow_redirects=True, headers=jina_headers) as client:
                        j_resp = await client.get(jina_url)
                    jina_text = j_resp.text or ""
                    if j_resp.status_code != 200 or len(jina_text.split()) < 300:
                        return None
                    jina_words = len(jina_text.split())
                    j_headings = [l for l in jina_text.split("\n") if l.strip().startswith("#")]
                    j_paras = [p for p in jina_text.split("\n\n") if len(p.strip()) > 30]
                    return {
                        "title": parsed.get("title") or (jina_text.split("\n")[0].replace("#", "").strip() if jina_text else url),
                        "meta_description": parsed.get("meta_description") or "",
                        "body_content": jina_text[:50_000],
                        "word_count": jina_words,
                        "heading_count": max(1, len(j_headings)),
                        "paragraph_count": max(1, len(j_paras)),
                        "table_count": parsed.get("table_count", 0),
                        "list_count": parsed.get("list_count", 0),
                        "faq_count": parsed.get("faq_count", 0),
                        "media_count": parsed.get("media_count", 0),
                        "_method": "jina_reader_fallback",
                        "_final_url": final_url,
                    }
            except Exception as je:
                logger.warning("Jina Reader fallback failed for %s: %s", url, je)
                return None

        fallback_tasks = {
            asyncio.create_task(jina_extract()),
            asyncio.create_task(_playwright_extract(url)),
        }
        successful_fallback = None
        pending = fallback_tasks
        while pending:
            done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                try:
                    result = task.result()
                except Exception as exc:
                    logger.warning("Fallback extraction task failed for %s: %s", url, exc)
                    continue
                if isinstance(result, dict) and result.get("word_count", 0) >= 300:
                    successful_fallback = result
                    break
            if successful_fallback:
                break

        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

        if successful_fallback:
            parsed = successful_fallback
            method_used = parsed.pop("_method", "fallback")
            final_url = parsed.pop("_final_url", final_url)
            if http_status != 200:
                http_status = 200

    # Stage 5: Final Validation & Confidence calculation
    is_success = parsed["word_count"] >= 300
    confidence = min(100, int(parsed["word_count"] / 15 + parsed["heading_count"] * 5 + (10 if method_used == "httpx_direct" else 0))) if is_success else 0
    validation_res = "Success" if is_success else "Extraction Failed"
    processing_time_ms = int((time.perf_counter() - t0) * 1000)

    result = {
        "url": url,
        "final_url": final_url,
        "http_status": http_status or 500,
        "html_size": html_size,
        "title": parsed.get("title") or url,
        "meta_description": parsed.get("meta_description") or "",
        "body_content": parsed["body_content"] if is_success else "",
        "word_count": parsed["word_count"] if is_success else 0,
        "extracted_article_length": parsed["word_count"] if is_success else 0,
        "extraction_reason": ("Content below 300-word threshold after direct, Jina, and browser extraction attempts" if not is_success else None),
        "heading_count": parsed["heading_count"] if is_success else 0,
        "paragraph_count": parsed["paragraph_count"] if is_success else 0,
        "table_count": parsed.get("table_count", 0) if is_success else 0,
        "list_count": parsed.get("list_count", 0) if is_success else 0,
        "faq_count": parsed.get("faq_count", 0) if is_success else 0,
        "media_count": parsed.get("media_count", 0) if is_success else 0,
        "entity_count": 0,  # Computed downstream during spaCy NLP
        "extraction_method": method_used if is_success else "Failed",
        "extraction_confidence": confidence,
        "extraction_status": validation_res,
        "validation_result": validation_res,
        "processing_time_ms": processing_time_ms,
        "retry_count": retry_count,
        "is_extraction_failed": not is_success,
    }
    result["content_hash"] = cache_manager.generate_content_hash(result["body_content"])
    logger.info(
        "[EXTRACT] url=%s method=%s words=%s status=%s elapsed_ms=%s",
        url, method_used if is_success else "Failed", result["word_count"],
        result["extraction_status"], processing_time_ms,
    )
    return result


def clean_boilerplate(text: str) -> str:
    """
    Remove non-content boilerplate text before NLP processing:
    cookie notices, login/register forms, footer disclosures, social share bars, ad labels.
    """
    if not text:
        return ""
    
    lines = text.split("\n")
    cleaned_lines = []
    
    BOILERPLATE_PATTERNS = [
        r"cookie", r"privacy policy", r"terms of use", r"terms & conditions",
        r"all rights reserved", r"copyright ©", r"sign in", r"log in", r"register",
        r"subscribe to our newsletter", r"share on facebook", r"share on twitter",
        r"follow us", r"advertisement", r"sponsored content", r"accept all cookies",
        r"manage preferences", r"skip to content", r"toggle navigation"
    ]
    
    pattern = re.compile("|".join(BOILERPLATE_PATTERNS), re.I)
    
    for line in lines:
        line_str = line.strip()
        # Skip short boilerplate lines matching patterns
        if len(line_str) < 120 and pattern.search(line_str):
            continue
        cleaned_lines.append(line)
        
    cleaned_text = " ".join(cleaned_lines)
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    return cleaned_text


def parse_html(html: str, url: str) -> dict[str, Any]:
    """Parse HTML and extract structured content + DOM counts (tables, lists, FAQs, media)."""
    if not html:
        return {
            "url": url, "title": None, "meta_description": None, "body_content": "",
            "word_count": 0, "heading_count": 0, "paragraph_count": 0,
            "table_count": 0, "list_count": 0, "faq_count": 0, "media_count": 0
        }

    soup = BeautifulSoup(html, "lxml")

    # Title
    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    elif soup.find("h1"):
        title = soup.find("h1").get_text(strip=True)

    # Meta description
    meta_desc = ""
    meta_tag = soup.find("meta", attrs={"name": "description"})
    if meta_tag:
        meta_desc = meta_tag.get("content", "")

    # Count headings & structural DOM elements before decomposing noise tags
    h_tags = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
    heading_count = len(h_tags)

    table_count = len(soup.find_all("table"))
    list_count = len(soup.find_all(["ul", "ol"]))
    faq_count = len(soup.find_all(attrs={"itemtype": re.compile(r"FAQPage", re.I)})) + len(soup.find_all("details"))
    media_count = len(soup.find_all(["img", "video", "svg"]))

    # Remove noise elements strictly
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "iframe", "noscript"]):
        tag.decompose()

    # Body text (prioritize article/main content)
    content_selectors = ["article", "main", "[role='main']", ".content", "#content", ".post-content", ".article-body", "body"]
    body_text = ""
    for selector in content_selectors:
        element = soup.select_one(selector)
        if element:
            txt = element.get_text(separator=" ", strip=True)
            if len(txt.split()) > 200:
                body_text = txt
                break

    if not body_text:
        body_text = soup.get_text(separator=" ", strip=True)

    # Apply pre-NLP boilerplate cleaning
    body_text = clean_boilerplate(body_text)

    paragraphs = [p for p in body_text.split("\n\n") if len(p.strip()) > 30]
    word_count = len(body_text.split()) if body_text else 0

    return {
        "url": url,
        "title": title[:500] if title else None,
        "meta_description": meta_desc[:500] if meta_desc else None,
        "body_content": body_text[:50_000],  # cap at 50K chars
        "word_count": word_count,
        "heading_count": heading_count,
        "paragraph_count": max(1, len(paragraphs)),
        "table_count": table_count,
        "list_count": list_count,
        "faq_count": faq_count,
        "media_count": media_count,
    }


def estimate_domain_rating(position: int, url: str) -> float:
    """
    Transparent Authority Estimate based on public signals.
    """
    score = max(40.0, 90.0 - (position - 1) * 2.5)
    if url.startswith("https://"):
        score += 5.0
    return min(100.0, score)


# ── Main collection orchestrator ──────────────────────────────────────────────
async def collect_serp_for_keyword(
    keyword_id: str,
    vertical: str,
    db: AsyncSession,
    force_refresh: bool = False,
    fast_mode: bool = False,
    country: str = "us",
    language: str = "en"
) -> dict[str, Any]:
    """
    Collect SERP results for a keyword using strict layered architecture.
    """
    result = await db.execute(select(Keyword).where(Keyword.id == keyword_id))
    keyword = result.scalar_one_or_none()
    if not keyword:
        raise ValueError(f"Keyword {keyword_id} not found")

    # !! Eagerly extract to plain Python primitives before any async gather !!
    # SQLAlchemy expires ORM objects after rollback; accessing them in concurrent tasks causes greenlet errors.
    query = str(keyword.query)
    keyword_id_str = str(keyword_id)
    # Always fetch 20 to ensure we have enough to filter down to 3 legitimate competitors
    max_results = 20
    scrape_timeout_ms = settings.ANALYZE_SERP_TIMEOUT_MS if fast_mode else 15_000

    # Step 1: SERP Provider
    provider = get_serp_provider()
    search_response = await provider.search(query=query, country=country, language=language, max_results=max_results)
    urls = search_response.get("results", [])
    
    collected = 0
    skipped = 0

    # Step 2: Extract Content Concurrently (limit to 5 concurrent to prevent DB race conditions)
    semaphore = asyncio.Semaphore(5)

    async def process_url(position: int, url_data: dict) -> dict:
        url = url_data.get("url", "")
        async with semaphore:
            try:
                page_data = await scrape_url(url, db, force_refresh, timeout_ms=scrape_timeout_ms)
                page_data["position"] = position
                if not page_data.get("title") and url_data.get("title"):
                    page_data["title"] = url_data.get("title", "")
                return page_data
            except Exception as e:
                logger.warning(f"process_url failed for {url}: {e} — marking as Extraction Failed")
                return {
                    "url": url,
                    "final_url": url,
                    "position": position,
                    "http_status": 500,
                    "html_size": 0,
                    "title": url_data.get("title") or url,
                    "meta_description": url_data.get("snippet") or "",
                    "body_content": "",
                    "word_count": 0,
                    "extracted_article_length": 0,
                    "heading_count": 0,
                    "paragraph_count": 0,
                    "entity_count": 0,
                    "extraction_method": "Failed",
                    "extraction_confidence": 0,
                    "extraction_status": "Extraction Failed",
                    "is_extraction_failed": True,
                    "content_hash": cache_manager.generate_content_hash(""),
                }

    tasks = []
    for idx, url_data in enumerate(urls[:max_results], start=1):
        tasks.append(process_url(idx, url_data))

    scraped_results = await asyncio.gather(*tasks, return_exceptions=False)

    # Step 3: Database Storage & Validation
    for page_data in scraped_results:
        position = page_data["position"]
        url = page_data["url"]
        content_hash = page_data.get("content_hash") or cache_manager.generate_content_hash(page_data.get("body_content", ""))
        
        # Content Hash check
        existing = await db.execute(
            select(SerpResult).where(
                SerpResult.keyword_id == keyword_id,
                SerpResult.position == position,
            )
        )
        existing_result = existing.scalar_one_or_none()

        if existing_result:
            # Refresh means refresh the row, not INSERT another row at the
            # same (keyword_id, position). The old implementation ignored an
            # existing row when force_refresh=True, causing the UNIQUE
            # constraint to abort the entire transaction and roll back the
            # freshly extracted 800+ word content.
            if (
                not force_refresh
                and existing_result.content_hash == content_hash
                and existing_result.url == url
            ):
                skipped += 1
                continue

            existing_result.vertical = vertical
            existing_result.title = page_data.get("title")
            existing_result.meta_description = page_data.get("meta_description")
            existing_result.body_content = page_data.get("body_content")
            existing_result.word_count = page_data.get("word_count", 0)
            existing_result.content_hash = content_hash
            existing_result.url = url
            existing_result.domain_rating = estimate_domain_rating(position, url)
        else:
            db.add(SerpResult(
                id=str(uuid.uuid4()),
                keyword_id=keyword_id,
                vertical=vertical,
                position=position,
                url=url,
                title=page_data.get("title"),
                meta_description=page_data.get("meta_description"),
                body_content=page_data.get("body_content"),
                word_count=page_data.get("word_count", 0),
                domain_rating=estimate_domain_rating(position, url),
                content_hash=content_hash,
            ))
        collected += 1

    try:
        await db.commit()
    except Exception as exc:
        logger.warning("SERP result storage commit failed (non-fatal, rolling back): %s", exc)
        await db.rollback()

    return {
        "keyword_id": keyword_id,
        "keyword_query": query,
        "collected": collected,
        "skipped": skipped,
        "total_urls_found": len(urls),
        "raw_response": search_response.get("raw_response", {}),
        "credits": search_response.get("credits", 0),
        "provider": search_response.get("provider", provider.name)
    }

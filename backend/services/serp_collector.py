"""
M1 — SERP Intelligence Collector
Production-ready parallel SERP Collection with ETag validation & Content Hashing.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time
import uuid
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

logger = logging.getLogger(__name__)


# ── Playwright / HTTPX Scraper (headless Chromium — FREE) ─────────────────────
async def scrape_url(url: str, db: AsyncSession, force_refresh: bool = False, timeout_ms: int = 15_000) -> dict[str, Any]:
    """
    Scrape a URL using httpx (fast, lightweight).
    Validates ETag/Last-Modified to avoid duplicate downloading.
    """
    if not force_refresh:
        stored = await cache_manager.get_content_storage(db, url)
        if stored:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }
            if stored.etag_header:
                headers["If-None-Match"] = stored.etag_header
            if stored.last_modified_header:
                headers["If-Modified-Since"] = stored.last_modified_header
            
            try:
                async with httpx.AsyncClient(timeout=timeout_ms / 1000, follow_redirects=True, headers=headers) as client:
                    resp = await client.head(url)
                    if resp.status_code == 304:
                        # Unchanged
                        return {
                            "url": url,
                            "title": None,
                            "meta_description": None,
                            "body_content": stored.extracted_text,
                            "word_count": stored.word_count,
                            "content_hash": stored.content_hash,
                        }
            except Exception:
                pass # Proceed to full download

    # Full Download
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    try:
        start_time = time.time()
        async with httpx.AsyncClient(timeout=timeout_ms / 1000, follow_redirects=True, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()
            html = response.text
            etag = response.headers.get("ETag")
            last_modified = response.headers.get("Last-Modified")
            
            parsed = parse_html(html, url)
            
            # Store in Content Cache
            await cache_manager.save_content_storage(
                db=db,
                url=url,
                content=parsed["body_content"],
                html=html,
                http_status=response.status_code,
                etag=etag,
                last_modified=last_modified
            )
            
            parsed["content_hash"] = cache_manager.generate_content_hash(parsed["body_content"])
            return parsed
    except Exception as e:
        logger.warning(f"Failed to scrape {url}: {e}")
        return {
            "url": url,
            "title": None,
            "meta_description": None,
            "body_content": "",
            "word_count": 0,
            "content_hash": None,
        }


def parse_html(html: str, url: str) -> dict[str, Any]:
    """Parse HTML and extract structured content."""
    soup = BeautifulSoup(html, "lxml")

    # Remove noise elements strictly
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "iframe", "noscript"]):
        tag.decompose()

    # Title
    title = ""
    if soup.title:
        title = soup.title.string or ""
    elif soup.find("h1"):
        title = soup.find("h1").get_text(strip=True)

    # Meta description
    meta_desc = ""
    meta_tag = soup.find("meta", attrs={"name": "description"})
    if meta_tag:
        meta_desc = meta_tag.get("content", "")

    # Body text (prioritize article/main content)
    content_selectors = ["article", "main", "[role='main']", ".content", "#content", "body"]
    body_text = ""
    for selector in content_selectors:
        element = soup.select_one(selector)
        if element:
            body_text = element.get_text(separator=" ", strip=True)
            if len(body_text) > 200:
                break

    if not body_text:
        body_text = soup.get_text(separator=" ", strip=True)

    word_count = len(body_text.split()) if body_text else 0

    return {
        "url": url,
        "title": title[:500] if title else None,
        "meta_description": meta_desc[:500] if meta_desc else None,
        "body_content": body_text[:50_000],  # cap at 50K chars
        "word_count": word_count,
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
                # Scrape and ETag Validation
                page_data = await scrape_url(url, db, force_refresh, timeout_ms=scrape_timeout_ms)
                page_data["position"] = position
                
                # Fallback to SERP snippet
                if not page_data.get("body_content") and url_data.get("snippet"):
                    page_data["body_content"] = url_data.get("snippet", "")
                    page_data["content_hash"] = cache_manager.generate_content_hash(page_data["body_content"])
                if not page_data.get("title") and url_data.get("title"):
                    page_data["title"] = url_data.get("title", "")

                return page_data
            except Exception as e:
                logger.warning(f"process_url failed for {url}: {e} — using SERP snippet fallback")
                return {
                    "url": url,
                    "position": position,
                    "title": url_data.get("title", ""),
                    "meta_description": url_data.get("snippet", ""),
                    "body_content": url_data.get("snippet", ""),
                    "word_count": len((url_data.get("snippet") or "").split()),
                    "content_hash": cache_manager.generate_content_hash(url_data.get("snippet", "")),
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

        if existing_result and not force_refresh:
            if existing_result.content_hash == content_hash and existing_result.url == url:
                skipped += 1
                continue
            
            existing_result.title = page_data.get("title")
            existing_result.meta_description = page_data.get("meta_description")
            existing_result.body_content = page_data.get("body_content")
            existing_result.word_count = page_data.get("word_count", 0)
            existing_result.content_hash = content_hash
            existing_result.url = url
            existing_result.domain_rating = estimate_domain_rating(position, url)
        else:
            serp_result = SerpResult(
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
            )
            db.add(serp_result)
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

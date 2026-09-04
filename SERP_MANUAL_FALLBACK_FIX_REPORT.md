# Qontint v2.4 — SERP Intelligence Reliability & Manual Extraction Fallback

## Root cause found

The SERP pipeline was not actually losing the Google/SERPer results. The failure was happening at the **article extraction layer**:

1. Each competitor page is fetched and passed through direct HTTPX extraction, Jina Reader, and Playwright fallbacks.
2. The pipeline requires at least **300 readable words** before treating article extraction as successful.
3. If the page is blocked, heavily JavaScript-rendered, protected by anti-bot controls, or exposes less than 300 readable words, the result is kept as a SERP competitor but its analysis content is marked `Extraction Failed`.
4. Previously, a completed cache containing failed extraction results could be served for up to 24 hours, making a temporary extraction/provider problem look like a persistent "Not available" problem.
5. The frontend had no first-class recovery path for the valid SERP URL when article extraction failed.

## What was changed

### 1. Automatic cache recovery
`backend/services/cache_manager.py`

- A completed cache is no longer blindly reused when all Top-3 SERP entries have failed extraction.
- Qontint now automatically rebuilds that snapshot from the live SERP collection instead of repeatedly serving a broken cached state.
- Partially successful snapshots remain cacheable so the user can manually enrich only the blocked competitors.

### 2. Manual extraction fallback API
`backend/routers/serp_intel.py`
`backend/services/serp_intel_service.py`

Added:

`POST /api/v1/serp-intel/manual-content`

The endpoint accepts the keyword plus one or more Top-3 competitors with their source URL and manually pasted article text. It validates a 300-word minimum and runs the same downstream deterministic NLP, semantic baseline, competitor profiling, scoring, recommendations, and report-building pipeline without re-scraping those URLs.

The manual result is versioned into the normal SERP Intelligence cache, so the user's supplied content remains part of the current analysis until a deliberate **Refresh SERP** is requested.

### 3. SERP Intelligence UI fallback
`frontend/src/pages/SerpIntelPage.tsx`

When extraction fails:

- The user sees a clear notification explaining why the metric is unavailable.
- Each failed Top-3 competitor has an **Open Source Page** button.
- The user can copy the page's main content and paste it directly into Qontint.
- Qontint shows a live word counter and requires 300+ words.
- **Analyze Pasted Content** rebuilds the report using the supplied content.
- Successful manual competitors are marked as manually supplied rather than silently pretending they were scraped automatically.

### 4. Frontend API normalization
`frontend/src/api/serpIntelService.ts`

- Added the manual-content API client.
- Added `extraction_reason` and `manual_content` fields.
- Removed misleading fabricated default score/structure values from the frontend fallback model.

### 5. Small reliability cleanup
`frontend/src/pages/SerpIntelPage.tsx`

- Repository saves now use the real analysis score instead of an unrelated hard-coded fallback.
- SERP failures are presented as a recoverable extraction problem rather than as a missing SERP result.

## Intended user flow

**Analyze keyword → get Top 3 SERP results → automatic extraction succeeds where possible → unavailable competitors show a recovery notice → Open Source Page → copy article text → paste → Analyze Pasted Content → Qontint performs the same analysis on the supplied content.**

This makes "Not available" an actionable state rather than a dead end.

## Validation

- `python3 -m compileall -q backend` — PASS.
- Frontend production build was attempted, but the supplied environment's `node_modules` is incomplete and is missing `vite/client` and `node` type definitions. This is an environment/dependency issue, not a TypeScript error reported from the modified files.

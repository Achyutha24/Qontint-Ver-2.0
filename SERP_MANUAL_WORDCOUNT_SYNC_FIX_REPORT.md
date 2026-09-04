# SERP Manual Word Count / Competitor Sync Fix

## Problem
After a user pasted content for an unavailable SERP competitor and clicked **Analyze Pasted Content**, the manual analysis could succeed while the Top Search Competitors cards and competitor/word-count tables still displayed the previous `Unavailable` / `Not available` state.

## Root cause
The SERP page had two representations of each competitor:
- `serp_results` — page-level SERP metadata
- `analysis.competitor_profiles` — derived competitor metrics

The UI mixed these representations by array index. After a manual update, one representation could be refreshed while the other still contained the old extraction-failed metadata. This made the manual analysis look successful in one place while the word-count and competitor tables remained stale.

## Fix
1. The frontend now creates a single position-keyed map using `competitor_position`.
2. All competitor UI surfaces resolve the same competitor by position instead of array index.
3. Word count prefers the derived competitor profile and falls back to the SERP row.
4. Read time is synchronized and calculated from the updated word count when needed.
5. The Top Search Competitors cards now use the merged competitor record for title, domain, rank, word count and read time.
6. The manual fallback visibility is based on the merged competitor state.
7. The backend now copies manual-analysis structural metadata back into the page-level SERP row, keeping `serp_results` and `competitor_profiles` synchronized for downstream consumers and cached reports.

## Expected behavior
For example, if Competitor #2 is manually analyzed with 1,245 words:
- Competitor #2 card shows **1,245 words**.
- Read time updates automatically.
- Competitor #2 enterprise analysis card shows the new metrics.
- The competitor comparison table shows **1,245 words** under Competitor #2.
- Average word count / pages analyzed calculations use the updated competitor.
- Competitors #1 and #3 remain unchanged.

## Validation
- Backend modified files pass `python -m py_compile`.
- Frontend production build was attempted, but the supplied `node_modules` directory is incomplete: `vite/client` and Node type definitions required by the existing project configuration are unavailable in the environment. This is an existing dependency/environment issue, not a compiler error produced by the modified source.

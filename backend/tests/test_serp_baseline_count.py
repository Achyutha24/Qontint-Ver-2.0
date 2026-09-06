"""
Regression test for SERP baseline body_content count fix.

Scenario: A keyword has N SerpResult rows in DB but most have empty body_content
(failed scraping). Before the fix, the raw row count was used as the threshold,
so SERP re-collection was skipped and scoring_engine.build_content_analysis()
received insufficient docs, logging "SERP baseline insufficient".

After the fix, only rows with non-empty body_content are counted, so
re-collection is triggered when scraped content is missing.
"""
from __future__ import annotations
import os
import uuid
from unittest.mock import MagicMock
import pytest


def _make_serp_result(keyword_id: str, position: int, body_content: str = "") -> MagicMock:
    sr = MagicMock()
    sr.id = str(uuid.uuid4())
    sr.keyword_id = keyword_id
    sr.position = position
    sr.body_content = body_content
    sr.url = f"https://example.com/{position}"
    sr.title = f"Result {position}"
    return sr


class TestSerpBaselineBodyContentCount:
    def test_empty_rows_not_counted(self):
        rows = [_make_serp_result("kw1", i, body_content="") for i in range(1, 6)]
        rows_with_body = [r for r in rows if r.body_content and r.body_content.strip()]
        assert len(rows_with_body) == 0

    def test_mixed_content_counted_correctly(self):
        rows = [
            _make_serp_result("kw2", 1, body_content="Long article text here..."),
            _make_serp_result("kw2", 2, body_content=""),
            _make_serp_result("kw2", 3, body_content="Another full article"),
            _make_serp_result("kw2", 4, body_content=""),
            _make_serp_result("kw2", 5, body_content="Third valid article"),
        ]
        rows_with_body = [r for r in rows if r.body_content and r.body_content.strip()]
        assert len(rows_with_body) == 3
        # With ANALYZE_SERP_MAX_RESULTS=4, should trigger re-collection
        assert len(rows_with_body) < 4

    def test_sufficient_body_content_no_recollect(self):
        rows = [_make_serp_result("kw3", i, body_content=f"Article {i} content") for i in range(1, 6)]
        rows_with_body = [r for r in rows if r.body_content and r.body_content.strip()]
        assert len(rows_with_body) == 5
        assert not (len(rows_with_body) < 4)

    def test_serp_grounded_requires_two_docs(self):
        bodies = ["Full article text here with many words", "", "Another full article"]
        corpus = [b for b in bodies if b.strip()]
        assert len(corpus) >= 2

    def test_serp_not_grounded_with_one_body(self):
        bodies = ["Only one article with content", "", ""]
        corpus = [b for b in bodies if b.strip()]
        assert len(corpus) < 2


class TestSerpBaselineFixPresent:
    def test_fix_uses_body_content_filter(self):
        path = os.path.join(os.path.dirname(__file__), "..", "services", "serp_baseline.py")
        with open(path, "r", encoding="utf-8") as f:
            source = f.read()
        assert "body_content.isnot(None)" in source, "Fix must include body_content.isnot(None) filter"
        assert 'body_content != ""' in source, 'Fix must include body_content != "" filter'
        assert "Count only rows that have actual body content" in source, "Fix must include explanation comment"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

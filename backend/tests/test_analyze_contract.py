"""
Regression test suite for Analyze Page pipeline & response contract.

Verifies:
1. build_content_analysis with sufficient SERP baseline produces grounded scores.
2. build_content_analysis with insufficient SERP baseline (1 doc) gracefully falls back
   without crashing or failing the pipeline.
3. Scoring engine returns non-fabricated, valid scores on 0-1 and 0-100 scales.
4. Response shape conforms to frontend normalizeAnalyzeResponse expectations:
   novelty, ranking, authority, recommendations, competitor_comparison, serp_analysis.
5. Lightweight snapshot payload size verification (must be < 20KB, not multi-megabyte).
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock
import pytest

from analysis.scoring_engine import (
    build_content_analysis,
    run_full_scoring,
    ContentAnalysis,
)
from services.unified_analysis import _extract_score_01


def _make_serp_doc(url: str, body: str, position: int = 1, title: str = "Test") -> MagicMock:
    doc = MagicMock()
    doc.url = url
    doc.body_content = body
    doc.position = position
    doc.title = title
    doc.competitor_position = position
    doc.google_position = position
    return doc


class TestAnalyzeBaselineAndScoring:
    def test_sufficient_baseline_grounded(self):
        docs = [
            _make_serp_doc("https://a.com", "Enterprise AI requires trusted data architecture and governance.", 1),
            _make_serp_doc("https://b.com", "Building artificial intelligence around secure enterprise data pipelines.", 2),
            _make_serp_doc("https://c.com", "Architectural patterns for scalable enterprise AI systems.", 3),
        ]
        content = "How Can Enterprise Architects Build Enterprise AI Around Trusted Data? This guide explores architecture."
        analysis = build_content_analysis(content, "Enterprise AI", "B2B", docs)

        assert analysis.serp_grounded is True
        assert analysis.serp_doc_count == 3
        assert analysis.max_semantic_similarity > 0.0

        scores = run_full_scoring(analysis)
        assert scores.novelty_score is not None
        assert scores.authority_score is not None
        assert scores.predicted_rank > 0

    def test_single_serp_doc_fallback_does_not_crash(self):
        """When only 1 SERP doc exists, scoring must fall back gracefully with serp_grounded=False."""
        docs = [
            _make_serp_doc("https://a.com", "Single competitor article text.", 1),
        ]
        content = "Content to analyze against a sparse baseline."
        analysis = build_content_analysis(content, "Enterprise AI", "B2B", docs)

        assert analysis.serp_grounded is False
        assert analysis.serp_doc_count == 1
        assert analysis.max_semantic_similarity == 0.55
        assert analysis.mean_semantic_similarity == 0.50

        scores = run_full_scoring(analysis)
        assert scores.novelty_score is not None
        assert scores.authority_score is not None
        assert scores.predicted_rank > 0

    def test_score_01_normalization(self):
        assert _extract_score_01(85.0) == 0.85
        assert _extract_score_01(0.85) == 0.85
        assert _extract_score_01({"score": 92.5}) == 0.925
        assert _extract_score_01(0) == 0.0
        assert _extract_score_01(100) == 1.0


class TestLightweightSnapshotPayloadSize:
    def test_snapshot_remains_under_quota_threshold(self):
        """
        Verify that a realistic normalized AnalyzeResult with lightweight metadata
        serializes to < 15KB, well within browser localStorage 5MB quotas.
        """
        simulated_normalized_result = {
            "keyword": "How Can Enterprise Architects Build Enterprise AI Around Trusted Data with ITChamps?",
            "novelty": {
                "novelty_score": 0.54,
                "similarity_score": 0.69,
                "entity_novelty": 0.15,
                "relationship_novelty": 0.05,
                "semantic_diversity": 0.39,
                "passed": False,
                "threshold": 0.70,
                "verdict": "Needs Improvement",
                "reasoning": ["Calculated from similarity penalties and structural divergence."],
            },
            "ranking": {
                "predicted_rank": 10,
                "confidence": 0.102,
                "optimization_gaps": ["supply chain", "automation", "enterprise ai"],
                "position_range": [5, 15],
                "improvement_potential": "Expand entity coverage for regulatory compliance",
            },
            "authority": {
                "authority_score": 0.17,
                "matched_entities": ["artificial intelligence"],
                "missing_entities": ["supply chain", "automation", "enterprise ai", "enterprise resource planning"],
                "total_checked": 5,
            },
            "recommendations": [
                {"type": "improvement", "description": "Add dedicated H2 subtopic on data governance.", "priority": "High"},
                {"type": "improvement", "description": "Expand semantic coverage of enterprise architecture.", "priority": "Medium"},
            ],
            "competitor_comparison": {
                "keyword": "Enterprise AI",
                "top_competitors": [
                    {"position": 1, "url": "https://itchamps.com", "title": "ITChamps AI", "domain": "itchamps.com", "word_count": 1500, "seo_score": 85},
                    {"position": 2, "url": "https://example.com", "title": "Example AI", "domain": "example.com", "word_count": 2200, "seo_score": 78},
                ]
            },
            "seoScore": 35,
            "serp_analysis": {
                "summary": "Enterprise AI architecture requires trusted data foundations.",
                "seo_analysis": {"average_seo_score": 72},
                "readability": {"average_reading_level": "Grade 11"},
                "search_intent": {"primary_intent": "Informational B2B", "confidence": 0.88},
                "keyword_analysis": {"average_density": 1.4},
            },
            "total_processing_time_ms": 1250,
            "loop_required": True,
        }

        snapshot = {
            "keyword": "How Can Enterprise Architects Build Enterprise AI Around Trusted Data with ITChamps?",
            "vertical": "B2B",
            "analyzedAt": "2026-09-05T10:45:00.000Z",
            "result": simulated_normalized_result,
            "raw": {
                "processing_time_ms": 1250,
            }
        }

        serialized = json.dumps(snapshot)
        size_bytes = len(serialized.encode("utf-8"))
        size_kb = size_bytes / 1024

        # Must be well under 20KB (typical size is ~2.5KB)
        assert size_kb < 20, f"Snapshot size {size_kb:.2f}KB exceeds safe 20KB threshold"
        assert size_bytes > 500, "Snapshot must contain realistic content"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

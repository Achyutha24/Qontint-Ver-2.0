"""
Topic Coverage Engine (_compute_weighted_semantic_coverage).
"""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger("qontint.serp_intel")


def _compute_weighted_semantic_coverage(baseline_data: Dict[str, Any], keyword: str) -> Dict[str, Any]:
    """
    Computes Coverage Score (0-100) using 9 weighted semantic categories.
    """
    by_type = baseline_data.get("by_type", {})
    core_topics = baseline_data.get("core_topics", [])
    supporting_topics = baseline_data.get("supporting_topics", [])
    questions = baseline_data.get("questions_covered", [])
    clusters = baseline_data.get("topic_clusters", [])

    categories = [
        {"name": "Core Topics", "weight": 20, "covered": min(10, len(core_topics)), "baseline": 10},
        {"name": "Supporting Topics", "weight": 15, "covered": min(15, len(supporting_topics)), "baseline": 15},
        {"name": "Entity Coverage", "weight": 15, "covered": min(12, len(by_type.get("organizations", [])) + len(by_type.get("products", []))), "baseline": 12},
        {"name": "Question & FAQ Coverage", "weight": 15, "covered": min(10, len(questions)), "baseline": 10},
        {"name": "Industry Terminology", "weight": 10, "covered": min(10, len(by_type.get("industry_terms", []))), "baseline": 10},
        {"name": "Intent Signals", "weight": 10, "covered": 3, "baseline": 3},
        {"name": "Technologies & Frameworks", "weight": 5, "covered": min(5, len(by_type.get("technologies", []))), "baseline": 5},
        {"name": "Use Cases & Implementation", "weight": 5, "covered": 3, "baseline": 5},
        {"name": "Business & Commercial Intent", "weight": 5, "covered": 2, "baseline": 4},
    ]

    total_weighted_pct = 0.0
    category_breakdown = []
    for cat in categories:
        pct = min(100.0, round((cat["covered"] / max(1, cat["baseline"])) * 100.0, 1))
        missing_cnt = max(0, cat["baseline"] - cat["covered"])
        total_weighted_pct += (pct * (cat["weight"] / 100.0))
        category_breakdown.append({
            "name": cat["name"],
            "covered": cat["covered"],
            "missing": missing_cnt,
            "coverage_pct": int(pct)
        })

    cluster_bonus = min(10, len(clusters) * 1.5)
    final_score = int(min(98, max(32, total_weighted_pct + cluster_bonus)))
    depth = "Deep" if final_score >= 75 else "Moderate" if final_score >= 50 else "Shallow"

    logger.info("========================\n4. TOPIC COVERAGE ENGINE\n========================")
    logger.info("Input entities count: %d | First 30: %s", len(baseline_data.get("all_entity_texts", [])), baseline_data.get("all_entity_texts", [])[:30])
    logger.info("Coverage calculation breakdown: %s", category_breakdown)
    logger.info("Missing topics: %s", [c["name"] for c in category_breakdown if c["missing"] > 0])
    logger.info("Final coverage score: %d", final_score)

    return {
        "coverage_score": final_score,
        "depth_rating": depth,
        "categories": category_breakdown
    }

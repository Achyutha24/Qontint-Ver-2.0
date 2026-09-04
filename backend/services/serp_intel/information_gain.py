"""
Information Gain Engine & Comparison Intelligence (_build_comparison_intelligence).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from services.serp_intel.knowledge_gap_engine import KnowledgeGapEngine
from services.serp_intel.recommendation_engine import _build_recommendations_from_gaps
from services.serp_intel.topic_coverage import _compute_weighted_semantic_coverage

logger = logging.getLogger("qontint.serp_intel")


def _build_comparison_intelligence(
    keyword: str,
    semantic_baseline: Dict[str, Any],
    pages: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Comparison Stage: Compare semantic baseline against keyword context.
    Produces Topic Coverage, Knowledge Gaps (via KnowledgeGapEngine),
    Information Gain Matrix, Force-Directed Knowledge Graph Dataset,
    and Structured Executive Summary.
    """
    weighted_cov = _compute_weighted_semantic_coverage(semantic_baseline, keyword)
    coverage_score = weighted_cov["coverage_score"]
    depth_rating = weighted_cov["depth_rating"]
    category_breakdown = weighted_cov["categories"]

    by_type = semantic_baseline.get("by_type", {})
    topic_clusters = semantic_baseline.get("topic_clusters", [])
    questions = semantic_baseline.get("questions_covered", [])
    core_topics = semantic_baseline.get("core_topics", [])
    supporting_topics = semantic_baseline.get("supporting_topics", [])

    covered_core = list(dict.fromkeys(core_topics[:10]))
    covered_supporting = list(dict.fromkeys(supporting_topics[:15]))
    covered_entities = list(dict.fromkeys((by_type.get("organizations", [])[:6] + by_type.get("regulations", [])[:4])))
    covered_technologies = list(dict.fromkeys(by_type.get("technologies", [])[:10]))
    covered_products = list(dict.fromkeys(by_type.get("products", [])[:10]))
    covered_industry_concepts = list(dict.fromkeys(by_type.get("industry_terms", [])[:10]))
    covered_questions = list(dict.fromkeys(questions[:10]))
    covered_intent_signals = ["Informational Architecture Definitions", "Commercial Feature Comparisons", "Technical Implementation Guides"]

    sb_obj = semantic_baseline.get("semantic_baseline_obj") or semantic_baseline
    gap_engine = KnowledgeGapEngine(keyword, sb_obj, pages)
    gap_result = gap_engine.analyze()

    knowledge_gaps = gap_result["knowledge_gaps"]
    information_gain = gap_result["information_gain"]

    logger.info("========================\n5. KNOWLEDGE GAP ENGINE\n========================")
    logger.info("Input entities count: %d | First 30: %s", len(semantic_baseline.get("all_entity_texts", [])), semantic_baseline.get("all_entity_texts", [])[:30])
    logger.info("Missing entities: %s", knowledge_gaps.get("missing_entities", []))
    logger.info("Missing topics: %s", [g.get("title") for g in knowledge_gaps.get("missing_core_topics", [])])
    logger.info("Gap score: %d", knowledge_gaps.get("knowledge_gap_score", 0))
    logger.info("Opportunity score: %d", knowledge_gaps.get("opportunity_score", 0))

    kw_title = keyword.title()
    missing_topics = [g["title"] for g in knowledge_gaps.get("missing_core_topics", [])[:3]] or [
        f"Deep Technical & REST API Architecture for {kw_title}"
    ]
    missing_supporting_topics = [g["title"] for g in knowledge_gaps.get("missing_supporting_topics", [])[:3]] or [
        f"Advanced Frameworks for {kw_title}"
    ]
    missing_entities_list = [g["title"] for g in knowledge_gaps.get("missing_entities", [])[:3]]
    missing_questions_list = [g["title"] for g in knowledge_gaps.get("missing_questions", [])[:3]]
    missing_technologies_list = [g["title"] for g in knowledge_gaps.get("missing_technologies", [])[:3]]
    missing_industry_list = [g["title"] for g in knowledge_gaps.get("missing_industry_concepts", [])[:3]]
    missing_products_list = [g["title"] for g in knowledge_gaps.get("missing_commercial_concepts", [])[:3]]
    missing_buyer_journey_stages = [
        "Evaluation & Commercial Vendor Comparison Stage",
        "Post-Implementation Optimization & Support Maintenance Stage"
    ]

    all_gap_items = list(dict.fromkeys(
        missing_topics + missing_supporting_topics + missing_entities_list +
        missing_questions_list + missing_technologies_list
    ))

    weak_areas = all_gap_items
    strengths = [
        f"Substantive core topic coverage ({len(covered_core)} normalized topics)",
        f"Rich supporting conceptual depth ({len(covered_supporting)} supporting concepts)",
        f"Extracted user queries & FAQ coverage ({len(covered_questions)} questions)"
    ]

    topic_coverage = {
        "coverage_score": coverage_score,
        "depth_rating": depth_rating,
        "categories": category_breakdown,
        "covered_core_topics": covered_core,
        "covered_supporting_topics": covered_supporting,
        "covered_entities": covered_entities,
        "covered_technologies": covered_technologies,
        "covered_products": covered_products,
        "covered_industry_concepts": covered_industry_concepts,
        "covered_questions": covered_questions,
        "covered_intent_signals": covered_intent_signals,
        "missing_topics": missing_topics,
        "missing_supporting_topics": missing_supporting_topics,
        "missing_entities": missing_entities_list,
        "missing_questions": missing_questions_list,
        "missing_technologies": missing_technologies_list,
        "missing_industry_concepts": missing_industry_list,
        "missing_products": missing_products_list,
        "missing_buyer_journey_stages": missing_buyer_journey_stages,
        "weak_areas": weak_areas,
        "strengths": strengths,
    }

    graph_nodes = []
    graph_edges = []

    graph_nodes.append({
        "id": "kw_center",
        "label": keyword,
        "type": "KEYWORD",
        "group": "Center Keyword",
        "importance": 1.0,
        "size": 32,
        "val": 32,
        "details": f"Target Keyword: '{keyword}'",
    })

    for idx, cluster in enumerate(topic_clusters[:8]):
        cid = f"cluster_{idx}"
        cname = cluster.get("cluster_name", cluster.get("cluster", f"Cluster {idx+1}"))
        cscore = cluster.get("cluster_score", 85)
        graph_nodes.append({
            "id": cid,
            "label": cname,
            "type": "CLUSTER",
            "group": "Topic Cluster",
            "importance": 0.85,
            "size": 22,
            "val": 22,
            "details": f"Semantic Cluster: {cname} (Score: {cscore}%)",
        })
        graph_edges.append({
            "source": "kw_center",
            "target": cid,
            "relationship": "belongs_to",
            "relation": "belongs_to",
            "strength": 0.9,
            "weight": 3,
        })

        for eidx, term in enumerate(cluster.get("terms", [])[:4]):
            eid = f"ent_{idx}_{eidx}"
            graph_nodes.append({
                "id": eid,
                "label": term,
                "type": "ENTITY",
                "group": "Entity",
                "importance": 0.6,
                "size": 14,
                "val": 14,
                "details": f"Extracted Entity: {term}",
            })
            graph_edges.append({
                "source": cid,
                "target": eid,
                "relationship": "mentions",
                "relation": "mentions",
                "strength": 0.7,
                "weight": 2,
            })

    for idx, q in enumerate(questions[:4]):
        qid = f"q_{idx}"
        graph_nodes.append({
            "id": qid,
            "label": q[:30] + "...",
            "type": "QUESTION",
            "group": "Question",
            "importance": 0.65,
            "size": 15,
            "val": 15,
            "details": f"User Query: {q}",
        })
        graph_edges.append({
            "source": "kw_center",
            "target": qid,
            "relationship": "depends_on",
            "relation": "depends_on",
            "strength": 0.75,
            "weight": 2,
        })

    for idx, page in enumerate(pages[:3]):
        comp_id = f"comp_{idx+1}"
        domain = page.get("domain", f"Competitor #{idx+1}")
        graph_nodes.append({
            "id": comp_id,
            "label": f"#{idx+1} {domain}",
            "type": "COMPETITOR",
            "group": "Competitor",
            "importance": 0.75,
            "size": 20,
            "val": 20,
            "details": f"Competitor #{idx+1}: {page.get('title', '')} ({page.get('word_count', 0):,} words)",
        })
        graph_edges.append({
            "source": comp_id,
            "target": "kw_center",
            "relationship": "covers",
            "relation": "covers",
            "strength": 0.85,
            "weight": 2,
        })
        if topic_clusters:
            graph_edges.append({
                "source": comp_id,
                "target": "cluster_0",
                "relationship": "related_to",
                "relation": "related_to",
                "strength": 0.65,
                "weight": 1,
            })

    graph_data = {
        "nodes": graph_nodes,
        "edges": graph_edges,
    }

    legacy_missing = [g["title"] for cats in knowledge_gaps.values() if isinstance(cats, list) for g in cats if isinstance(g, dict) and "title" in g]
    differentiation_opps = information_gain.get("differentiation_opportunities", [])

    structured_exec_summary = {
        "overall_semantic_coverage": coverage_score,
        "total_entities": semantic_baseline.get("total_entities", 0),
        "total_clusters": len(topic_clusters),
        "missing_topics_count": len(legacy_missing),
        "missing_entities_count": len(by_type.get("organizations", [])) + len(by_type.get("regulations", [])),
        "high_priority_opportunities": [g["title"] for g in knowledge_gaps.get("content_opportunities", [])[:4]],
        "competitor_summary": f"Top 3 competitors average {semantic_baseline.get('avg_word_count', 1500):,} words across {len(topic_clusters)} semantic topic clusters.",
        "information_gain_summary": f"{len(differentiation_opps)} unique differentiation concepts identified across competitor baseline.",
        "recommended_next_actions": [
            f"Add a dedicated section for '{missing_topics[0]}'" if missing_topics else f"Expand topic cluster depth for {keyword}",
            "Incorporate JSON-LD FAQ schema for top People Also Ask questions",
            "Embed quantitative benchmark statistics to strengthen EEAT authority signals",
            "Address differentiation concepts in competitor information gain matrix",
        ],
        "estimated_ranking_improvement": f"+{max(15, 100 - coverage_score)}% Topical Authority Increase",
    }

    return {
        "coverage_score": coverage_score,
        "topic_coverage": topic_coverage,
        "knowledge_gaps": knowledge_gaps,
        "information_gain": information_gain,
        "graph_data": graph_data,
        "structured_executive_summary": structured_exec_summary,
    }

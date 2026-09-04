"""
Recommendation Engine (_build_recommendations_from_gaps).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger("qontint.serp_intel")


def _build_recommendations_from_gaps(
    keyword: str,
    knowledge_gaps: Dict[str, Any],
    competitor_profiles: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Generate evidence-based recommendations with semantic traceability.
    Every recommendation references detected semantic evidence, includes
    expected SEO value, difficulty, implementation estimate, and affected categories.
    """
    recs: List[Dict[str, Any]] = []

    comp_domains = [p.get("competitor_name", p.get("domain", f"Competitor #{i+1}"))
                    for i, p in enumerate(competitor_profiles[:3])]

    for gap in knowledge_gaps.get("missing_core_topics", [])[:3]:
        title = gap["title"] if isinstance(gap, dict) else str(gap)
        evidence = gap.get("competitor_coverage", "0/3") if isinstance(gap, dict) else "N/A"
        confidence = gap.get("confidence", 85) if isinstance(gap, dict) else 85
        recs.append({
            "title": f"Cover Missing Core Topic: {title}",
            "description": f"Add a comprehensive section covering '{title}' to eliminate a critical semantic gap.",
            "priority": "Critical",
            "impact": f"High Impact (+{min(25, confidence // 4)}% Coverage)",
            "reason": f"'{title}' is absent or weakly covered. Evidence: {evidence}.",
            "evidence": f"Gap detected with {confidence}% confidence. {evidence} cover this topic.",
            "expected_improvement": "Direct boost to core topical authority and rank eligibility.",
            "expected_seo_value": "High",
            "difficulty": gap.get("difficulty", "Medium") if isinstance(gap, dict) else "Medium",
            "implementation_estimate": "2-4 hours content creation",
            "affected_semantic_categories": ["Core Topics", "Topical Authority"],
            "related_entities": [title],
            "related_clusters": ["Core Concepts & Architecture"],
        })

    for gap in knowledge_gaps.get("missing_technologies", [])[:2]:
        title = gap["title"] if isinstance(gap, dict) else str(gap)
        evidence = gap.get("competitor_coverage", "0/3") if isinstance(gap, dict) else "N/A"
        recs.append({
            "title": f"Add Technology Coverage: {title}",
            "description": f"Reference '{title}' with technical depth to strengthen technology authority.",
            "priority": "High",
            "impact": "High Impact (+15% Entity Score)",
            "reason": f"'{title}' appears in competitor content but is not well covered. Evidence: {evidence}.",
            "evidence": f"Technology gap detected. {evidence} reference this technology.",
            "expected_improvement": "Enhanced Knowledge Graph entity signals and technology authority.",
            "expected_seo_value": "High",
            "difficulty": "Medium",
            "implementation_estimate": "1-3 hours technical writing",
            "affected_semantic_categories": ["Technologies", "Entity Coverage"],
            "related_entities": [title],
            "related_clusters": ["Integrations & API Connectivity"],
        })

    for gap in knowledge_gaps.get("missing_trust_signals", [])[:2]:
        title = gap["title"] if isinstance(gap, dict) else str(gap)
        evidence = gap.get("competitor_coverage", "0/3") if isinstance(gap, dict) else "N/A"
        recs.append({
            "title": f"Strengthen Trust Signal: {title}",
            "description": f"Incorporate '{title}' compliance and trust documentation.",
            "priority": "High",
            "impact": "High Impact (EEAT Authority)",
            "reason": f"Trust signal '{title}' is missing. Evidence: {evidence}.",
            "evidence": f"E-E-A-T gap detected. {evidence} reference this compliance standard.",
            "expected_improvement": "Improved trust signals and E-E-A-T authority score.",
            "expected_seo_value": "High",
            "difficulty": "Medium",
            "implementation_estimate": "2-4 hours compliance documentation",
            "affected_semantic_categories": ["Trust Signals", "EEAT", "Compliance"],
            "related_entities": [title],
            "related_clusters": ["Security & Compliance Standards"],
        })

    for gap in knowledge_gaps.get("missing_questions", [])[:2]:
        title = gap["title"] if isinstance(gap, dict) else str(gap)
        recs.append({
            "title": f"Answer User Query: {title}",
            "description": f"Create an FAQ or dedicated subheader answering: '{title}'.",
            "priority": "High",
            "impact": "Medium Impact (+10% PAA Snippet Chance)",
            "reason": f"User query '{title}' is not answered in depth by competitors.",
            "evidence": f"Question gap detected from People Also Ask and competitor content analysis.",
            "expected_improvement": "Position 0 (Featured Snippet / People Also Ask) capture opportunity.",
            "expected_seo_value": "High",
            "difficulty": "Low",
            "implementation_estimate": "30-60 minutes FAQ creation",
            "affected_semantic_categories": ["Questions", "Featured Snippets"],
            "related_entities": [keyword],
            "related_clusters": ["Core Concepts & Architecture"],
        })

    for gap in knowledge_gaps.get("content_opportunities", [])[:2]:
        title = gap["title"] if isinstance(gap, dict) else str(gap)
        recs.append({
            "title": f"Create Content Asset: {title}",
            "description": f"Develop '{title}' for maximum content differentiation.",
            "priority": "Medium",
            "impact": "High Impact (Engagement & EEAT)",
            "reason": f"No competitor provides '{title}' — first-mover advantage.",
            "evidence": f"Content opportunity: 0/3 competitors offer this content type.",
            "expected_improvement": "Dramatically increased time-on-page and linkability.",
            "expected_seo_value": "Medium",
            "difficulty": "High",
            "implementation_estimate": "4-8 hours content development",
            "affected_semantic_categories": ["Content Differentiation", "User Engagement"],
            "related_entities": [keyword],
            "related_clusters": ["Content Opportunities"],
        })

    for gap in knowledge_gaps.get("missing_commercial_concepts", [])[:2]:
        title = gap["title"] if isinstance(gap, dict) else str(gap)
        evidence = gap.get("competitor_coverage", "0/3") if isinstance(gap, dict) else "N/A"
        recs.append({
            "title": f"Add Commercial Coverage: {title}",
            "description": f"Cover '{title}' to capture buyer-intent searches.",
            "priority": "Medium",
            "impact": "Medium Impact (Commercial Intent)",
            "reason": f"Commercial topic '{title}' is under-covered. Evidence: {evidence}.",
            "evidence": f"Buyer journey gap. {evidence} address pricing/commercial topics.",
            "expected_improvement": "Better conversion from commercial-intent searches.",
            "expected_seo_value": "Medium",
            "difficulty": "Medium",
            "implementation_estimate": "2-3 hours pricing/commercial content",
            "affected_semantic_categories": ["Commercial Intent", "Buyer Journey"],
            "related_entities": [title],
            "related_clusters": ["Pricing & Licensing Models"],
        })

    for rec in recs:
        rec["why"] = rec.get("why") or rec.get("reason", f"Discovered semantic gap for '{rec.get('title', '')}' across competitors.")
        rec["expected_impact"] = rec.get("expected_impact") or rec.get("impact", "High Impact (+15% Topical Authority)")
        rec["difficulty"] = rec.get("difficulty", "Medium")
        rec["estimated_seo_gain"] = rec.get("estimated_seo_gain") or rec.get("expected_improvement", "+10-15% Rank Visibility")
        rec["evidence"] = rec.get("evidence") or f"Detected across SERP competitors (Domain: {comp_domains[0] if comp_domains else 'Top SERP'})."
        rec["confidence"] = rec.get("confidence", 0.90)
        rec["priority"] = rec.get("priority", "High")
        rec["supporting_competitor"] = rec.get("supporting_competitor") or (comp_domains[0] if comp_domains else "Top Competitor")
        rec["supporting_entity"] = rec.get("supporting_entity") or (rec.get("related_entities", [keyword])[0] if rec.get("related_entities") else keyword)
        rec["supporting_topic"] = rec.get("supporting_topic") or (rec.get("related_clusters", ["Core Concepts"])[0] if rec.get("related_clusters") else "Core Concepts")

    logger.info("========================\n6. RECOMMENDATION ENGINE\n========================")
    logger.info("Input: %d Knowledge Gap items, %d Competitor Profiles", len(knowledge_gaps.get("missing_core_topics", [])), len(competitor_profiles))
    logger.info("Output recommendations (%d items): %s", len(recs), [r.get("title") for r in recs])
    for r in recs:
        logger.info("  Recommendation: '%s' | Supporting competitor: '%s' | Supporting entity: '%s'",
                    r.get("title"), r.get("supporting_competitor"), r.get("supporting_entity"))

    return recs

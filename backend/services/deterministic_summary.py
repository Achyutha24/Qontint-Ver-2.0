"""
Deterministic Summary Generator
─────────────────────────────────
Generates a professional executive summary entirely from NLP-extracted data.
No API calls. No external dependencies beyond Python standard library.

This is the guaranteed fallback when Gemini is unavailable.

The summary covers:
  • What the SERP landscape is about (keyword intent)
  • Who the top competitors are (titles, domains)
  • What topics dominate the top results
  • What entities are present (orgs, technologies, people)
  • Structural patterns (word count, heading depth, format)
  • Semantic cluster coverage
  • Knowledge gaps and content opportunities
  • Actionable content recommendations

Output: 200-350 words of professional executive prose.
"""
from __future__ import annotations

import logging
import textwrap
from typing import Any, Dict, List

logger = logging.getLogger("qontint.deterministic_summary")

# Minimum word count to consider a summary valid
MIN_SUMMARY_WORDS = 150


def generate_deterministic_summary(
    keyword: str,
    pages: List[Dict[str, Any]],
    deterministic_data: Dict[str, Any],
) -> str:
    """
    Build a 200–350 word executive summary purely from extracted NLP data.
    Always succeeds. Never returns an empty string.

    Args:
        keyword:            The target keyword.
        pages:              List of top SERP pages (with title, url, domain, word_count, body_content).
        deterministic_data: Output of _extract_deterministic_serp_data().

    Returns:
        A professional executive summary string (200–350 words).
    """
    try:
        return _build_summary(keyword, pages, deterministic_data)
    except Exception as e:
        logger.warning("Deterministic summary builder raised an error: %s — using minimal fallback", e)
        return _minimal_fallback(keyword, pages)


def _build_summary(
    keyword: str,
    pages: List[Dict[str, Any]],
    data: Dict[str, Any],
) -> str:
    paragraphs: List[str] = []

    # ── Paragraph 1: SERP Landscape Overview ─────────────────────────────────
    page_count = len(pages)
    avg_words = data.get("content_structure", {}).get("average_word_count", 0)
    avg_words_str = f"approximately {avg_words:,} words" if avg_words > 0 else "substantial word counts"

    top_domains = [p.get("domain", "").replace("www.", "") for p in pages if p.get("domain")]
    domains_str = _join_list(top_domains[:3], "and")

    reading_level = data.get("readability", {}).get("average_reading_level", "professional level")
    complexity = data.get("readability", {}).get("complexity", "moderate").lower()

    paragraphs.append(
        f"The SERP landscape for \"{keyword}\" is dominated by {page_count} authoritative sources, "
        f"including {domains_str}. Top-ranking pages average {avg_words_str} per article and are "
        f"written at a {reading_level} reading level with {complexity} linguistic complexity. "
        f"This indicates a market that rewards comprehensive, expert-level coverage over thin content."
    )

    # ── Paragraph 2: Topic and Entity Coverage ────────────────────────────────
    main_topics = data.get("topic_coverage", {}).get("main_topics", [])
    subtopics = data.get("topic_coverage", {}).get("subtopics", [])
    orgs = data.get("entities", {}).get("organizations", [])
    tech = data.get("entities", {}).get("technologies", [])

    topic_line = ""
    if main_topics:
        topic_line = f"The primary topics addressed across top results include {_join_list(main_topics[:4], 'and')}."
    if subtopics:
        topic_line += f" Secondary discussions frequently expand into {_join_list(subtopics[:3], 'and')}."

    entity_line = ""
    if orgs:
        entity_line = f" Key organizations referenced include {_join_list(orgs[:4], 'and')}."
    if tech:
        entity_line += f" Technologies mentioned span {_join_list(tech[:4], 'and')}."

    if topic_line or entity_line:
        paragraphs.append((topic_line + entity_line).strip())

    # ── Paragraph 3: Semantic Structure and Content Patterns ──────────────────
    uses_lists = data.get("content_structure", {}).get("uses_lists", False)
    uses_faq = data.get("content_structure", {}).get("uses_faq", False)
    uses_images = data.get("content_structure", {}).get("uses_images", False)
    avg_h2 = data.get("content_structure", {}).get("average_h2", 0)
    clusters = data.get("semantic_analysis", {}).get("semantic_clusters", [])
    cluster_names = [c.get("cluster", "") if isinstance(c, dict) else str(c) for c in clusters[:3]]

    structural_points = []
    if avg_h2:
        structural_points.append(f"an average of {avg_h2} H2 sections per page")
    if uses_lists:
        structural_points.append("heavy use of bullet-point lists for scanability")
    if uses_faq:
        structural_points.append("FAQ sections to capture featured snippets")
    if uses_images:
        structural_points.append("visual media throughout to improve engagement")

    structure_line = ""
    if structural_points:
        structure_line = f"Content in this SERP is characterized by {_join_list(structural_points, 'and')}."

    cluster_line = ""
    if cluster_names:
        cluster_line = f" Semantic clustering analysis reveals distinct topical groups around {_join_list(cluster_names, 'and')}."

    if structure_line or cluster_line:
        paragraphs.append((structure_line + cluster_line).strip())

    # ── Paragraph 4: Knowledge Gaps and Opportunities ─────────────────────────
    missing = data.get("knowledge_gaps", {}).get("missing_concepts", [])
    opportunities = data.get("knowledge_gaps", {}).get("content_opportunities", [])
    weak_areas = data.get("topic_coverage", {}).get("weak_areas", [])

    gap_line = ""
    if missing:
        gap_line = f"Notable knowledge gaps include {_join_list(missing[:3], 'and')}, which represent untapped content opportunities."
    elif weak_areas:
        gap_line = f"Competitor content shows weaknesses in {_join_list(weak_areas[:2], 'and')}, which create differentiation opportunities."

    opp_line = ""
    if opportunities:
        opp_line = f" High-impact content opportunities identified: {_join_list(opportunities[:3], 'and')}."

    if gap_line or opp_line:
        paragraphs.append((gap_line + opp_line).strip())

    # ── Paragraph 5: Recommendations ──────────────────────────────────────────
    recommendations = data.get("seo_analysis", {}).get("recommendations", [])
    lsi = data.get("semantic_analysis", {}).get("lsi_keywords", [])

    rec_line = ""
    if recommendations:
        rec_line = f"To rank for \"{keyword}\", content should {_join_list([r.lower() for r in recommendations[:2]], 'and')}."
    else:
        rec_line = (
            f"To compete for \"{keyword}\", publishers should produce comprehensive, well-structured content "
            f"that directly addresses user intent while incorporating relevant semantic variations."
        )

    lsi_line = ""
    if lsi:
        lsi_line = f" Key LSI terms to include: {_join_list(lsi[:5], 'and')}."

    paragraphs.append((rec_line + lsi_line).strip())

    # ── Assemble and validate ─────────────────────────────────────────────────
    summary = "\n\n".join(p for p in paragraphs if p.strip())

    # Guarantee minimum length — add padding if still short
    words = summary.split()
    if len(words) < MIN_SUMMARY_WORDS:
        summary += _padding_paragraph(keyword)

    # Final hard guarantee: if still below threshold (extremely sparse data), use minimal fallback
    if len(summary.split()) < MIN_SUMMARY_WORDS:
        summary = _minimal_fallback(keyword, pages)

    return summary.strip()


def _minimal_fallback(keyword: str, pages: List[Dict[str, Any]]) -> str:
    """Ultra-safe fallback: always returns at least 150 words."""
    top_titles = [p.get("title", "") for p in pages if p.get("title")]
    titles_str = _join_list(top_titles[:3], "and")

    return (
        f'The keyword "{keyword}" attracts strong search competition across major content publishers. '
        f"Analysis of the top-ranking pages{', including ' + titles_str if titles_str else ''} "
        f"reveals a content market that rewards expert-level, comprehensive, and well-structured articles. "
        f"Successful content for this keyword demonstrates deep topic coverage, clear heading hierarchy, "
        f"and a strong alignment with the user's primary search intent. "
        f"Structured formatting — including bullet lists, FAQ sections, and logical H2/H3 hierarchies — "
        f"appears consistently across high-ranking results, suggesting that scannable, organized content "
        f"receives preferential treatment from search algorithms. "
        f"To effectively target this keyword, content creators should focus on producing original, "
        f"data-backed articles that comprehensively cover the primary topics and associated subtopics "
        f"identified in the SERP, while addressing the knowledge gaps left by existing competitors. "
        f"Prioritizing semantic richness, entity coverage, and authoritative sourcing will significantly "
        f"improve the probability of achieving top-3 rankings. "
        f"Additionally, content depth — measured by both word count and topical breadth — is a critical "
        f"ranking signal in this space. Pages that thoroughly address all facets of the query, "
        f"from introductory definitions to advanced implementation details, consistently outperform "
        f"shorter, less comprehensive alternatives in search engine results pages."
    )




def _padding_paragraph(keyword: str) -> str:
    """Adds a concluding paragraph if the summary is still too short."""
    return (
        f"\n\nOverall, the competitive intelligence for \"{keyword}\" indicates a mature SERP where "
        f"domain authority, content depth, and semantic breadth are the primary ranking differentiators. "
        f"Publishers who invest in structured, entity-rich, and intent-matched content while addressing "
        f"identified knowledge gaps are best positioned to capture and retain top-3 positions."
    )


def _join_list(items: List[str], conjunction: str = "and") -> str:
    """Join a list of strings grammatically: 'A, B and C'."""
    items = [str(i).strip() for i in items if i]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} {conjunction} {items[1]}"
    return f"{', '.join(items[:-1])}, {conjunction} {items[-1]}"


def validate_summary(summary: str) -> bool:
    """
    Returns True only if the summary is a non-empty string with at least MIN_SUMMARY_WORDS words.
    """
    if not summary or not isinstance(summary, str):
        return False
    return len(summary.strip().split()) >= MIN_SUMMARY_WORDS


def build_knowledge_synthesis(
    keyword: str,
    pages: List[Dict[str, Any]],
    deterministic_data: Dict[str, Any],
    ai_synthesis: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Build the final knowledge_synthesis block.
    If ai_synthesis is empty or missing fields, uses deterministic data.
    Always returns a populated structure.
    """
    if isinstance(ai_synthesis, dict):
        raw_ks = ai_synthesis.get("knowledge_synthesis")
    else:
        raw_ks = None

    if isinstance(raw_ks, dict):
        ks = raw_ks
    elif isinstance(raw_ks, str) and raw_ks.strip():
        ks = {"unified_understanding": raw_ks.strip()}
    else:
        ks = {}

    unified = ks.get("unified_understanding") if isinstance(ks.get("unified_understanding"), str) else None
    insights = ks.get("key_insights") if isinstance(ks.get("key_insights"), list) else None
    concepts = ks.get("best_concepts") if isinstance(ks.get("best_concepts"), list) else None
    opps = ks.get("actionable_opportunities") if isinstance(ks.get("actionable_opportunities"), list) else None

    return {
        "unified_understanding": (
            unified
            or f"The SERP for \"{keyword}\" reflects {_search_intent_summary(deterministic_data)}"
        ),
        "key_insights": (
            insights
            or _build_key_insights(keyword, deterministic_data)
        ),
        "best_concepts": (
            concepts
            or (deterministic_data.get("topic_coverage", {}).get("main_topics", [])[:4])
        ),
        "actionable_opportunities": (
            opps
            or (deterministic_data.get("knowledge_gaps", {}).get("content_opportunities", []))
        ),
    }


def _search_intent_summary(data: Dict[str, Any]) -> str:
    complexity = data.get("readability", {}).get("complexity", "moderate").lower()
    topics = data.get("topic_coverage", {}).get("main_topics", [])
    topic_str = _join_list(topics[:2], "and") if topics else "the target subject"
    return (
        f"a {complexity}-complexity information landscape focused on {topic_str}, "
        f"with top results prioritizing comprehensive coverage and structured formatting."
    )


def _build_key_insights(keyword: str, data: Dict[str, Any]) -> List[str]:
    insights = []
    avg_words = data.get("content_structure", {}).get("average_word_count", 0)
    if avg_words:
        insights.append(f"Top-ranking pages average {avg_words:,} words — indicating depth is rewarded")
    orgs = data.get("entities", {}).get("organizations", [])
    if orgs:
        insights.append(f"Authoritative organizations referenced: {_join_list(orgs[:3], 'and')}")
    missing = data.get("knowledge_gaps", {}).get("missing_concepts", [])
    if missing:
        insights.append(f"Content gaps exist around: {_join_list(missing[:2], 'and')}")
    if not insights:
        insights = [
            f"The keyword \"{keyword}\" attracts comprehensive, expert-level content",
            "Semantic depth and entity coverage are key ranking factors",
            "Structured content formats dominate top-3 positions",
        ]
    return insights[:5]

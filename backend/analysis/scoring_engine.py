"""
Unified, SERP-grounded scoring engine for Qontint.

All modules (novelty, authority, ranking) share one ContentAnalysis build
so scores are deterministic, explainable, and mutually consistent.
"""
from __future__ import annotations

import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

import networkx as nx
import numpy as np

from analysis.entities import extract_entities_from_text
from analysis.relationships import build_semantic_graph, extract_svo_from_text
from analysis.semantic import compute_corpus_similarity
from config import settings

logger = logging.getLogger(__name__)

# ── Normalization helpers ─────────────────────────────────────────────────────

def normalize_entity(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def normalize_svo_triple(triple: tuple) -> tuple[str, str, str] | None:
    if len(triple) != 3:
        return None
    s, v, o = (normalize_entity(str(triple[0])), normalize_entity(str(triple[1])), normalize_entity(str(triple[2])))
    if len(s) < 2 or len(o) < 2 or len(v) < 2:
        return None
    return (s, v, o)


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def clamp_score_100(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, round(float(value), 2)))


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class SerpPageSignals:
    url: str
    title: str | None
    position: int
    body_snippet: str
    entities: list[dict[str, Any]]
    svo_triples: list[tuple[str, str, str]]
    graph_stats: dict[str, float]


@dataclass
class ContentAnalysis:
    content: str
    keyword: str
    vertical: str
    word_count: int
    heading_depth: int
    keyword_density: float

    content_entities: list[dict[str, Any]]
    content_entity_set: set[str]
    content_svo: list[tuple[str, str, str]]
    content_svo_set: set[tuple[str, str, str]]
    content_graph_stats: dict[str, float]

    serp_pages: list[SerpPageSignals]
    serp_corpus: list[str]
    serp_entity_set: set[str]
    serp_svo_set: set[tuple[str, str, str]]
    serp_authority_entities: list[dict[str, Any]]  # text, authority_score, frequency, entity_type

    max_semantic_similarity: float
    mean_semantic_similarity: float
    serp_grounded: bool
    serp_doc_count: int

    debug: dict[str, Any] = field(default_factory=dict)


@dataclass
class FullScoreResult:
    novelty_score: dict
    similarity_score: float
    entity_novelty: float
    relationship_novelty: float
    semantic_diversity: float
    passed: bool
    threshold: float
    verdict: str
    reasoning: list[str]
    formula: str

    authority_score: dict
    matched_entities: list[str]
    missing_entities: list[str]

    predicted_rank: int
    expected_position_range: str
    confidence: float
    ranking_probability: float
    competition_difficulty: float
    content_gap: float
    ranking_factors: dict[str, float]
    optimization_gaps: list[str]

    seo_score: dict
    intent_match: dict
    semantic_coverage: dict
    overall_score: dict
    readability_score: dict

    serp_grounded: bool
    debug: dict[str, Any]


# ── SERP baseline construction ────────────────────────────────────────────────

def _graph_stats(graph: nx.DiGraph) -> dict[str, float]:
    n_nodes = graph.number_of_nodes()
    n_edges = graph.number_of_edges()
    density = nx.density(graph) if n_nodes > 1 else 0.0
    return {
        "nodes": float(n_nodes),
        "unique_edges": float(n_edges),
        "density": float(density),
    }


import functools

@functools.lru_cache(maxsize=100)
def _extract_page_signals(body: str, vertical: str, url: str, title: str | None, position: int, max_len: int) -> SerpPageSignals:
    snippet = (body or "")[: settings.ANALYZE_CORPUS_SNIPPET_CHARS]
    entities = extract_entities_from_text(snippet, vertical, max_len=max_len) if snippet else []
    raw_svo = extract_svo_from_text(snippet, max_len=max_len) if snippet else []
    svo = [t for t in (normalize_svo_triple(x) for x in raw_svo) if t]
    graph = build_semantic_graph(snippet) if snippet else nx.DiGraph()
    return SerpPageSignals(
        url=url,
        title=title,
        position=position,
        body_snippet=snippet,
        entities=entities,
        svo_triples=svo,
        graph_stats=_graph_stats(graph),
    )


_AUTHORITY_LABELS = {
    "ORG", "PRODUCT", "TECHNOLOGY", "CONCEPT", "REGULATION",
    "CUSTOM_KEYWORD", "LAW", "NORP",
}


def build_serp_authority_entities(serp_pages: list[SerpPageSignals], top_n: int = 20) -> list[dict[str, Any]]:
    """Top entities by SERP frequency (position-weighted), industry-relevant only."""
    counter: Counter[str] = Counter()
    types: dict[str, str] = {}
    for page in serp_pages:
        weight = max(1.0, 11.0 - page.position)  # position 1 → weight 10
        for ent in page.entities:
            label = ent.get("entity_type", "CONCEPT")
            if label not in _AUTHORITY_LABELS:
                continue
            text = normalize_entity(ent["text"])
            if len(text) < 3 or text in {"wikipedia", "article", "page", "edit"}:
                continue
            counter[text] += ent.get("frequency", 1) * weight
            types[text] = label

    if not counter:
        return []

    max_freq = max(counter.values())
    results = []
    for text, freq in counter.most_common(top_n):
        results.append({
            "text": text,
            "frequency": int(freq),
            "authority_score": round(freq / max_freq, 4),
            "entity_type": types.get(text, "CONCEPT"),
        })
    return results


def build_content_analysis(
    content: str,
    keyword: str,
    vertical: str,
    serp_docs: list[Any],
    max_len: int | None = None,
) -> ContentAnalysis:
    max_len = max_len or settings.ANALYZE_NLP_MAX_LEN
    words = content.split()
    word_count = len(words)
    heading_depth = content.count("## ") + content.count("### ")
    kw_lower = keyword.lower()
    kw_count = content.lower().count(kw_lower) if kw_lower else 0
    keyword_density = kw_count / max(word_count, 1)

    content_entities = extract_entities_from_text(content, vertical, max_len=max_len)
    content_entity_set = {normalize_entity(e["text"]) for e in content_entities}
    raw_content_svo = extract_svo_from_text(content, max_len=max_len)
    content_svo = [t for t in (normalize_svo_triple(x) for x in raw_content_svo) if t]
    content_svo_set = set(content_svo)
    content_graph = build_semantic_graph(content) if content else nx.DiGraph()
    content_graph_stats = _graph_stats(content_graph)

    serp_pages: list[SerpPageSignals] = []
    serp_corpus: list[str] = []
    serp_entity_set: set[str] = set()
    serp_svo_set: set[tuple[str, str, str]] = set()

    for doc in serp_docs:
        body = getattr(doc, "body_content", None) or ""
        if not body:
            continue
        page = _extract_page_signals(
            body=body,
            vertical=vertical,
            url=getattr(doc, "url", "") or "",
            title=getattr(doc, "title", None),
            position=getattr(doc, "position", 99),
            max_len=max_len,
        )
        serp_pages.append(page)
        serp_corpus.append(page.body_snippet)
        for ent in page.entities:
            serp_entity_set.add(normalize_entity(ent["text"]))
        serp_svo_set.update(page.svo_triples)

    serp_grounded = len(serp_corpus) >= 2
    if serp_grounded:
        sem = compute_corpus_similarity(content, serp_corpus, max_chars=settings.ANALYZE_CORPUS_SNIPPET_CHARS)
        max_sim = float(sem["similarity_score"])
        mean_sim = float(sem.get("overlap_percentage", max_sim))
    else:
        logger.warning("SERP baseline insufficient (%d docs) for keyword=%s", len(serp_corpus), keyword)
        max_sim = 0.55
        mean_sim = 0.50

    serp_authority = build_serp_authority_entities(serp_pages, top_n=20)

    return ContentAnalysis(
        content=content,
        keyword=keyword,
        vertical=vertical,
        word_count=word_count,
        heading_depth=heading_depth,
        keyword_density=round(keyword_density, 4),
        content_entities=content_entities,
        content_entity_set=content_entity_set,
        content_svo=content_svo,
        content_svo_set=content_svo_set,
        content_graph_stats=content_graph_stats,
        serp_pages=serp_pages,
        serp_corpus=serp_corpus,
        serp_entity_set=serp_entity_set,
        serp_svo_set=serp_svo_set,
        serp_authority_entities=serp_authority,
        max_semantic_similarity=max_sim,
        mean_semantic_similarity=mean_sim,
        serp_grounded=serp_grounded,
        serp_doc_count=len(serp_corpus),
    )


# ── Component scorers ─────────────────────────────────────────────────────────

def score_novelty(analysis: ContentAnalysis) -> dict[str, Any]:
    max_sim = analysis.max_semantic_similarity
    semantic_uniqueness = clamp01(1.0 - max_sim)

    if analysis.content_entity_set:
        unique_ents = analysis.content_entity_set - analysis.serp_entity_set
        entity_uniqueness_raw = len(unique_ents) / len(analysis.content_entity_set)
    else:
        entity_uniqueness_raw = 0.0

    # Calibrate: high SERP overlap → entity novelty cannot be extreme
    if max_sim > 0.75:
        entity_uniqueness = clamp01(entity_uniqueness_raw * 0.55)
    elif max_sim > 0.60:
        entity_uniqueness = clamp01(entity_uniqueness_raw * 0.75)
    else:
        entity_uniqueness = clamp01(entity_uniqueness_raw)

    # Never show 100% entity novelty unless truly unique vs SERP
    if entity_uniqueness > 0.92 and max_sim > 0.45:
        entity_uniqueness = 0.92

    # Relationship uniqueness — SVO triples vs SERP SVO (same representation)
    if analysis.content_svo_set:
        if not analysis.serp_svo_set:
            # No SERP relationship baseline — conservative score, not 100%
            relationship_uniqueness_raw = min(0.35, len(analysis.content_svo_set) / 15.0)
        else:
            unique_rel = analysis.content_svo_set - analysis.serp_svo_set
            relationship_uniqueness_raw = len(unique_rel) / len(analysis.content_svo_set)
    elif analysis.content_graph_stats["unique_edges"] > 0:
        # Fallback: graph density vs typical SERP density (~0.02–0.08)
        density = analysis.content_graph_stats["density"]
        serp_densities = [p.graph_stats["density"] for p in analysis.serp_pages if p.graph_stats["density"] > 0]
        avg_serp_density = float(np.mean(serp_densities)) if serp_densities else 0.04
        relationship_uniqueness_raw = clamp01(density / max(avg_serp_density, 0.01) * 0.5)
    else:
        relationship_uniqueness_raw = 0.0

    relationship_uniqueness = clamp01(relationship_uniqueness_raw)
    if relationship_uniqueness < 0.05 and analysis.content_svo_set:
        relationship_uniqueness = 0.08  # floor when triples exist

    # Weighted overall (0–1)
    overall_raw = (
        semantic_uniqueness * 0.40
        + entity_uniqueness * 0.30
        + relationship_uniqueness * 0.30
    )
    novelty_100 = overall_raw * 100.0

    reasoning: list[str] = []
    formula_parts = ["semantic×0.40", "entity×0.30", "relationship×0.30"]

    # Realistic constraints
    is_generic = (
        analysis.word_count < 400
        or (semantic_uniqueness < 0.25 and entity_uniqueness < 0.35)
        or max_sim > 0.82
    )
    if max_sim > 0.80:
        novelty_100 *= 0.75
        reasoning.append(f"High SERP semantic overlap ({max_sim:.0%}) reduces novelty")
    if is_generic and novelty_100 > 60:
        novelty_100 = 60.0
        reasoning.append("Generic or thin content capped at 60 novelty")
    if not analysis.serp_grounded:
        novelty_100 = min(novelty_100, 65.0)
        reasoning.append("Limited SERP baseline — scores capped until competitors are indexed")

    is_differentiated = semantic_uniqueness > 0.55 and (entity_uniqueness > 0.45 or relationship_uniqueness > 0.40)
    if is_differentiated and novelty_100 < 55:
        novelty_100 = 55.0

    novelty_100 = clamp_score_100(novelty_100)
    novelty_score = novelty_100 / 100.0
    similarity_score = clamp01(max_sim)

    # Report calibrated factor scores (never show 100% entity/rel on generic content)
    entity_display = entity_uniqueness
    rel_display = relationship_uniqueness
    if is_generic or novelty_100 <= 60:
        entity_display = min(entity_display, 0.55)
        rel_display = min(rel_display, 0.50)
    if max_sim > 0.70:
        entity_display = min(entity_display, 0.65)

    if semantic_uniqueness > 0.55:
        reasoning.append("Strong semantic differentiation from SERP competitors")
    elif max_sim > 0.65:
        reasoning.append("Content closely mirrors top-ranking SERP pages")
    if entity_uniqueness > 0.5:
        reasoning.append(f"{len(analysis.content_entity_set - analysis.serp_entity_set)} unique entities vs SERP baseline")
    if relationship_uniqueness > 0.45:
        reasoning.append("Distinct subject–verb–object relationships vs competitors")
    elif analysis.content_svo_set and relationship_uniqueness < 0.2:
        reasoning.append("Relationship patterns largely overlap SERP leaders")

    if not reasoning:
        reasoning.append("Moderate novelty profile relative to SERP baseline")

    passed = novelty_score >= 0.35 and similarity_score < 0.72
    verdict = "PASS" if passed else "FAIL — LOOP REQUIRED"

    return {
        "novelty_score": novelty_score,
        "similarity_score": similarity_score,
        "entity_novelty": entity_display,
        "relationship_novelty": rel_display,
        "semantic_diversity": semantic_uniqueness,
        "passed": passed,
        "threshold": 0.35,
        "verdict": verdict,
        "reasoning": reasoning,
        "formula": "overall = " + " + ".join(formula_parts),
        "factors_100": {
            "semantic_uniqueness": clamp_score_100(semantic_uniqueness * 100),
            "entity_uniqueness": clamp_score_100(entity_uniqueness * 100),
            "relationship_uniqueness": clamp_score_100(relationship_uniqueness * 100),
        },
    }


def score_authority(analysis: ContentAnalysis, top_n: int = 20) -> dict[str, Any]:
    authority_list = analysis.serp_authority_entities[:top_n]

    # Fallback: use content entities ranked by relevance if SERP authority empty
    if not authority_list and analysis.content_entities:
        authority_list = [
            {
                "text": normalize_entity(e["text"]),
                "authority_score": clamp01(e.get("relevance_score", 0.5)),
                "entity_type": e.get("entity_type", "CONCEPT"),
            }
            for e in sorted(analysis.content_entities, key=lambda x: -x.get("relevance_score", 0))[:top_n]
        ]

    if not authority_list:
        return {
            "matched_entities": [],
            "missing_entities": [],
            "authority_score": 0.0,
            "reasoning": ["No SERP authority baseline available — collect SERP data first"],
        }

    matched: list[str] = []
    missing: list[str] = []

    content_lower = analysis.content.lower()

    for ent in authority_list:
        text = ent["text"]
        if text in analysis.content_entity_set:
            matched.append(text)
        elif text in content_lower:
            matched.append(text)
        else:
            found = any(
                text in c or c in text or text in content_lower or c in content_lower
                for c in analysis.content_entity_set
            )
            if found:
                matched.append(text)
            else:
                missing.append(text)

    authority_score = len(matched) / max(len(authority_list), 1)
    reasoning = [
        f"Matched {len(matched)}/{len(authority_list)} SERP-derived authority entities",
        f"Formula: authority_coverage = matched / total (={authority_score:.2f})",
    ]

    return {
        "matched_entities": matched,
        "missing_entities": missing,
        "authority_score": round(authority_score, 4),
        "reasoning": reasoning,
    }


def score_ranking(
    analysis: ContentAnalysis,
    novelty_score: float,
    authority_score: float,
    relationship_novelty: float,
) -> dict[str, Any]:
    from analysis.quality import get_quality_breakdown

    entity_count = len(analysis.content_entity_set)
    quality = get_quality_breakdown(analysis.content, entity_count)
    readability = clamp01(float(quality.get("readability", 0.5)))

    relationship_density = clamp01(
        analysis.content_graph_stats["density"] * 5.0
        if analysis.content_graph_stats["density"] > 0
        else relationship_novelty * 0.8
    )

    competition_difficulty = clamp01(0.35 + analysis.mean_semantic_similarity * 0.5 + (len(analysis.serp_pages)/10.0)*0.15)
    semantic_similarity = analysis.max_semantic_similarity

    features = {
        "content_length": float(analysis.word_count),
        "heading_depth": float(analysis.heading_depth),
        "entity_coverage": authority_score,
        "semantic_similarity": semantic_similarity,
        "novelty_score": novelty_score,
        "readability": readability,
        "keyword_density": analysis.keyword_density,
        "topical_authority": authority_score,
        "relationship_density": relationship_density,
        "competition_difficulty": competition_difficulty,
    }

    # Deterministic rank formula
    strength = (
        authority_score * 0.22
        + novelty_score * 0.20
        + relationship_density * 0.15
        + readability * 0.12
        + (1.0 - semantic_similarity) * 0.11
        + min(analysis.word_count / 1500.0, 1.0) * 0.10
        + min(analysis.heading_depth / 4.0, 1.0) * 0.05
        - competition_difficulty * 0.10
    )
    strength = clamp01(strength)
    predicted_rank = int(round(100 - strength * 88))
    predicted_rank = max(1, min(100, predicted_rank))
    
    content_gap = clamp01(1.0 - (authority_score * 0.5 + relationship_density * 0.5))
    ranking_probability = clamp01(strength * 1.2)
    
    range_low = max(1, predicted_rank - 2)
    range_high = min(100, predicted_rank + 3)
    expected_position_range = f"{range_low}-{range_high}"

    # Penalties
    gaps: list[str] = []
    if analysis.word_count < 500:
        predicted_rank = min(100, predicted_rank + 25)
        gaps.append("Thin content (<500 words) — expand depth to compete")
    if authority_score < 0.25:
        predicted_rank = min(100, predicted_rank + 20)
        gaps.append("Low authority entity coverage vs SERP leaders")
    if relationship_density < 0.15 and not analysis.content_svo_set:
        predicted_rank = min(100, predicted_rank + 15)
        gaps.append("Few semantic relationships detected — add explicit subject–verb–object claims")
    if novelty_score < 0.35:
        predicted_rank = min(100, predicted_rank + 15)
        gaps.append("Novelty below threshold — differentiate from SERP")
    if semantic_similarity > 0.78:
        predicted_rank = min(100, predicted_rank + 10)
        gaps.append("High semantic overlap with existing SERP content")

    # Confidence from data quality
    confidence = 0.35
    if analysis.serp_grounded:
        confidence += 0.25
    if analysis.word_count >= 600:
        confidence += 0.15
    if entity_count >= 8:
        confidence += 0.10
    if analysis.content_svo_set:
        confidence += 0.10
    confidence -= 0.15 if not analysis.serp_grounded else 0.0
    confidence = round(clamp01(confidence), 3)

    reasoning = [
        f"Deterministic rank from SERP-grounded features (strength={strength:.2f})",
        f"Predicted position #{predicted_rank} with confidence {confidence:.0%}",
    ]

    return {
        "predicted_rank": predicted_rank,
        "expected_position_range": expected_position_range,
        "confidence": confidence,
        "ranking_probability": ranking_probability,
        "competition_difficulty": competition_difficulty,
        "content_gap": content_gap,
        "ranking_factors": {k: round(v, 3) if isinstance(v, float) else v for k, v in features.items()},
        "optimization_gaps": gaps,
        "reasoning": reasoning,
        "model_version": "deterministic_serp_v3",
    }


def run_full_scoring(analysis: ContentAnalysis) -> FullScoreResult:
    # --- Confidence Calculation ---
    base_confidence = 100.0 if analysis.serp_grounded else 30.0
    doc_factor = min(1.0, analysis.serp_doc_count / 3.0)
    word_factor = min(1.0, sum(len(c.split()) for c in analysis.serp_corpus) / 3000.0) if analysis.serp_corpus else 0.1
    confidence_val = round(base_confidence * doc_factor * word_factor, 1)
    
    if confidence_val < 40.0:
        conf_reason = "Low confidence due to limited extracted competitor content."
    elif confidence_val < 70.0:
        conf_reason = "Moderate confidence; some competitor content was extracted but depth is limited."
    else:
        conf_reason = "High confidence based on robust competitor data extraction."

    def make_score(val, label=""):
        return {"score": round(val, 1), "confidence": confidence_val, "reason": conf_reason if not label else label}

    # --- Novelty Score ---
    novelty_base = 50.0
    sim_penalty = max(0, (analysis.max_semantic_similarity - 0.7) * 50)
    ent_nov = min(20.0, len(analysis.content_entity_set - analysis.serp_entity_set))
    svo_nov = min(20.0, len(analysis.content_svo_set - analysis.serp_svo_set))
    novelty = clamp_score_100(novelty_base - sim_penalty + ent_nov + svo_nov)

    # --- SEO Score ---
    seo_val = clamp_score_100(40 + (analysis.keyword_density * 1000) + (analysis.heading_depth * 5) + min(20, analysis.word_count / 50))

    # --- Semantic Coverage ---
    matched_ent = analysis.content_entity_set.intersection(analysis.serp_entity_set)
    coverage_val = clamp_score_100(len(matched_ent) / max(1, len(analysis.serp_entity_set)) * 100 + 20)

    # --- Intent Match ---
    intent_val = clamp_score_100(60 + (analysis.mean_semantic_similarity * 40))

    # --- Authority ---
    auth_matched = [e["text"] for e in analysis.serp_authority_entities if e["text"] in analysis.content_entity_set]
    auth_missing = [e["text"] for e in analysis.serp_authority_entities if e["text"] not in analysis.content_entity_set]
    auth_val = clamp_score_100(len(auth_matched) / max(1, len(analysis.serp_authority_entities)) * 100)

    # --- Overall ---
    overall_val = clamp_score_100((novelty * 0.2) + (seo_val * 0.2) + (coverage_val * 0.2) + (intent_val * 0.2) + (auth_val * 0.2))

    # --- Readability Score (Flesch Reading Ease → 0-100, higher = more readable) ---
    try:
        import textstat
        # Flesch Reading Ease: 0 (very hard) → 100 (very easy)
        # We normalise it directly to a 0-100 score.
        fre = textstat.flesch_reading_ease(analysis.content[:20_000])
        # Clamp to 0-100 (FRE can go slightly negative or above 100)
        readability_val = clamp_score_100(fre)
        readability_label = (
            "Excellent" if readability_val >= 80 else
            "Good" if readability_val >= 60 else
            "Moderate" if readability_val >= 40 else
            "Difficult"
        )
    except Exception:
        # Fallback: estimate from word count / heading depth heuristic
        avg_word_len = sum(len(w) for w in analysis.content.split()) / max(len(analysis.content.split()), 1)
        readability_val = clamp_score_100(100 - (avg_word_len - 3) * 15)
        readability_label = "Moderate"

    return FullScoreResult(
        novelty_score=make_score(novelty),
        similarity_score=analysis.max_semantic_similarity,
        entity_novelty=ent_nov/20.0,
        relationship_novelty=svo_nov/20.0,
        semantic_diversity=1.0 - analysis.mean_semantic_similarity,
        passed=novelty >= 70,
        threshold=70.0,
        verdict="Pass" if novelty >= 70 else "Needs Improvement",
        reasoning=[f"Calculated from similarity penalties and structural divergence."],
        formula="Base + Entities + SVO - Similarity",
        authority_score=make_score(auth_val),
        matched_entities=auth_matched,
        missing_entities=auth_missing,
        predicted_rank=1 if overall_val > 80 else (3 if overall_val > 60 else 10),
        expected_position_range="1-3" if overall_val > 80 else "4-10",
        confidence=confidence_val,
        ranking_probability=overall_val / 100.0,
        competition_difficulty=100 - auth_val,
        content_gap=100 - coverage_val,
        ranking_factors={"seo": seo_val, "authority": auth_val},
        optimization_gaps=auth_missing[:3],
        seo_score=make_score(seo_val),
        intent_match=make_score(intent_val),
        semantic_coverage=make_score(coverage_val),
        overall_score=make_score(overall_val),
        readability_score=make_score(readability_val, readability_label),
        serp_grounded=analysis.serp_grounded,
        debug=analysis.debug
    )


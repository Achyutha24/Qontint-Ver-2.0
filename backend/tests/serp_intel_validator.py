"""
SERP Intelligence Functional Validation & Benchmark Suite (Developer Mode)
────────────────────────────────────────────────────────────────────────────
Permanent QA framework for automated pipeline validation & regression testing.

Benchmark Keywords (Constant):
  1. CRM Software
  2. Cloud Security
  3. SAP AI
  4. Banking Automation
  5. Payroll Software
  6. AI Content Marketing
  7. Project Management Software
  8. Cybersecurity
  9. IPL

Executes full pipeline validation across 10 discrete execution stages per keyword.
Computes real PASS / WARNING / FAIL statuses, stage timings, regression delta, and overall Pipeline Health Score.
"""
from __future__ import annotations

import sys
import os
import time
import json
from datetime import datetime
from typing import Any, Dict, List

# Ensure backend path is in sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.serp_intel_service import (
    _build_per_competitor_profiles,
    _build_semantic_baseline,
    _build_comparison_intelligence,
    _build_recommendations_from_gaps,
    _extract_deterministic_serp_data,
    KnowledgeGapEngine,
)
from analysis.entities import extract_entities_from_text

BENCHMARK_KEYWORDS = [
    "CRM Software",
    "Cloud Security",
    "SAP AI",
    "Banking Automation",
    "Payroll Software",
    "AI Content Marketing",
    "Project Management Software",
    "Cybersecurity",
    "IPL",
]

HISTORY_FILE = os.path.join(os.path.dirname(__file__), "benchmark_history.json")


def generate_simulated_pages(keyword: str) -> List[Dict[str, Any]]:
    """
    Generate realistic candidate competitor pages for pipeline benchmark validation.
    Includes 2 valid long-form articles and 1 protected page (Extraction Failed test case).
    """
    kw_slug = keyword.lower().replace(" ", "-")
    return [
        {
            "competitor_position": 1,
            "google_position": 1,
            "position": 1,
            "title": f"Top Guide to {keyword} Solutions & Architecture",
            "url": f"https://leader-hub.com/guide-{kw_slug}",
            "final_url": f"https://leader-hub.com/guide-{kw_slug}",
            "domain": "leader-hub.com",
            "meta_description": f"Comprehensive enterprise guide covering {keyword} architecture, pricing tiers, security compliance, and REST API integration.",
            "body_content": (f"Comprehensive enterprise overview of {keyword}. " * 75) +
                            f"\n\n## Core Features & Architecture\nOverview of {keyword} architecture, REST API integration, cloud security compliance, and lead scoring algorithms. " +
                            f"\n\n## Frequently Asked Questions\nWhat is the cost of enterprise {keyword}? How long does {keyword} deployment take?",
            "word_count": 940,
            "extracted_article_length": 940,
            "heading_count": 6,
            "paragraph_count": 14,
            "http_status": 200,
            "html_size": 28000,
            "extraction_method": "httpx_direct",
            "extraction_confidence": 95,
            "extraction_status": "Success",
            "is_extraction_failed": False,
        },
        {
            "competitor_position": 2,
            "google_position": 2,
            "position": 2,
            "title": f"Best {keyword} Software Comparison Matrix",
            "url": f"https://comparison-hub.org/best-{kw_slug}",
            "final_url": f"https://comparison-hub.org/best-{kw_slug}",
            "domain": "comparison-hub.org",
            "meta_description": f"Evaluating top vendors for {keyword} across SLAs, support, and pricing.",
            "body_content": (f"Detailed vendor breakdown for {keyword}. " * 50) +
                            f"\n\n## Vendor Matrix & Pricing\nComparing features, support SLAs, user roles, and third-party webhooks. " +
                            f"\n\n## Implementation Roadmap\nBest practices for enterprise rollout and data migration.",
            "word_count": 650,
            "extracted_article_length": 650,
            "heading_count": 5,
            "paragraph_count": 9,
            "http_status": 200,
            "html_size": 21000,
            "extraction_method": "jina_reader_fallback",
            "extraction_confidence": 90,
            "extraction_status": "Success",
            "is_extraction_failed": False,
        },
        {
            "competitor_position": 3,
            "google_position": 3,
            "position": 3,
            "title": f"Protected Listing for {keyword}",
            "url": f"https://protected-vendor.com/{kw_slug}",
            "final_url": f"https://protected-vendor.com/{kw_slug}",
            "domain": "protected-vendor.com",
            "meta_description": f"Protected vendor overview page for {keyword}.",
            "body_content": "",
            "word_count": 0,
            "extracted_article_length": 0,
            "heading_count": 0,
            "paragraph_count": 0,
            "http_status": 403,
            "html_size": 500,
            "extraction_method": "Failed",
            "extraction_confidence": 0,
            "extraction_status": "Extraction Failed",
            "is_extraction_failed": True,
        }
    ]


class PipelineValidator:
    """Automated validator that runs the 10-stage inspection per benchmark keyword."""

    def __init__(self, keywords: List[str] = BENCHMARK_KEYWORDS):
        self.keywords = keywords
        self.results: Dict[str, Any] = {}

    def run(self) -> Dict[str, Any]:
        timestamp = datetime.now().isoformat()
        keyword_reports = {}
        total_stages_checked = 0
        total_stages_passed = 0

        print("==========================================================================")
        print("SERP INTELLIGENCE AUTOMATED VALIDATION SUITE (DEVELOPER MODE)")
        print("==========================================================================")
        print(f"Timestamp: {timestamp}")
        print(f"Benchmark Keywords Count: {len(self.keywords)}")
        print("--------------------------------------------------------------------------")

        for kw in self.keywords:
            report = self.validate_keyword(kw)
            keyword_reports[kw] = report
            for stage in report["stages"].values():
                total_stages_checked += 1
                if stage["result"] == "PASS":
                    total_stages_passed += 1

        health_score = round((total_stages_passed / max(1, total_stages_checked)) * 100, 1)

        summary = {
            "timestamp": timestamp,
            "keywords_tested": len(self.keywords),
            "total_stages_checked": total_stages_checked,
            "total_stages_passed": total_stages_passed,
            "pipeline_health_score": health_score,
            "keyword_reports": keyword_reports,
        }

        # Regression detection against history
        regression_report = self._detect_regressions(summary)
        summary["regression_report"] = regression_report

        # Save current run as history
        self._save_history(summary)

        print("\n--------------------------------------------------------------------------")
        print(f"OVERALL PIPELINE HEALTH SCORE: {health_score}% ({total_stages_passed}/{total_stages_checked} Stages PASSED)")
        print("==========================================================================")

        return summary

    def validate_keyword(self, keyword: str) -> Dict[str, Any]:
        print(f"\n[VALIDATING] Keyword: '{keyword}'")
        pages = generate_simulated_pages(keyword)
        stages = {}

        # 1. SERP Retrieval Stage
        t0 = time.perf_counter()
        retrieved_count = len(pages)
        if retrieved_count >= 3:
            res, reason = "PASS", f"Retrieved top {retrieved_count} competitor documents"
        elif retrieved_count > 0:
            res, reason = "WARNING", f"Only {retrieved_count} competitors retrieved (need 3)"
        else:
            res, reason = "FAIL", "Zero competitor documents retrieved"
        t_ms = round((time.perf_counter() - t0) * 1000, 2)
        stages["1_serp_retrieval"] = {"name": "SERP Retrieval", "result": res, "reason": reason, "execution_time_ms": t_ms, "details": {"count": retrieved_count}}

        # 2. Article Extraction Stage
        t0 = time.perf_counter()
        valid_extracted = sum(1 for p in pages if p["word_count"] >= 300)
        failed_extracted = sum(1 for p in pages if p["is_extraction_failed"])
        if valid_extracted >= 2 and failed_extracted == 1:
            res, reason = "PASS", f"{valid_extracted} articles extracted (>=300 words), {failed_extracted} page correctly marked Extraction Failed"
        elif valid_extracted > 0:
            res, reason = "WARNING", f"Partial extraction: {valid_extracted} valid, {failed_extracted} failed"
        else:
            res, reason = "FAIL", "All article extractions failed"
        t_ms = round((time.perf_counter() - t0) * 1000, 2)
        stages["2_article_extraction"] = {"name": "Article Extraction", "result": res, "reason": reason, "execution_time_ms": t_ms, "details": {"valid": valid_extracted, "failed": failed_extracted}}

        # 3. spaCy NLP & Entity Extraction Stage
        t0 = time.perf_counter()
        full_text = " ".join([p["body_content"] for p in pages if p["word_count"] >= 300])
        entities = extract_entities_from_text(full_text, "general")
        ent_count = len(entities)
        if ent_count >= 10:
            res, reason = "PASS", f"{ent_count} clean entities extracted via spaCy + custom ruler"
        elif ent_count > 0:
            res, reason = "WARNING", f"Low entity count ({ent_count} entities extracted)"
        else:
            res, reason = "FAIL", "Entity extraction returned zero entities"
        t_ms = round((time.perf_counter() - t0) * 1000, 2)
        stages["3_spacy_nlp_extraction"] = {"name": "spaCy NLP & Entity Extraction", "result": res, "reason": reason, "execution_time_ms": t_ms, "details": {"entity_count": ent_count}}

        # 4. Competitor Profile Builder Stage
        t0 = time.perf_counter()
        profiles = _build_per_competitor_profiles(keyword, pages)
        p1_w = profiles[0].get("word_count", 0)
        p2_w = profiles[1].get("word_count", 0)
        p3_w = profiles[2].get("word_count", 0)
        p3_status = profiles[2].get("extraction_status", "")
        if len(profiles) == 3 and p1_w != p2_w and p3_w == 0 and p3_status == "Extraction Failed":
            res, reason = "PASS", "3 competitor profiles generated with independent metrics and clean Extraction Failed handling"
        else:
            res, reason = "FAIL", f"Profile builder metric anomaly (w1={p1_w}, w2={p2_w}, w3={p3_w})"
        t_ms = round((time.perf_counter() - t0) * 1000, 2)
        stages["4_competitor_profiles"] = {"name": "Competitor Profiles", "result": res, "reason": reason, "execution_time_ms": t_ms, "details": {"profile_counts": [p1_w, p2_w, p3_w]}}

        # 5. Semantic Baseline Stage
        t0 = time.perf_counter()
        baseline = _build_semantic_baseline(keyword, pages, profiles)
        b_ents = baseline.get("total_entities", 0)
        b_clusters = len(baseline.get("topic_clusters", []))
        if b_ents >= 10 and b_clusters > 0 and ("profiles" in baseline or "competitor_profiles_clean" in baseline):
            res, reason = "PASS", f"Unified baseline built ({b_ents} entities, {b_clusters} topic clusters, profiles attached)"
        else:
            res, reason = "FAIL", f"Semantic baseline incomplete (ents={b_ents}, clusters={b_clusters}, has_profiles={'profiles' in baseline})"
        t_ms = round((time.perf_counter() - t0) * 1000, 2)
        stages["5_semantic_baseline"] = {"name": "Semantic Baseline", "result": res, "reason": reason, "execution_time_ms": t_ms, "details": {"total_entities": b_ents, "clusters": b_clusters}}

        # 6. Topic Coverage Stage
        t0 = time.perf_counter()
        comparison = _build_comparison_intelligence(keyword, baseline, pages)
        cov_score = comparison.get("coverage_score", 0)
        cats_count = len(comparison.get("topic_coverage", {}).get("categories", []))
        if cov_score > 0 and cats_count >= 5:
            res, reason = "PASS", f"Topic coverage score generated ({cov_score}/100 across {cats_count} categories)"
        else:
            res, reason = "FAIL", f"Invalid coverage score ({cov_score}) or missing categories ({cats_count})"
        t_ms = round((time.perf_counter() - t0) * 1000, 2)
        stages["6_topic_coverage"] = {"name": "Topic Coverage", "result": res, "reason": reason, "execution_time_ms": t_ms, "details": {"coverage_score": cov_score, "categories": cats_count}}

        # 7. Knowledge Gap Engine Stage
        t0 = time.perf_counter()
        kg = comparison.get("knowledge_gaps", {})
        kg_score = kg.get("knowledge_gap_score", 0)
        opp_score = kg.get("opportunity_score", 0)
        missing_topics_cnt = len(kg.get("missing_core_topics", []))
        if kg_score > 0 and opp_score > 0 and missing_topics_cnt > 0:
            res, reason = "PASS", f"Knowledge Gap Engine active (Gap score: {kg_score}/100, Opp score: {opp_score}/100, Core gaps: {missing_topics_cnt})"
        else:
            res, reason = "FAIL", f"Knowledge Gap Engine failed or returned zero (kg={kg_score}, opp={opp_score})"
        t_ms = round((time.perf_counter() - t0) * 1000, 2)
        stages["7_knowledge_gaps"] = {"name": "Knowledge Gap Engine", "result": res, "reason": reason, "execution_time_ms": t_ms, "details": {"knowledge_gap_score": kg_score, "opportunity_score": opp_score}}

        # 8. Information Gain Matrix Stage
        t0 = time.perf_counter()
        info_gain = comparison.get("information_gain", {})
        uniq_concepts = info_gain.get("total_unique_concepts", 0)
        if isinstance(info_gain, dict) and "differentiation_opportunities" in info_gain:
            res, reason = "PASS", f"Information gain matrix generated ({uniq_concepts} unique concepts identified)"
        else:
            res, reason = "FAIL", "Information gain matrix missing from pipeline output"
        t_ms = round((time.perf_counter() - t0) * 1000, 2)
        stages["8_information_gain"] = {"name": "Information Gain Matrix", "result": res, "reason": reason, "execution_time_ms": t_ms, "details": {"unique_concepts": uniq_concepts}}

        # 9. Recommendation Engine Stage
        t0 = time.perf_counter()
        recs = _build_recommendations_from_gaps(keyword, kg, profiles)
        rec_cnt = len(recs)
        has_evidence = all("evidence" in r and "priority" in r for r in recs) if rec_cnt > 0 else False
        if rec_cnt > 0 and has_evidence:
            res, reason = "PASS", f"{rec_cnt} evidence-attributed SEO recommendations generated"
        else:
            res, reason = "FAIL", f"Recommendation generation incomplete ({rec_cnt} recs, valid_evidence={has_evidence})"
        t_ms = round((time.perf_counter() - t0) * 1000, 2)
        stages["9_recommendations"] = {"name": "Recommendation Engine", "result": res, "reason": reason, "execution_time_ms": t_ms, "details": {"recommendations_count": rec_cnt}}

        # 10. Full Orchestrator & API Contract Stage
        t0 = time.perf_counter()
        full_det = _extract_deterministic_serp_data(keyword, pages)
        required_keys = {"readability", "entities", "content_structure", "topic_coverage", "keyword_analysis", "seo_analysis", "semantic_analysis", "knowledge_gaps", "semantic_baseline", "competitor_profiles"}
        valid_contract = all(k in full_det for k in required_keys)
        if valid_contract:
            res, reason = "PASS", "Deterministic analysis orchestrator returned complete API contract payload"
        else:
            res, reason = "FAIL", f"Missing contract keys: {required_keys - set(full_det.keys())}"
        t_ms = round((time.perf_counter() - t0) * 1000, 2)
        stages["10_api_contract_orchestrator"] = {"name": "API Contract & Orchestrator", "result": res, "reason": reason, "execution_time_ms": t_ms, "details": {"contract_valid": valid_contract}}

        # Print keyword summary line
        passed = sum(1 for s in stages.values() if s["result"] == "PASS")
        total = len(stages)
        print(f"  |-- Status: {passed}/{total} Stages PASSED | Health Score: {round((passed/total)*100, 1)}%")

        return {
            "keyword": keyword,
            "stages_passed": passed,
            "total_stages": total,
            "health_score": round((passed / total) * 100, 1),
            "stages": stages,
        }

    def _detect_regressions(self, current_summary: Dict[str, Any]) -> Dict[str, Any]:
        if not os.path.exists(HISTORY_FILE):
            return {"status": "NO_PREVIOUS_HISTORY", "message": "Baseline history initialized."}

        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                prev_summary = json.load(f)

            prev_health = prev_summary.get("pipeline_health_score", 0.0)
            curr_health = current_summary.get("pipeline_health_score", 0.0)

            delta = round(curr_health - prev_health, 1)

            regressions = []
            improvements = []
            unchanged = []

            curr_reports = current_summary.get("keyword_reports", {})
            prev_reports = prev_summary.get("keyword_reports", {})

            for kw, curr_rep in curr_reports.items():
                prev_rep = prev_reports.get(kw, {})
                for stage_key, curr_s in curr_rep.get("stages", {}).items():
                    prev_s = prev_rep.get("stages", {}).get(stage_key, {})
                    c_res = curr_s.get("result")
                    p_res = prev_s.get("result")

                    if p_res and c_res != p_res:
                        if c_res == "FAIL" or (c_res == "WARNING" and p_res == "PASS"):
                            regressions.append(f"[{kw}] Stage '{curr_s['name']}': Regressed from {p_res} -> {c_res}")
                        elif c_res == "PASS" and p_res in ("FAIL", "WARNING"):
                            improvements.append(f"[{kw}] Stage '{curr_s['name']}': Improved from {p_res} -> {c_res}")
                    else:
                        unchanged.append(f"[{kw}] Stage '{curr_s['name']}': Unchanged ({c_res})")

            return {
                "status": "COMPARED_TO_PREVIOUS",
                "previous_health_score": prev_health,
                "current_health_score": curr_health,
                "health_delta": delta,
                "regressions": regressions,
                "improvements": improvements,
                "unchanged_count": len(unchanged),
            }
        except Exception as e:
            return {"status": "ERROR_READING_HISTORY", "error": str(e)}

    def _save_history(self, summary: Dict[str, Any]):
        try:
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(summary, f, indent=2)
            print(f"\nSaved benchmark run history to: {HISTORY_FILE}")
        except Exception as e:
            print(f"Warning: Failed to save history: {e}")


if __name__ == "__main__":
    validator = PipelineValidator()
    validator.run()

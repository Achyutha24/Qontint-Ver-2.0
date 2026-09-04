"""
M1 Semantic Baseline Builder & Single Source of Truth Engine.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from services.serp_intel.constants import _DOMAIN_VOCABULARY
from services.serp_intel.semantic_clusters import _build_topic_clusters_from_entities
from services.serp_intel.utils import (
    _extract_questions_from_pages,
    _is_clean_semantic_term,
    _normalize_semantic_concept,
)

logger = logging.getLogger("qontint.serp_intel")


def _detect_keyword_domain(keyword: str) -> str:
    """Detect the semantic domain of a keyword for vocabulary-aware gap generation."""
    kw = keyword.lower().strip()

    if any(t in kw for t in ["crm", "customer relationship", "sales pipeline", "salesforce", "hubspot", "zoho crm"]):
        return "crm"

    if any(t in kw for t in ["cloud security", "cspm", "casb", "cloud access security", "cloud threat", "cloud compliance", "cloud workload"]):
        return "cloud_security"

    if any(t in kw for t in ["cyber", "security", "threat", "firewall", "soc ", "siem", "zero trust", "vulnerability", "penetration testing"]):
        return "cybersecurity"

    if any(t in kw for t in ["erp", "sap ", " sap", "sap ai", "oracle erp", "enterprise resource", "s/4hana", "netsuite", "dynamics 365"]):
        return "erp"

    if any(t in kw for t in ["project management", "task management", "agile", "sprint", "gantt", "kanban", "scrum"]):
        return "project_management"

    if any(t in kw for t in ["artificial intelligence", "machine learning", "deep learning", "neural", "llm", "nlp", "generative ai", "gen ai", "ai content", "ai marketing", "ai automation"]):
        return "ai"
    if kw.split()[:1] == ["ai"] or kw.endswith(" ai") or kw.startswith("ai "):
        return "ai"

    if any(t in kw for t in ["content marketing", "content strategy", "seo content", "blog strategy", "copywriting", "editorial"]):
        return "content_marketing"

    if any(t in kw for t in ["payroll", "salary management", "employee compensation", "payslip", "wage", "compensation management"]):
        return "payroll"

    if any(t in kw for t in ["banking", "bank automation", "core banking", "digital banking", "fintech", "payment processing", "loan origination", "financial services", "treasury"]):
        return "banking"

    if any(t in kw for t in ["hr software", "human resource", "hris", "hrms", "talent acquisition", "employee onboarding", "workforce management", "hr tech", "hr automation"]):
        return "hr_tech"

    if any(t in kw for t in ["ipl", "cricket", "football", "soccer", "nfl", "nba", "tennis", "sports", "league", "tournament", "match", "player", "team"]):
        return "sports"

    if any(t in kw for t in ["ecommerce", "e-commerce", "online store", "shopify", "magento", "woocommerce", "shopping cart", "marketplace"]):
        return "ecommerce"

    if any(t in kw for t in ["saas", "software as a service", "subscription software", "cloud software", "arr", "churn", "product-led growth"]):
        return "saas"

    return "general"


class SemanticBaseline:
    """
    Unified Single Source of Truth object storing normalized semantic baseline for Phase 3 Topic Coverage.
    """
    def __init__(self, keyword: str, pages: List[Dict[str, Any]], profiles: List[Dict[str, Any]]):
        self.keyword = keyword
        self.pages = pages
        self.profiles = profiles
        
        self.core_topics: List[str] = []
        self.supporting_topics: List[str] = []
        self.subtopics: List[str] = []
        self.industry_concepts: List[str] = []
        self.by_type: Dict[str, List[str]] = {
            "organizations": [],
            "products": [],
            "technologies": [],
            "concepts": [],
            "regulations": [],
            "industry_terms": [],
            "locations": [],
            "people": []
        }
        self.questions: List[str] = []
        self.use_cases: List[str] = []
        self.implementation_topics: List[str] = []
        self.business_coverage: List[str] = []
        self.intent_signals: List[str] = []
        self.topic_clusters: List[Dict[str, Any]] = []
        self.clean_profiles: List[Dict[str, Any]] = []
        
        self._build_baseline()

    def _build_baseline(self):
        all_raw = []
        headings = []
        for p in self.profiles:
            all_raw.extend(p.get("_raw_entities", []))
            headings.extend(p.get("_headings", []))

        label_map = {
            "ORG": "organizations",
            "PRODUCT": "products",
            "TECHNOLOGY": "technologies",
            "CONCEPT": "concepts",
            "REGULATION": "regulations",
            "CUSTOM_KEYWORD": "industry_terms",
            "GPE": "locations",
            "PERSON": "people",
            "NOUN_CHUNK": "concepts",
        }

        for e in all_raw:
            norm = _normalize_semantic_concept(e.get("text", ""))
            if norm:
                bucket = label_map.get(e.get("entity_type", ""), "concepts")
                if norm not in self.by_type[bucket]:
                    self.by_type[bucket].append(norm)

        for h in headings:
            norm = _normalize_semantic_concept(h)
            if norm and len(norm) > 4:
                if len(self.core_topics) < 10 and norm not in self.core_topics:
                    self.core_topics.append(norm)
                elif norm not in self.supporting_topics:
                    self.supporting_topics.append(norm)

        if not self.core_topics:
            self.core_topics = [
                f"{self.keyword.title()} Architecture & Modules",
                f"{self.keyword.title()} Core Functionality",
                "Enterprise Platform Integration",
                "Workflow & Process Automation"
            ]

        for c in self.by_type["concepts"] + self.by_type["industry_terms"]:
            if c not in self.supporting_topics and c not in self.core_topics:
                self.supporting_topics.append(c)

        raw_qs = _extract_questions_from_pages(self.pages)
        self.questions = list(dict.fromkeys([
            q for q in raw_qs if _is_clean_semantic_term(q)
        ]))

        kw_title = self.keyword.title()

        use_cases_raw = []
        for h in headings[:15]:
            hn = _normalize_semantic_concept(h)
            if hn and len(hn) > 5 and "use case" not in hn.lower() and hn not in use_cases_raw:
                use_cases_raw.append(hn)
        self.use_cases = use_cases_raw[:5] if use_cases_raw else [
            f"{kw_title} for Enterprise Operations",
            f"Scalable {kw_title} Deployment",
            f"Compliance-Driven {kw_title} Implementation",
        ]

        impl_raw = []
        for e in self.by_type.get("technologies", [])[:5]:
            impl_raw.append(f"Integrating {e} with {kw_title}")
        for e in self.by_type.get("products", [])[:3]:
            impl_raw.append(f"Deploying {e}")
        self.implementation_topics = impl_raw[:5] if impl_raw else [
            f"Technical Deployment of {kw_title}",
            f"Data Migration & Legacy Integration",
            "SOC 2 & GDPR Security Compliance Verification",
        ]

        biz_raw = []
        for e in self.by_type.get("regulations", [])[:3]:
            biz_raw.append(f"{e} Compliance for {kw_title}")
        for e in self.by_type.get("organizations", [])[:3]:
            biz_raw.append(f"{e} Partnership & Integration")
        self.business_coverage = biz_raw[:4] if biz_raw else [
            f"Total Cost of Ownership (TCO) for {kw_title}",
            "Enterprise Licensing Tiers & Vendor Matrix",
            "Support SLA & Escalation Guidelines",
        ]

        intent_raw = []
        for q in self.questions[:5]:
            first_word = q.split()[0].lower() if q.split() else ""
            if first_word in ("what", "how", "why", "when", "where", "who"):
                intent_raw.append(f"{first_word.title()}-Intent Query Coverage")
        self.intent_signals = list(dict.fromkeys(intent_raw))[:4] if intent_raw else [
            "Informational Architecture Definitions",
            "Commercial Feature & Suite Comparisons",
            "Technical Implementation & API Snippets",
        ]

        self.topic_clusters = _build_topic_clusters_from_entities(all_raw, self.keyword, self.profiles)
        self.clean_profiles = [{k: v for k, v in p.items() if not k.startswith("_")} for p in self.profiles]

    def to_dict(self) -> Dict[str, Any]:
        """Convert SemanticBaseline into a clean JSON-serializable dictionary."""
        all_entities = list(dict.fromkeys([e for cat in self.by_type.values() for e in cat]))
        competitor_map = {
            p.get("domain", f"competitor-{i+1}.com"): p for i, p in enumerate(self.profiles)
        }
        return {
            "keyword": self.keyword,
            "entities": all_entities,
            "all_entity_texts": all_entities,
            "by_type": self.by_type,
            "core_topics": self.core_topics,
            "supporting_topics": self.supporting_topics,
            "topic_clusters": self.topic_clusters,
            "competitor_mapping": competitor_map,
            "profiles": self.profiles,
            "questions": self.questions,
            "use_cases": self.use_cases,
            "implementation_topics": self.implementation_topics,
            "business_coverage": self.business_coverage,
            "intent_signals": self.intent_signals,
            "clean_profiles": self.clean_profiles,
        }


def _build_semantic_baseline(
    keyword: str,
    pages: List[Dict[str, Any]],
    profiles: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    M1 Stage 2: Construct unified SemanticBaseline instance and return clean dictionary dataset.
    Single runtime implementation.
    """
    all_raw: List[Dict] = []
    for p in profiles:
        all_raw.extend(p.get("_raw_entities", []))

    logger.info("========================\n2. ENTITY NORMALIZATION\n========================")
    logger.info("First 30 entity mappings:")
    for e in all_raw[:30]:
        raw_n = e.get("entity") or e.get("text") or ""
        norm_n = _normalize_semantic_concept(raw_n) or raw_n
        logger.info("  Original: '%s' -> Normalized: '%s'", raw_n, norm_n)

    sb = SemanticBaseline(keyword, pages, profiles)
    avg_word_count = int(sum(p.get("word_count", 0) for p in pages) / max(len(pages), 1))

    all_entity_texts = list(dict.fromkeys([e for cat in sb.by_type.values() for e in cat]))
    competitor_mapping = {
        p.get("domain", f"competitor-{i+1}.com"): p for i, p in enumerate(profiles)
    }

    logger.info("========================\n3. SEMANTIC BASELINE BUILDER\n========================")
    logger.info("Total baseline entities: %d", sum(len(v) for v in sb.by_type.values()))
    logger.info("by_type: %s", sb.by_type)
    logger.info("topic_clusters (%d clusters): %s", len(sb.topic_clusters), [c.get("cluster_name", c.get("cluster")) for c in sb.topic_clusters])
    logger.info("all_entity_texts count: %d | First 30: %s", len(all_entity_texts), all_entity_texts[:30])

    return {
        "semantic_baseline_obj": sb.to_dict(),
        "entities": all_entity_texts,
        "all_entity_texts": all_entity_texts,
        "by_type": sb.by_type,
        "core_topics": sb.core_topics,
        "supporting_topics": sb.supporting_topics,
        "topic_clusters": sb.topic_clusters,
        "competitor_mapping": competitor_mapping,
        "profiles": profiles,
        "questions_covered": sb.questions,
        "use_cases": sb.use_cases,
        "implementation_topics": sb.implementation_topics,
        "business_coverage": sb.business_coverage,
        "intent_signals": sb.intent_signals,
        "total_entities": sum(len(v) for v in sb.by_type.values()),
        "total_concepts": len(sb.by_type["concepts"]) + len(sb.by_type["industry_terms"]),
        "total_topic_clusters": len(sb.topic_clusters),
        "avg_word_count": avg_word_count,
        "competitor_count": len(profiles),
        "competitor_profiles_clean": sb.clean_profiles,
    }

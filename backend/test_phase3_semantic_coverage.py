import json
from services.serp_intel_service import _extract_deterministic_serp_data

KEYWORDS_TO_TEST = [
    "CRM Software",
    "AI Content Marketing",
    "Project Management Software",
    "Cyber Security",
    "SAP ERP",
    "Cloud CRM",
    "Artificial Intelligence"
]

SAMPLE_PAGES_MAP = {
    "CRM Software": [
        {"domain": "salesforce.com", "title": "CRM Software Platform", "word_count": 2800, "body_content": "# Customer Relationship Management (CRM)\nManage sales pipelines, customer interactions, contact management, and lead generation.\n## Core CRM Features\nSales automation, contact management, REST API integrations, SOC 2 compliance."},
        {"domain": "hubspot.com", "title": "HubSpot Free CRM", "word_count": 1900, "body_content": "# HubSpot CRM Suite\nFree CRM software for small businesses.\n## Features\nDeal pipeline, contact tracking, email marketing, pricing tiers."}
    ],
    "AI Content Marketing": [
        {"domain": "jasper.ai", "title": "AI Content Marketing Assistant", "word_count": 2500, "body_content": "# AI Content Generation\nGenerative AI for marketing copy, blog posts, SEO optimization, and brand voice.\n## Capabilities\nLarge Language Model (LLM) generation, keyword LSI optimization, multi-channel distribution."}
    ],
    "Project Management Software": [
        {"domain": "monday.com", "title": "Project Management Software", "word_count": 3100, "body_content": "# Work OS Project Management\nTask management, Kanban boards, Gantt charts, sprint planning, and team collaboration."}
    ],
    "Cyber Security": [
        {"domain": "paloaltonetworks.com", "title": "Enterprise Cyber Security", "word_count": 3400, "body_content": "# Cyber Security & Zero Trust Architecture\nThreat intelligence, endpoint protection, firewall security, cloud infrastructure compliance, ISO 27001."}
    ],
    "SAP ERP": [
        {"domain": "sap.com", "title": "SAP S/4HANA Enterprise ERP", "word_count": 4200, "body_content": "# Enterprise Resource Planning (ERP)\nSupply chain management, financial accounting FI/CO, materials management MM, and SAP S/4HANA architecture."}
    ],
    "Cloud CRM": [
        {"domain": "freshworks.com", "title": "Freshsales Cloud CRM", "word_count": 1800, "body_content": "# Cloud Customer Relationship Management\nSaaS sales cloud, deal tracking, contact scoring, and REST API webhooks."}
    ],
    "Artificial Intelligence": [
        {"domain": "ibm.com", "title": "What is Artificial Intelligence (AI)?", "word_count": 3600, "body_content": "# Artificial Intelligence Overview\nMachine learning (ML), deep learning neural networks, natural language processing (NLP), computer vision, and AI ethics."}
    ]
}

def run_phase3_validation():
    print("RUNNING PHASE 3 TOPIC COVERAGE ENGINE AUDIT ACROSS 7 KEYWORDS:\n" + "="*85)
    
    baseline_signatures = {}
    
    for kw in KEYWORDS_TO_TEST:
        pages = SAMPLE_PAGES_MAP.get(kw, [])
        out = _extract_deterministic_serp_data(kw, pages)
        
        tc = out.get("topic_coverage", {})
        score = tc.get("coverage_score")
        depth = tc.get("depth_rating")
        cats = tc.get("categories", [])
        core_topics = tc.get("covered_core_topics", [])
        supporting_topics = tc.get("covered_supporting_topics", [])
        missing_topics = tc.get("missing_topics", [])
        
        # Check for noise or competitor slogans
        slogans = ["our", "my", "best-in-class", "try free", "click here", "sign up"]
        has_slogans = any(any(s in t.lower() for s in slogans) for t in core_topics + supporting_topics)
        
        noise_terms = ["2026", "18 jun", "22:23", "home", "video", "profile", "login", "cookie"]
        has_noise = any(any(n in t.lower() for n in noise_terms) for t in core_topics + supporting_topics)

        signature = f"Score:{score}|Core:{len(core_topics)}|Supp:{len(supporting_topics)}|Miss:{len(missing_topics)}"
        baseline_signatures[kw] = signature

        print(f"Keyword: '{kw}'")
        print(f"  -> Coverage Score: {score}% ({depth})")
        print(f"  -> Category Breakdown Count: {len(cats)} categories")
        print(f"  -> Core Topics ({len(core_topics)}): {core_topics[:3]}")
        print(f"  -> Supporting Topics ({len(supporting_topics)}): {supporting_topics[:3]}")
        print(f"  -> Missing Opportunities ({len(missing_topics)}): {missing_topics[:2]}")
        print(f"  -> Clean Check: Slogans Present={has_slogans} | Noise Present={has_noise}")
        print("-" * 85)

        assert not has_slogans, f"Marketing slogans detected in '{kw}' semantic topics!"
        assert not has_noise, f"Noise/Dates detected in '{kw}' semantic topics!"
        assert len(cats) >= 7, f"Multi-dimensional category breakdown missing categories for '{kw}'!"

    # Verify keyword variation (no identical signatures across all keywords)
    unique_sigs = set(baseline_signatures.values())
    assert len(unique_sigs) >= 4, f"Topic Coverage baselines are too similar across keywords! Signatures: {baseline_signatures}"

    print("SUCCESS: Phase 3 Topic Coverage Engine refactor complete! All 7 keywords produce clean, normalized, keyword-specific semantic baselines!")

if __name__ == "__main__":
    run_phase3_validation()

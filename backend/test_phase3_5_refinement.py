import json
from services.serp_intel_service import _extract_deterministic_serp_data

TEST_KEYWORDS = [
    "AI Content Marketing",
    "CRM Software",
    "Project Management Software",
    "ERP System"
]

SAMPLE_PAGES = {
    "AI Content Marketing": [
        {"domain": "jasper.ai", "title": "24 Good Free SEO Tool for AI Marketing", "word_count": 2600, "body_content": "# AI Content Marketing & SEO Tools\nOur Cut-Edge Platform provides technical implementation details for content strategy, topic clustering, and LLM optimization.\n## Pricing Model\nFree trial, starter pricing, enterprise cost tiers."},
        {"domain": "copy.ai", "title": "Five Tool for Copywriting", "word_count": 1900, "body_content": "# Automated Copywriting Engine\nAI writing platform for email marketing, social copy, and SEO automation."}
    ],
    "CRM Software": [
        {"domain": "salesforce.com", "title": "CRM Software Platform", "word_count": 2800, "body_content": "# Customer Relationship Management (CRM)\nManage sales pipelines, contact tracking, REST API integrations, and SOC 2 security compliance."},
        {"domain": "hubspot.com", "title": "HubSpot CRM Suite", "word_count": 1850, "body_content": "# HubSpot CRM Software\nFree CRM platform for sales teams with deal pipelines."}
    ],
    "Project Management Software": [
        {"domain": "monday.com", "title": "Project Management Software", "word_count": 3100, "body_content": "# Work OS Project Management\nTask management, Kanban boards, Gantt charts, resource allocation, and workflow automation."}
    ],
    "ERP System": [
        {"domain": "sap.com", "title": "Enterprise ERP System S/4HANA", "word_count": 4200, "body_content": "# SAP ERP System\nSupply chain management, financial accounting FI/CO, materials management, and in-memory cloud ERP."}
    ]
}

def run_phase3_5_audit():
    print("RUNNING PHASE 3.5 SEMANTIC ENGINE REFINEMENT AUDIT ACROSS 4 KEYWORDS:\n" + "="*85)
    
    for kw in TEST_KEYWORDS:
        pages = SAMPLE_PAGES.get(kw, [])
        out = _extract_deterministic_serp_data(kw, pages)
        
        tc = out.get("topic_coverage", {})
        clusters = out.get("semantic_analysis", {}).get("semantic_clusters", [])
        core_topics = tc.get("covered_core_topics", [])
        supporting_topics = tc.get("covered_supporting_topics", [])
        
        # Check for noise phrases
        noisy_phrases = ["24 good free seo tool", "good free seo tool", "five tool", "our cut-edge platform", "24 good seo tool"]
        found_noise = []
        for t in core_topics + supporting_topics:
            for n in noisy_phrases:
                if n in t.lower():
                    found_noise.append(t)

        print(f"Keyword: '{kw}'")
        print(f"  -> Coverage Index: {tc.get('coverage_score')}% ({tc.get('depth_rating')})")
        print(f"  -> Core Topics ({len(core_topics)}): {core_topics[:4]}")
        print(f"  -> Supporting Topics ({len(supporting_topics)}): {supporting_topics[:5]}")
        print(f"  -> Semantic Clusters ({len(clusters)} clusters):")
        
        for c in clusters[:4]:
            c_name = c.get("cluster_name") or c.get("cluster")
            c_cnt = c.get("entity_count") or c.get("cluster_size")
            c_conf = c.get("confidence_score")
            c_ents = c.get("normalized_entities", c.get("terms", []))
            print(f"       • '{c_name}' (Count: {c_cnt}, Conf: {c_conf}%): {c_ents[:4]}")
            assert c_cnt >= 3, f"Cluster '{c_name}' has fewer than 3 entities! ({c_cnt})"
            assert c_conf is not None and c_conf >= 80, f"Cluster '{c_name}' missing confidence score!"

        print(f"  -> Noise Verification: Found Noise={found_noise}")
        print("-" * 85)

        assert not found_noise, f"Un-normalized noisy phrases detected in '{kw}': {found_noise}"

    print("SUCCESS: Phase 3.5 Semantic Engine Refinement audit passed! All entities are normalized, clusters balanced (min 3 entities), and 0 noisy phrases present!")

if __name__ == "__main__":
    run_phase3_5_audit()

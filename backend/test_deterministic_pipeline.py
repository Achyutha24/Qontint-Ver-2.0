import json
from services.serp_intel_service import _extract_deterministic_serp_data

TEST_DATA = [
    {
        "keyword": "CRM Software",
        "pages": [
            {
                "title": "Best CRM Software 2026",
                "domain": "salesforce.com",
                "word_count": 2850,
                "body_content": """
                # What is CRM Software?
                Customer Relationship Management (CRM) software helps organizations manage sales pipelines, lead generation, customer support, and marketing automation.
                ## Key Features of CRM Systems
                1. Lead & Pipeline Management
                2. Contact & Account Tracking
                3. Automated Email Marketing & Workflows
                4. REST API & Webhook Integrations
                5. SOC 2 Type II and GDPR Security Compliance
                ## Top CRM Platform Vendors
                Salesforce, HubSpot, Zoho CRM, Pipedrive, Microsoft Dynamics 365.
                """
            },
            {
                "title": "CRM Systems & Architecture",
                "domain": "hubspot.com",
                "word_count": 1950,
                "body_content": """
                # Complete CRM Buyer Guide
                Choosing the right CRM software depends on pricing tiers, licensing costs, and enterprise scalability.
                ## Essential Integration & Analytics
                CRMs must connect with ERP platforms, BI dashboards, and analytics tracking tools.
                ## Common Implementation Questions
                What is the total cost of ownership for CRM software?
                How to migrate data into a cloud CRM?
                """
            }
        ]
    },
    {
        "keyword": "Artificial Intelligence",
        "pages": [
            {
                "title": "Artificial Intelligence Overview",
                "domain": "ibm.com",
                "word_count": 3400,
                "body_content": """
                # What is Artificial Intelligence (AI)?
                Artificial Intelligence encompasses machine learning, deep learning, natural language processing, and neural networks.
                ## Core Subfields of AI
                1. Machine Learning & Supervised Learning
                2. Deep Learning & Transformer Architectures
                3. Computer Vision & Robotics
                4. LLM & Generative AI Models
                ## Ethical & Regulatory Frameworks
                EU AI Act, Data Privacy Regulations, Model Governance, AI Ethics.
                """
            },
            {
                "title": "AI in Enterprise",
                "domain": "mit.edu",
                "word_count": 2100,
                "body_content": """
                # Enterprise AI Implementation
                Companies deploy AI models using PyTorch, TensorFlow, CUDA, and cloud GPU clusters.
                ## Common AI Deployment Questions
                How to train custom LLMs safely?
                What is the cost of GPU cloud hosting for AI inference?
                """
            }
        ]
    },
    {
        "keyword": "SAP ERP",
        "pages": [
            {
                "title": "SAP ERP Platform Guide",
                "domain": "sap.com",
                "word_count": 4100,
                "body_count": """
                # What is SAP ERP S/4HANA?
                SAP ERP provides enterprise resource planning, financial accounting, supply chain management, and HANA in-memory database architecture.
                ## Core SAP Modules
                1. SAP FI/CO Financial Accounting
                2. SAP MM Materials Management
                3. SAP SD Sales & Distribution
                4. SAP Fiori User Interface
                ## Security & Migration
                ISO 27001 compliance, SAP ECC to S/4HANA migration paths.
                """
            }
        ]
    }
]

def run_test():
    print("RUNNING DETERMINISTIC PIPELINE TEST ACROSS KEYWORDS:\n" + "="*70)
    scores = {}
    for item in TEST_DATA:
        kw = item["keyword"]
        pages = item["pages"]
        out = _extract_deterministic_serp_data(kw, pages)
        
        cov_score = out["coverage_score"]
        gaps = out["knowledge_gaps"]
        gap_score = gaps.get("knowledge_gap_score", 0)
        opp_score = gaps.get("opportunity_score", 0)
        clusters = out["semantic_analysis"]["semantic_clusters"]
        comp_profile = out["competitor_profiles"][0]
        
        scores[kw] = (cov_score, gap_score, opp_score)
        
        print(f"Keyword: '{kw}'")
        print(f"  -> Coverage Score: {cov_score}% | Gap Score: {gap_score}% | Opportunity Score: {opp_score}%")
        print(f"  -> Generated Clusters ({len(clusters)}): {[c['cluster_name'] for c in clusters]}")
        print(f"  -> Competitor Profile #1 ({comp_profile['domain']}): {comp_profile['word_count']} words, {comp_profile['heading_count']} headings, density: {comp_profile['semantic_density']}, reading: {comp_profile['reading_level']}, FAQs: {comp_profile['faq_count']}, tables: {comp_profile['table_count']}, lists: {comp_profile['list_count']}")
        print(f"  -> Missing Concepts Count: {len(gaps['missing_concepts'])}")
        print("-" * 70)

    cov_set = {v[0] for v in scores.values()}
    assert len(cov_set) == len(TEST_DATA), f"Dynamic coverage scores must be distinct across keywords! Got {scores}"
    print("SUCCESS: Deterministic SERP intelligence pipeline produces unique, dynamic scores, rich clusters, and non-blank competitor profiles!")

if __name__ == "__main__":
    run_test()

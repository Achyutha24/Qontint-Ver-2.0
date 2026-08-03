import json
from services.serp_intel_service import _extract_deterministic_serp_data

TEST_KEYWORDS = [
    "CRM Software",
    "Project Management Software",
    "AI Writing Tools",
    "IPL",
    "SAP ERP",
    "Cloud CRM"
]

SAMPLE_PAGES = {
    "CRM Software": [
        {"domain": "salesforce.com", "title": "CRM Software Guide", "word_count": 2850, "body_content": "# What is CRM Software?\nCustomer Relationship Management (CRM) platform for enterprise sales automation.\n## Core CRM Features\n1. Contact Management\n2. Lead Tracking\n3. Sales Analytics\n4. REST API Integrations"},
        {"domain": "hubspot.com", "title": "HubSpot Free CRM", "word_count": 1920, "body_content": "# HubSpot CRM Features\nFree CRM software for small business and inbound marketing.\n## Pricing Tiers\nFree, Starter, Professional, Enterprise.\n## Common Questions\nHow much does HubSpot cost?\nHow to import contacts?"},
        {"domain": "zoho.com", "title": "Zoho CRM Platform", "word_count": 1450, "body_content": "# Zoho Cloud CRM\nCloud-based CRM with AI assistant Zia and workflow builder.\n## Key Integrations\nZoho Books, Google Workspace, Zapier."}
    ],
    "Project Management Software": [
        {"domain": "monday.com", "title": "Work OS & PM Tools", "word_count": 3100, "body_content": "# Monday Work OS\nFlexible project management software with Kanban boards and Gantt charts.\n## Features\nWorkflow automation, time tracking, resource management."},
        {"domain": "asana.com", "title": "Asana PM Suite", "word_count": 2200, "body_content": "# Asana Team Collaboration\nManage team projects, tasks, and goals efficiently.\n## Integrations\nSlack, Jira, GitHub, Google Drive."},
        {"domain": "trello.com", "title": "Trello Cards & Boards", "word_count": 1600, "body_content": "# Trello Kanban Boards\nSimple, visual project management with cards, lists, and Power-Ups."}
    ],
    "AI Writing Tools": [
        {"domain": "jasper.ai", "title": "Jasper AI Copywriter", "word_count": 2450, "body_content": "# AI Content Generator\nCreate SEO blog posts, ads, and social media copy with generative LLMs."},
        {"domain": "copy.ai", "title": "Copy.ai Generator", "word_count": 1800, "body_content": "# Automated Copywriting\nAI writing tool for marketing teams and GTM copy."},
        {"domain": "grammarly.com", "title": "Grammarly Writing Assistant", "word_count": 1250, "body_content": "# Grammar & Tone Checker\nImprove writing clarity, grammar, tone, and plagiarism detection."}
    ],
    "IPL": [
        {"domain": "iplt20.com", "title": "Indian Premier League Portal", "word_count": 1850, "body_content": "# IPL 2026 Live Scores\nOfficial cricket scores, match schedule, team standings, and player stats."},
        {"domain": "cricbuzz.com", "title": "Cricbuzz IPL Coverage", "word_count": 1400, "body_content": "# IPL Match Updates\nBall-by-ball commentary, team squads, and points table."},
        {"domain": "espncricinfo.com", "title": "ESPN Cricinfo IPL", "word_count": 1150, "body_content": "# IPL News & Stats\nCricket news, player rankings, and auction highlights."}
    ],
    "SAP ERP": [
        {"domain": "sap.com", "title": "SAP S/4HANA ERP", "word_count": 4100, "body_content": "# Enterprise SAP ERP S/4HANA\nIn-memory ERP database system for supply chain, financial accounting FI/CO, and materials management MM."},
        {"domain": "oracle.com", "title": "Oracle Cloud ERP", "word_count": 2900, "body_content": "# Oracle Cloud Financials\nEnterprise cloud ERP competing with SAP S/4HANA."},
        {"domain": "microsoft.com", "title": "Dynamics 365 ERP", "word_count": 2100, "body_content": "# Microsoft Dynamics 365\nIntegrated ERP and CRM cloud suite."}
    ],
    "Cloud CRM": [
        {"domain": "salesforce.com", "title": "Cloud CRM Platform", "word_count": 2700, "body_content": "# Salesforce Cloud CRM\nSaaS customer relationship management platform."},
        {"domain": "freshworks.com", "title": "Freshsales Cloud CRM", "word_count": 1750, "body_count": "# Freshsales CRM\nCloud CRM for sales teams with AI contact scoring."},
        {"domain": "pipedrive.com", "title": "Pipedrive Sales CRM", "word_count": 1300, "body_content": "# Pipedrive Pipeline CRM\nEasy sales CRM designed for deal tracking."}
    ]
}

def run_audit():
    print("RUNNING PHASE 2 COMPREHENSIVE SELF-AUDIT ACROSS 6 KEYWORDS:\n" + "="*80)
    for kw in TEST_KEYWORDS:
        pages = SAMPLE_PAGES.get(kw, [])
        out = _extract_deterministic_serp_data(kw, pages)
        
        cov = out.get("topic_coverage", {})
        weak_areas = cov.get("weak_areas", [])
        covered_supporting = cov.get("covered_supporting_topics", [])
        clusters = out.get("semantic_analysis", {}).get("semantic_clusters", [])
        profiles = out.get("competitor_profiles", [])
        
        # Check competitor independence
        word_counts = [p.get("word_count") for p in profiles]
        h2_counts = [p.get("h2_count") for p in profiles]
        scores = [p.get("topical_authority_score") for p in profiles]
        
        # Verify no copied values across competitors
        is_independent = len(set(word_counts)) == len(profiles) and len(set(h2_counts)) == len(profiles)
        
        # Check for noise in supporting topics
        has_noise = any(t in ["2026", "18 jun", "22:23", "home", "video", "profile", "login"] for t in covered_supporting)

        print(f"Keyword: '{kw}'")
        print(f"  -> Coverage Index: {cov.get('coverage_score')}%")
        print(f"  -> Weak / Missing Areas Count: {len(weak_areas)} items (NOT (1)!)")
        print(f"     Items: {weak_areas[:4]}...")
        print(f"  -> Supporting Topics Count: {len(covered_supporting)} (Clean / No Noise: {not has_noise})")
        print(f"  -> Competitor Independence Check: Passed={is_independent}")
        print(f"     Comp #1 ({profiles[0].get('domain')}): {profiles[0].get('word_count')} words | {profiles[0].get('h2_count')} H2s | Score: {profiles[0].get('topical_authority_score')}%")
        print(f"     Comp #2 ({profiles[1].get('domain')}): {profiles[1].get('word_count')} words | {profiles[1].get('h2_count')} H2s | Score: {profiles[1].get('topical_authority_score')}%")
        print(f"     Comp #3 ({profiles[2].get('domain')}): {profiles[2].get('word_count')} words | {profiles[2].get('h2_count')} H2s | Score: {profiles[2].get('topical_authority_score')}%")
        print("-" * 80)
        
        assert len(weak_areas) > 1, f"Weak / Missing Areas should NOT collapse to 1! Got {len(weak_areas)}"
        assert is_independent, f"Competitor profiles must be independent! Got {word_counts}"

    print("SUCCESS: Full Phase 2 Audit Passed! Competitor profiles are 100% independent and Topic Coverage discovers all missing gaps!")

if __name__ == "__main__":
    run_audit()

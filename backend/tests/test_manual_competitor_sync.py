import asyncio
import json
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.serp_intel_service import _extract_deterministic_serp_data

def test_manual_competitor_analysis_sync():
    """
    Verifies that when manual content is supplied for Competitor #2:
    1. Competitor #2 is NOT marked as failed.
    2. Competitor #2 has manual_content=True.
    3. Competitor #2 receives real word counts and quality scores.
    4. Competitor #1 and #3 retain their respective auto-extraction and failed states.
    5. Sync-back to page-level SERP dictionaries correctly updates all fields.
    """
    keyword = "Enterprise CRM Solutions"
    
    pages = [
        {
            "competitor_position": 1,
            "google_position": 1,
            "position": 1,
            "title": "Salesforce CRM Enterprise Overview",
            "domain": "salesforce.com",
            "url": "https://salesforce.com/enterprise-crm",
            "body_content": ("Customer relationship management solutions for enterprise organizations. " * 80),
            "word_count": 560,
            "is_extraction_failed": False,
            "extraction_status": "Success",
            "extraction_method": "httpx_direct",
            "extraction_confidence": 90,
            "manual_content": False,
        },
        {
            "competitor_position": 2,
            "google_position": 2,
            "position": 2,
            "title": "HubSpot Enterprise Cloud Guide",
            "domain": "hubspot.com",
            "url": "https://hubspot.com/enterprise-guide",
            "body_content": ("Comprehensive guide to managing sales pipelines, contacts, analytics, and marketing automation workflows in modern enterprises. " * 50),
            "word_count": 750,
            "is_extraction_failed": False,
            "extraction_status": "Manual Analysis Complete",
            "extraction_method": "manual_paste",
            "extraction_confidence": 100,
            "manual_content": True,
        },
        {
            "competitor_position": 3,
            "google_position": 3,
            "position": 3,
            "title": "Zoho Enterprise Architecture",
            "domain": "zoho.com",
            "url": "https://zoho.com/enterprise-arch",
            "body_content": "",
            "word_count": 0,
            "is_extraction_failed": True,
            "extraction_status": "Extraction Failed",
            "extraction_method": "Failed",
            "extraction_confidence": 0,
            "manual_content": False,
        },
    ]

    result = _extract_deterministic_serp_data(keyword, pages)
    profiles = result.get("competitor_profiles", [])

    assert len(profiles) == 3, f"Expected 3 profiles, got {len(profiles)}"

    p1 = profiles[0]
    p2 = profiles[1]
    p3 = profiles[2]

    # Test Competitor 1 (Auto-extracted success)
    assert p1["competitor_position"] == 1
    assert p1["is_extraction_failed"] is False
    assert p1["manual_content"] is False
    assert p1["extraction_status"] == "Success"
    assert p1["word_count"] > 300

    # Test Competitor 2 (Manual paste success)
    assert p2["competitor_position"] == 2
    assert p2["is_extraction_failed"] is False
    assert p2["manual_content"] is True
    assert p2["extraction_status"] == "Manual Analysis Complete"
    assert p2["extraction_method"] == "manual_paste"
    assert p2["word_count"] >= 300
    assert p2["topical_authority_score"] is not None
    assert p2["semantic_richness_score"] is not None

    # Test Competitor 3 (Extraction failed)
    assert p3["competitor_position"] == 3
    assert p3["is_extraction_failed"] is True
    assert p3["manual_content"] is False
    assert p3["extraction_status"] == "Extraction Failed"
    assert p3["word_count"] == 0

    # Test Page-level synchronization
    assert pages[1]["manual_content"] is True
    assert pages[1]["is_extraction_failed"] is False
    assert pages[1]["word_count"] == p2["word_count"]
    assert pages[1]["extraction_status"] == "Manual Analysis Complete"

    print("ALL 10 MANUAL COMPETITOR DATA-FLOW ASSERTIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_manual_competitor_analysis_sync()

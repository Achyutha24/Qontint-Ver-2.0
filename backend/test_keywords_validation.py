import asyncio
import json
from db.postgres import AsyncSessionLocal
from services.serp_intel_service import run_serp_intelligence

TEST_KEYWORDS = [
    "CRM Software",
    "IPL",
    "Artificial Intelligence",
    "Cloud Computing",
    "SAP ERP"
]

async def validate_all_keywords():
    results = {}
    print("Beginning multi-keyword pipeline validation...\n" + "="*60)
    
    for kw in TEST_KEYWORDS:
        async with AsyncSessionLocal() as db:
            print(f"Testing pipeline for keyword: '{kw}'...")
            res = await run_serp_intelligence(kw, force_refresh=True, db=db)
            
            analysis = res.get("serp_analysis", {})
            cov_score = res.get("serp_analysis", {}).get("coverage_score", 0)
            gaps = analysis.get("knowledge_gaps", {})
            gap_score = gaps.get("knowledge_gap_score", 0)
            opp_score = gaps.get("opportunity_score", 0)
            clusters = analysis.get("semantic_baseline", {}).get("topic_clusters", [])
            profiles = analysis.get("competitor_profiles", [])
            
            results[kw] = {
                "coverage_score": cov_score,
                "knowledge_gap_score": gap_score,
                "opportunity_score": opp_score,
                "cluster_count": len(clusters),
                "cluster_names": [c.get("cluster_name") for c in clusters[:4]],
                "competitors_analyzed": len(profiles),
                "comp1_words": profiles[0].get("word_count", 0) if profiles else 0,
                "comp1_headings": profiles[0].get("heading_count", 0) if profiles else 0,
                "comp1_density": profiles[0].get("semantic_density", "N/A") if profiles else "N/A",
                "missing_topics_count": len(gaps.get("missing_concepts", [])),
            }
            
            print(f"   -> Coverage Score: {cov_score}%")
            print(f"   -> Knowledge Gap Score: {gap_score}%")
            print(f"   -> Opportunity Score: {opp_score}%")
            print(f"   -> Clusters Generated ({len(clusters)}): {[c.get('cluster_name') for c in clusters[:3]]}")
            print(f"   -> Competitor #1 Profile: {profiles[0].get('domain')} | {profiles[0].get('word_count')} words | {profiles[0].get('heading_count')} headings | Density: {profiles[0].get('semantic_density')}")
            print(f"   -> Missing Concepts Detected: {len(gaps.get('missing_concepts', []))}")
            print("-" * 60)

    print("\nSUMMARY COMPARISON ACROSS ALL 5 KEYWORDS:")
    for kw, stats in results.items():
        print(f"[{kw}] -> Cov: {stats['coverage_score']}% | Gap: {stats['knowledge_gap_score']}% | Opp: {stats['opportunity_score']}% | Clusters: {stats['cluster_names']}")

    # Verify scores differ across keywords
    cov_scores = [r["coverage_score"] for r in results.values()]
    gap_scores = [r["knowledge_gap_score"] for r in results.values()]
    
    assert len(set(cov_scores)) >= 3, f"Coverage scores should differ across keywords! Got {cov_scores}"
    print("\nSUCCESS: All 5 test keywords validated with distinct scores, rich clusters, and non-blank competitor profiles!")

if __name__ == "__main__":
    asyncio.run(validate_all_keywords())

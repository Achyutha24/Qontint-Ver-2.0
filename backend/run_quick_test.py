import asyncio
from db.postgres import AsyncSessionLocal
from services.serp_intel_service import run_serp_intelligence

async def test():
    keywords = ['CRM Software', 'Artificial Intelligence', 'SAP ERP']
    for kw in keywords:
        async with AsyncSessionLocal() as db:
            res = await run_serp_intelligence(kw, force_refresh=True, db=db)
            a = res['serp_analysis']
            cov = a['coverage_score']
            gaps = a['knowledge_gaps']
            opp = gaps['opportunity_score']
            gap_sc = gaps['knowledge_gap_score']
            clusters = [c['cluster_name'] for c in a['semantic_baseline']['topic_clusters'][:3]]
            comp = a['competitor_profiles'][0]
            print(f"KW: '{kw}' | Coverage: {cov}% | Gap Score: {gap_sc}% | Opp Score: {opp}%")
            print(f"   Clusters: {clusters}")
            print(f"   Comp #1 ({comp['domain']}): {comp['word_count']} words | {comp['heading_count']} headings | Density: {comp['semantic_density']} | Reading Level: {comp['reading_level']}")
            print("-" * 70)

if __name__ == "__main__":
    asyncio.run(test())

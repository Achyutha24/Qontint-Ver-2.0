import asyncio
from db.postgres import AsyncSessionLocal
from services.cache_manager import CacheManager

import uuid

async def test():
    test_key = f"test_key_{uuid.uuid4().hex[:8]}"
    async with AsyncSessionLocal() as db:
        k1 = await CacheManager.create_new_analysis_version(db, test_key, 'CRM Software')
        k2 = await CacheManager.create_new_analysis_version(db, test_key, 'CRM Software')
        k3 = await CacheManager.create_new_analysis_version(db, test_key, 'CRM Software')
        print(f"Created versions: v{k1.analysis_version}, v{k2.analysis_version}, v{k3.analysis_version}")
        print(f"Latest flags: v1={k1.is_latest}, v2={k2.is_latest}, v3={k3.is_latest}")
        assert k1.analysis_version == 1
        assert k2.analysis_version == 2
        assert k3.analysis_version == 3
        assert k1.is_latest == False
        assert k2.is_latest == False
        assert k3.is_latest == True
        print("SUCCESS: Multiple version creation test passed cleanly!")

if __name__ == "__main__":
    asyncio.run(test())

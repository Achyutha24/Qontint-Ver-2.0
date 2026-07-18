import asyncio
import json
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from config import settings
from services.unified_analysis import run_unified_analysis
import logging
logging.basicConfig(level=logging.INFO)

async def test():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as db:
        result = await run_unified_analysis(
            content="B2B Procurement software is essential for managing vendor relationships and optimizing spend.",
            keyword="B2B Procurement Software",
            vertical="b2b_saas",
            db=db,
        )
        
        print("COMPETITOR COMPARISON IS:", "PRESENT" if result.get("competitor_comparison") else "NULL")
        if result.get("competitor_comparison"):
            print(json.dumps(result["competitor_comparison"], indent=2))

if __name__ == "__main__":
    asyncio.run(test())

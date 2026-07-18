import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from services.serp_intel_service import run_serp_intelligence
from models.db import Base

async def test_serp_intel():
    engine = create_async_engine("sqlite+aiosqlite:///./qontint.db")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        try:
            result = await run_serp_intelligence(
                keyword="E-Commerce Platforms",
                search_engine="Google",
                country="us",
                language="en",
                device="desktop",
                db=db
            )
            print("Success!")
            print(result)
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_serp_intel())

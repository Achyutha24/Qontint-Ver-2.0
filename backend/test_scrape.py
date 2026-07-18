import asyncio
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from config import settings
from services.serp_collector import collect_serp_for_keyword
from models.db import Keyword
from sqlalchemy import select

logging.basicConfig(level=logging.INFO)

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as db:
        kw_result = await db.execute(select(Keyword).where(Keyword.query == "B2B Procurement Software"))
        kw = kw_result.scalars().first()
        if kw:
            res = await collect_serp_for_keyword(kw.id, kw.vertical, db, fast_mode=True)
            print("Collect result:", res)

if __name__ == "__main__":
    asyncio.run(main())

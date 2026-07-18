import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from config import settings
from models.db import Keyword, SerpResult
from sqlalchemy import select

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as db:
        kw_result = await db.execute(select(Keyword).where(Keyword.query == "B2B Procurement Software"))
        kw = kw_result.scalars().first()
        if kw:
            print("Keyword ID:", kw.id)
            res = await db.execute(select(SerpResult).where(SerpResult.keyword_id == kw.id))
            docs = res.scalars().all()
            print("Docs count for kw:", len(docs))
            
            res_all = await db.execute(select(SerpResult))
            docs_all = res_all.scalars().all()
            print("Total docs in SerpResult table:", len(docs_all))

if __name__ == "__main__":
    asyncio.run(main())

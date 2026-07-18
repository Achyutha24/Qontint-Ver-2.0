import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from config import settings
from models.db import Keyword, SerpResult
from sqlalchemy import select

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as db:
        res = await db.execute(select(Keyword).where(Keyword.query == "B2B Procurement Software"))
        kws = res.scalars().all()
        for kw in kws:
            print(f"Keyword ID: {kw.id}, vertical: {kw.vertical}")
            r = await db.execute(select(SerpResult).where(SerpResult.keyword_id == kw.id))
            print("  Docs:", len(r.scalars().all()))

if __name__ == "__main__":
    asyncio.run(main())

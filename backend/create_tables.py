import asyncio
from db.postgres import engine
from models.db import Base

async def init_db():
    print("Creating all tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Done!")

if __name__ == "__main__":
    asyncio.run(init_db())

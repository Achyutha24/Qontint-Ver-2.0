import asyncio
import httpx

async def test_api():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://127.0.0.1:8000/api/v1/serp-intel/analyze",
            json={
                "keyword": "E-Commerce Platforms",
                "searchEngine": "Google",
                "country": "us",
                "language": "en",
                "device": "desktop"
            },
            timeout=30.0
        )
        print("Status Code:", response.status_code)
        print("Response:", response.text)

if __name__ == "__main__":
    asyncio.run(test_api())

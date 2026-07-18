import asyncio
import httpx
import urllib.parse

async def test():
    query = "B2B Procurement Software"
    encoded_query = urllib.parse.quote(query)
    
    url2 = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded_query}&utf8=&format=json&srlimit=3"
    
    headers = {"User-Agent": "QontintBot/1.0 (achyu@example.com) Mozilla/5.0"}
    async with httpx.AsyncClient(headers=headers) as client:
        r2 = await client.get(url2)
        print("Full-text text:", r2.text)

if __name__ == "__main__":
    asyncio.run(test())

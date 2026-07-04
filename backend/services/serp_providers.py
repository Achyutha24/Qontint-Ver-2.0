import abc
import logging
import httpx
from typing import Any, List, Dict
import asyncio
from bs4 import BeautifulSoup
from ddgs import DDGS
from fastapi import HTTPException
from config import settings

logger = logging.getLogger(__name__)

class SerpProvider(abc.ABC):
    @abc.abstractmethod
    async def search(self, query: str, max_results: int = 3) -> List[Dict[str, Any]]:
        """
        Returns a list of structured SERP results:
        [
            {
                "title": "Page Title",
                "url": "https://example.com",
                "meta_description": "Snippet...",
                "body_content": "Extracted main content...",
                "position": 1,
                "website_name": "Example",
                "featured_image": "url",
                "author": "Name",
                "publish_date": "2023-01-01"
            },
            ...
        ]
        """
        pass

class TavilySerpProvider(SerpProvider):
    async def search(self, query: str, max_results: int = 3) -> List[Dict[str, Any]]:
        if not settings.TAVILY_API_KEY:
            logger.warning("TAVILY_API_KEY is not set. Tavily search aborted.")
            return []
            
        url = "https://api.tavily.com/search"
        payload = {
            "api_key": settings.TAVILY_API_KEY,
            "query": query,
            "search_depth": "advanced",
            "include_images": True,
            "include_raw_content": True,
            "max_results": max_results,
            "include_domains": [],
            "exclude_domains": []
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                
                results = []
                for idx, result in enumerate(data.get("results", [])):
                    import urllib.parse
                    parsed_url = urllib.parse.urlparse(result.get("url", ""))
                    website_name = parsed_url.netloc.replace("www.", "")
                    
                    results.append({
                        "title": result.get("title", ""),
                        "url": result.get("url", ""),
                        "meta_description": result.get("content", ""),
                        "body_content": result.get("raw_content", result.get("content", "")),
                        "position": idx + 1,
                        "website_name": website_name,
                        "featured_image": None,
                        "author": "Unknown",
                        "publish_date": result.get("published_date", "")
                    })
                return results[:max_results]
        except Exception as e:
            logger.error(f"Error calling Tavily API: {e}")
            return []

class DuckDuckGoSerpProvider(SerpProvider):
    async def _fetch_html(self, client: httpx.AsyncClient, url: str) -> str:
        try:
            resp = await client.get(url, follow_redirects=True, timeout=10.0)
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            logger.warning(f"Error fetching URL {url}: {e}")
            return ""

    def _extract_text(self, html: str) -> str:
        if not html: return ""
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        return soup.get_text(separator=" ", strip=True)

    async def search(self, query: str, max_results: int = 3) -> List[Dict[str, Any]]:
        logger.info(f"Using DuckDuckGo to search for: {query}")
        try:
            def _ddg():
                with DDGS() as ddgs:
                    return list(ddgs.text(query, max_results=max_results))
            
            raw_results = await asyncio.to_thread(_ddg)
            if not raw_results:
                return []
                
            async with httpx.AsyncClient(verify=False) as client:
                html_tasks = [self._fetch_html(client, r.get("href", "")) for r in raw_results]
                html_contents = await asyncio.gather(*html_tasks)
                
            results = []
            import urllib.parse
            for idx, (result, html) in enumerate(zip(raw_results, html_contents)):
                url = result.get("href", "")
                parsed_url = urllib.parse.urlparse(url)
                website_name = parsed_url.netloc.replace("www.", "")
                
                body = self._extract_text(html)
                if len(body) < 100:
                    body = result.get("body", "")
                    
                results.append({
                    "title": result.get("title", ""),
                    "url": url,
                    "meta_description": result.get("body", ""),
                    "body_content": body,
                    "position": idx + 1,
                    "website_name": website_name,
                    "featured_image": None,
                    "author": "Unknown",
                    "publish_date": ""
                })
                
            return results[:max_results]
        except Exception as e:
            logger.error(f"Error calling DuckDuckGo: {e}")
            return []

def get_serp_provider() -> SerpProvider:
    if settings.TAVILY_API_KEY:
        return TavilySerpProvider()
    return DuckDuckGoSerpProvider()

import abc
import logging
import httpx
from typing import Any, List, Dict, Optional
from datetime import datetime, timedelta
import asyncio
import os
import urllib.parse
from config import settings

logger = logging.getLogger(__name__)

class ProviderHealthManager:
    """Manages the health status of search providers."""
    def __init__(self):
        self.stats = {}

    def get_stats(self, provider_name: str) -> dict:
        if provider_name not in self.stats:
            self.stats[provider_name] = {
                "success_count": 0,
                "failure_count": 0,
                "consecutive_failures": 0,
                "rate_limit_count": 0,
                "last_successful_request": None,
                "is_disabled_until": None
            }
        return self.stats[provider_name]

    def record_success(self, provider_name: str):
        stats = self.get_stats(provider_name)
        stats["success_count"] += 1
        stats["consecutive_failures"] = 0
        stats["last_successful_request"] = datetime.now()

    def record_failure(self, provider_name: str, is_rate_limit: bool = False):
        stats = self.get_stats(provider_name)
        stats["failure_count"] += 1
        stats["consecutive_failures"] += 1
        if is_rate_limit:
            stats["rate_limit_count"] += 1
            # Backoff for 1 minute on rate limit
            stats["is_disabled_until"] = datetime.now() + timedelta(minutes=1)
        elif stats["consecutive_failures"] >= 3:
            # Backoff for 5 minutes after 3 consecutive failures
            stats["is_disabled_until"] = datetime.now() + timedelta(minutes=5)

    def is_healthy(self, provider_name: str) -> bool:
        stats = self.get_stats(provider_name)
        if stats["is_disabled_until"] and datetime.now() < stats["is_disabled_until"]:
            return False
        return True

provider_health_manager = ProviderHealthManager()


class SERPProvider(abc.ABC):
    name: str

    @abc.abstractmethod
    async def search(self, query: str, country: str = "us", language: str = "en", max_results: int = 10) -> Dict[str, Any]:
        """
        Returns a dictionary containing:
        Returns a list of SERP results without extracting body content:
        [
            {
                "title": "Page Title",
                "url": "https://example.com",
                "snippet": "Snippet...",
                "position": 1,
                "website_name": "Example"
            }
        ]
        """
        pass


class SerperProvider(SERPProvider):
    name = "Serper.dev"

    async def search(self, query: str, country: str = "us", language: str = "en", max_results: int = 10) -> Dict[str, Any]:
        api_key = getattr(settings, "SERPER_API_KEY", os.environ.get("SERPER_API_KEY"))
        if not api_key:
            raise ValueError("SERPER_API_KEY is not set. Please add it to your .env file.")

        url = "https://google.serper.dev/search"
        payload = {
            "q": query,
            "gl": country,
            "hl": language,
            "num": max_results
        }
        headers = {
            "X-API-KEY": api_key,
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 429:
                    provider_health_manager.record_failure(self.name, is_rate_limit=True)
                    raise Exception("Rate limited by Serper.dev")
                response.raise_for_status()
                data = response.json()

                results = []
                for idx, result in enumerate(data.get("organic", [])[:max_results]):
                    parsed_url = urllib.parse.urlparse(result.get("link", ""))
                    website_name = parsed_url.netloc.replace("www.", "")
                    
                    results.append({
                        "title": result.get("title", ""),
                        "url": result.get("link", ""),
                        "snippet": result.get("snippet", ""),
                        "position": result.get("position", idx + 1),
                        "website_name": website_name
                    })
                
                provider_health_manager.record_success(self.name)
                return {
                    "results": results,
                    "raw_response": data,
                    "credits": 1,
                    "provider": self.name
                }

        except Exception as e:
            provider_health_manager.record_failure(self.name)
            logger.error(f"SerperProvider search failed: {str(e)}")
            raise e

class DuckDuckGoProvider(SERPProvider):
    name = "DuckDuckGo"

    async def search(self, query: str, country: str = "us", language: str = "en", max_results: int = 10) -> Dict[str, Any]:
        # Fallback provider if Serper fails or has no key
        from ddgs import DDGS
        try:
            loop = asyncio.get_event_loop()
            def fetch():
                return list(DDGS(timeout=10).text(query, max_results=max_results))
            
            raw_results = await loop.run_in_executor(None, fetch)
            
            results = []
            for idx, result in enumerate(raw_results):
                parsed_url = urllib.parse.urlparse(result.get("href", ""))
                website_name = parsed_url.netloc.replace("www.", "")
                results.append({
                    "title": result.get("title", ""),
                    "url": result.get("href", ""),
                    "snippet": result.get("body", ""),
                    "position": idx + 1,
                    "website_name": website_name
                })
            
            provider_health_manager.record_success(self.name)
            return {
                "results": results,
                "raw_response": raw_results,
                "credits": 0,
                "provider": self.name
            }
        except Exception as e:
            provider_health_manager.record_failure(self.name)
            logger.error(f"DuckDuckGo search failed: {str(e)}")
            raise e


def get_serp_provider() -> SERPProvider:
    provider_name = os.environ.get("SERP_PROVIDER", "serper").lower()
    
    if provider_name == "serper":
        provider = SerperProvider()
        if not provider_health_manager.is_healthy(provider.name):
            logger.warning("Serper is unhealthy. Falling back to DuckDuckGo.")
            return DuckDuckGoProvider()
        return provider
    
    return DuckDuckGoProvider()

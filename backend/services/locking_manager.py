"""
Distributed Locking Manager
────────────────────────────
Prevents duplicate analyses for the same cache_key.

If two concurrent requests arrive for the same keyword:
  - The first request acquires the lock and runs the pipeline.
  - All subsequent requests for the same cache_key wait and then get
    the completed cached result once the first pipeline finishes.
  - No duplicate SERP credits are consumed.
  - No duplicate Gemini requests are made.

This is implemented as an in-process asyncio lock (suitable for single-process
deployments). For multi-process/multi-server deployments, replace with a Redis-
backed distributed lock (e.g. redlock-py or aioredlock).
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Dict, Optional

logger = logging.getLogger("qontint.locking")

# Maximum time to hold a lock before forcibly releasing (prevents deadlocks)
LOCK_TIMEOUT_SECONDS = 180


class LockEntry:
    def __init__(self) -> None:
        self.event = asyncio.Event()
        self.acquired_at = time.monotonic()
        self.owner: Optional[str] = None  # request_id that holds the lock


class AnalysisLockManager:
    """
    Per-cache_key asyncio locking.

    Usage:
        async with lock_manager.acquire(cache_key, request_id) as acquired:
            if acquired:
                # This request owns the pipeline — run it
                ...
            else:
                # Another request finished — read from cache
                ...
    """

    def __init__(self) -> None:
        self._locks: Dict[str, LockEntry] = {}
        self._mutex = asyncio.Lock()

    async def _get_or_create(self, cache_key: str) -> LockEntry:
        async with self._mutex:
            if cache_key not in self._locks:
                self._locks[cache_key] = LockEntry()
            return self._locks[cache_key]

    async def try_acquire(self, cache_key: str, request_id: str = "") -> bool:
        """
        Try to become the owner of the cache_key lock.
        Returns True if this caller acquired ownership.
        Returns False if another caller already owns it.
        """
        async with self._mutex:
            entry = self._locks.get(cache_key)
            if entry is None:
                # No lock exists — create and own it
                entry = LockEntry()
                entry.owner = request_id
                self._locks[cache_key] = entry
                logger.info("[LOCK] Acquired lock for cache_key=%s… [%s]", cache_key[:12], request_id)
                return True

            # Check for stale lock (server crashed mid-pipeline)
            age = time.monotonic() - entry.acquired_at
            if age > LOCK_TIMEOUT_SECONDS:
                logger.warning("[LOCK] Stale lock detected (age=%.0fs) — forcing release for %s", age, cache_key[:12])
                entry.owner = request_id
                entry.acquired_at = time.monotonic()
                return True

            # Lock is actively held by someone else
            logger.info("[LOCK] Lock busy for cache_key=%s… — waiting [%s]", cache_key[:12], request_id)
            return False

    async def wait_for_completion(self, cache_key: str, timeout: float = 120.0) -> bool:
        """
        Wait for the owning request to release this lock.
        Returns True if the lock was released (pipeline complete).
        Returns False if timed out.
        """
        entry = self._locks.get(cache_key)
        if entry is None:
            return True  # No lock — nothing to wait for

        try:
            await asyncio.wait_for(entry.event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            logger.warning("[LOCK] Wait timed out for cache_key=%s", cache_key[:12])
            return False

    def release(self, cache_key: str, request_id: str = "") -> None:
        """Release the lock and signal all waiters."""
        entry = self._locks.get(cache_key)
        if entry and (entry.owner == request_id or not request_id):
            entry.event.set()           # unblock all waiters
            self._locks.pop(cache_key, None)
            logger.info("[LOCK] Released lock for cache_key=%s [%s]", cache_key[:12], request_id)

    def force_release(self, cache_key: str) -> None:
        """Force-release regardless of owner (for error recovery)."""
        self.release(cache_key, "")

    def is_locked(self, cache_key: str) -> bool:
        entry = self._locks.get(cache_key)
        if not entry:
            return False
        age = time.monotonic() - entry.acquired_at
        return age <= LOCK_TIMEOUT_SECONDS


# ── Singleton ─────────────────────────────────────────────────────────────────
lock_manager = AnalysisLockManager()

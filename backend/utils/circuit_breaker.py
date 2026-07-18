"""
Circuit Breaker
───────────────
Prevents repeated wasteful requests to Gemini/Serper when they are
consistently returning 429 / 5xx errors.

Behaviour:
  CLOSED   → normal operation, requests pass through
  OPEN     → provider is considered unhealthy; requests blocked for cooldown_secs
  HALF_OPEN→ after cooldown, one probe request is allowed through

Usage:
    cb = circuit_breaker_registry.get("gemini")
    if cb.is_open():
        raise RuntimeError("Gemini circuit is OPEN — using deterministic fallback")
    try:
        result = await call_gemini(...)
        cb.record_success()
    except RateLimitError:
        cb.record_failure()
        raise
"""
from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field
from typing import Dict

logger = logging.getLogger("qontint.circuit_breaker")

# HTTP status codes that trigger the circuit breaker
CIRCUIT_BREAKER_STATUS_CODES = {429, 500, 502, 503, 504}


@dataclass
class CircuitBreaker:
    name: str
    failure_threshold: int = 5       # failures before opening
    cooldown_secs: int = 60          # seconds to stay OPEN before probing
    success_threshold: int = 2       # successes needed to close from HALF_OPEN

    _failure_count: int = field(default=0, repr=False)
    _success_count: int = field(default=0, repr=False)
    _state: str = field(default="CLOSED", repr=False)   # CLOSED | OPEN | HALF_OPEN
    _opened_at: float = field(default=0.0, repr=False)

    # ── State checks ──────────────────────────────────────────────────────────

    def is_open(self) -> bool:
        """True if requests should be blocked right now."""
        if self._state == "CLOSED":
            return False

        if self._state == "OPEN":
            if time.monotonic() - self._opened_at >= self.cooldown_secs:
                logger.info("[CB:%s] Cooldown elapsed — entering HALF_OPEN", self.name)
                self._state = "HALF_OPEN"
                self._success_count = 0
                return False   # allow probe
            return True        # still cooling down

        # HALF_OPEN: allow through
        return False

    @property
    def state(self) -> str:
        # Calling is_open() triggers the cooldown transition side-effect
        _ = self.is_open()
        return self._state

    # ── Event recording ───────────────────────────────────────────────────────

    def record_failure(self, status_code: int = 0) -> None:
        if status_code and status_code not in CIRCUIT_BREAKER_STATUS_CODES:
            # Non-transient error (e.g. 400 bad request) — don't penalise
            return

        self._failure_count += 1
        self._success_count = 0
        logger.warning("[CB:%s] Failure recorded (%d/%d)", self.name, self._failure_count, self.failure_threshold)

        if self._state == "HALF_OPEN" or self._failure_count >= self.failure_threshold:
            self._state = "OPEN"
            self._opened_at = time.monotonic()
            logger.error("[CB:%s] Circuit OPENED — blocking requests for %ds", self.name, self.cooldown_secs)

    def record_success(self) -> None:
        self._failure_count = 0

        if self._state == "HALF_OPEN":
            self._success_count += 1
            if self._success_count >= self.success_threshold:
                self._state = "CLOSED"
                logger.info("[CB:%s] Circuit CLOSED — provider healthy", self.name)

    def reset(self) -> None:
        """Force-reset (for testing)."""
        self._state = "CLOSED"
        self._failure_count = 0
        self._success_count = 0
        self._opened_at = 0.0


class CircuitBreakerRegistry:
    """Singleton registry of named circuit breakers."""

    def __init__(self) -> None:
        self._breakers: Dict[str, CircuitBreaker] = {}

    def get(self, name: str, **kwargs) -> CircuitBreaker:
        if name not in self._breakers:
            self._breakers[name] = CircuitBreaker(name=name, **kwargs)
        return self._breakers[name]

    def all_states(self) -> dict:
        return {name: cb.state for name, cb in self._breakers.items()}


# ── Singleton ─────────────────────────────────────────────────────────────────
circuit_breaker_registry = CircuitBreakerRegistry()

# Pre-register known providers
circuit_breaker_registry.get("gemini", failure_threshold=5, cooldown_secs=60)
circuit_breaker_registry.get("serper", failure_threshold=3, cooldown_secs=120)

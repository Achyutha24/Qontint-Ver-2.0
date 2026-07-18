"""
Structured Pipeline Logger
──────────────────────────
Replaces scattered print() statements with structured JSON logging.

Every log entry includes:
  - request_id:    Unique ID for the full request lifecycle
  - keyword:       The keyword being analyzed
  - cache_key:     SHA-256 cache key (truncated)
  - stage:         Current pipeline stage
  - provider:      Gemini / Serper / spaCy / Cache
  - elapsed_ms:    Time elapsed since request start
  - retry_count:   Number of retries attempted
  - status:        OK | WARN | ERROR | SKIP
  - message:       Human-readable description
  - error:         Exception message (if any)
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Optional


# Standard Python logger (FastAPI handles formatting)
_base_logger = logging.getLogger("qontint.pipeline")


class PipelineLogger:
    """
    Context-aware logger that carries request metadata through the pipeline.
    Instantiate once per request, pass down through function calls.
    """

    def __init__(
        self,
        keyword: str = "",
        cache_key: str = "",
        search_engine: str = "Google",
        request_id: Optional[str] = None,
    ) -> None:
        self.request_id = request_id or f"req_{uuid.uuid4().hex[:12]}"
        self.keyword = keyword
        self.cache_key = cache_key[:16] + "…" if len(cache_key) > 16 else cache_key
        self.search_engine = search_engine
        self._start_ts = time.perf_counter()
        self._retry_count = 0

    # ── Convenience properties ────────────────────────────────────────────────

    @property
    def elapsed_ms(self) -> int:
        return int((time.perf_counter() - self._start_ts) * 1000)

    def increment_retry(self) -> None:
        self._retry_count += 1

    # ── Log helpers ───────────────────────────────────────────────────────────

    def _log(
        self,
        level: str,
        stage: str,
        message: str,
        provider: str = "",
        error: str = "",
    ) -> None:
        entry = {
            "request_id": self.request_id,
            "keyword": self.keyword,
            "cache_key": self.cache_key,
            "search_engine": self.search_engine,
            "stage": stage,
            "provider": provider,
            "elapsed_ms": self.elapsed_ms,
            "retry_count": self._retry_count,
            "status": level.upper(),
            "message": message,
        }
        if error:
            entry["error"] = error

        log_fn = getattr(_base_logger, level.lower(), _base_logger.info)
        log_fn("[%s] %s | stage=%s | %dms%s",
               self.request_id, message, stage, self.elapsed_ms,
               f" | err={error}" if error else "")

    def info(self, stage: str, message: str, provider: str = "") -> None:
        self._log("info", stage, message, provider=provider)

    def warn(self, stage: str, message: str, provider: str = "", error: str = "") -> None:
        self._log("warning", stage, message, provider=provider, error=error)

    def error(self, stage: str, message: str, provider: str = "", error: str = "") -> None:
        self._log("error", stage, message, provider=provider, error=error)

    def skip(self, stage: str, message: str) -> None:
        self._log("info", stage, f"[SKIP] {message}")

    def cache_hit(self, stage: str = "CACHE_LOOKUP") -> None:
        self.info(stage, "Cache HIT — returning stored result", provider="Cache")

    def cache_miss(self, stage: str = "CACHE_LOOKUP") -> None:
        self.info(stage, "Cache MISS — starting fresh pipeline", provider="Cache")

    def checkpoint(self, stage: str) -> None:
        self.info(stage, f"Checkpoint saved: {stage}")

    def complete(self, total_ms: Optional[int] = None) -> None:
        ms = total_ms or self.elapsed_ms
        self.info("REPORT_COMPLETE", f"Pipeline complete in {ms}ms")


def make_logger(
    keyword: str,
    cache_key: str = "",
    search_engine: str = "Google",
    request_id: Optional[str] = None,
) -> PipelineLogger:
    """Factory: create a new PipelineLogger for a request."""
    return PipelineLogger(
        keyword=keyword,
        cache_key=cache_key,
        search_engine=search_engine,
        request_id=request_id,
    )

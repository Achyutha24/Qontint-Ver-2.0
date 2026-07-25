"""
Qontint ML Infrastructure — Isolated Logging Utility
Provides dedicated logging for model loading, inference time, prediction success, and failures.
"""

import logging
import time
from typing import Any, Dict, Optional

# Isolated ML logger
ml_logger = logging.getLogger("qontint.ml")
if not ml_logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "[%(asctime)s] [ML-%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)
    ml_logger.addHandler(handler)
    ml_logger.setLevel(logging.INFO)


class Timer:
    """Utility timer context manager for timing ML pipeline operations."""

    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.start_time: float = 0.0
        self.elapsed_ms: float = 0.0

    def __enter__(self):
        self.start_time = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.elapsed_ms = (time.perf_counter() - self.start_time) * 1000.0
        if exc_type is None:
            ml_logger.info("[Timer] %s completed in %.2f ms", self.operation_name, self.elapsed_ms)
        else:
            ml_logger.error("[Timer Error] %s failed after %.2f ms: %s", self.operation_name, self.elapsed_ms, exc_val)

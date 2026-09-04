"""
Pipeline Context & Dataclasses for SERP Intelligence Execution.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

@dataclass
class PipelineContext:
    keyword: str
    search_engine: str = "Google"
    country: str = "us"
    language: str = "en"
    device: str = "desktop"
    request_id: Optional[str] = None
    cache_key: Optional[str] = None
    
    pages: List[Dict[str, Any]] = field(default_factory=list)
    competitor_profiles: List[Dict[str, Any]] = field(default_factory=list)
    semantic_baseline: Dict[str, Any] = field(default_factory=dict)
    topic_coverage: Dict[str, Any] = field(default_factory=dict)
    knowledge_gaps: Dict[str, Any] = field(default_factory=dict)
    information_gain: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[Dict[str, Any]] = field(default_factory=list)
    advanced_stats: Dict[str, Any] = field(default_factory=dict)
    
    overall_score: int = 0
    coverage_score: int = 0
    
    is_cached: bool = False
    processing_time_ms: int = 0

@dataclass
class PipelineResult:
    status: str
    request_id: str
    keyword: str
    payload: Dict[str, Any]

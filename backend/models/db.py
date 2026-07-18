"""
SQLAlchemy ORM models for all PostgreSQL tables.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
# from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ── Keywords ──────────────────────────────────────────────────────────────────
class Keyword(Base):
    __tablename__ = "keywords"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    query = Column(Text, nullable=False, index=True)
    vertical = Column(String(100), nullable=False, index=True)
    funnel_stage = Column(String(10))           # TOFU / MOFU
    buyer_intent_score = Column(String(10))     # High / Medium / Low
    intent_score_rationale = Column(Text)
    novelty_opportunity = Column(String(10))    # High / Medium / Low
    novelty_rationale = Column(Text)
    priority_matrix = Column(String(50))
    buyer_segment = Column(Text)
    recommended_next_action = Column(Text)
    query_cluster = Column(String(100))
    intent_type = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    serp_results = relationship("SerpResult", back_populates="keyword")
    novelty_history = relationship("NoveltyHistory", back_populates="keyword")


# ── SERP Results ──────────────────────────────────────────────────────────────
class SerpResult(Base):
    __tablename__ = "serp_results"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    keyword_id = Column(String(36), ForeignKey("keywords.id"), nullable=False)
    vertical = Column(String(100), nullable=False, index=True)
    position = Column(Integer, nullable=False)
    url = Column(Text, nullable=False)
    title = Column(Text)
    meta_description = Column(Text)
    body_content = Column(Text)
    word_count = Column(Integer)
    domain_rating = Column(Float, default=0.0)  # Estimated, not Ahrefs
    collected_at = Column(DateTime, server_default=func.now())
    content_hash = Column(String(64), index=True)  # SHA-256 for dedup

    # Relationships
    keyword = relationship("Keyword", back_populates="serp_results")
    entity_occurrences = relationship("EntityOccurrence", back_populates="serp_result")

    __table_args__ = (
        UniqueConstraint("keyword_id", "position", name="uq_keyword_position"),
    )


# ── Entities ──────────────────────────────────────────────────────────────────
class Entity(Base):
    __tablename__ = "entities"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    text = Column(Text, nullable=False)
    entity_type = Column(String(50), nullable=False)   # ORG, PRODUCT, CONCEPT, etc.
    vertical = Column(String(100), nullable=False, index=True)
    frequency = Column(Integer, default=0)
    authority_score = Column(Float, default=0.0)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    entity_occurrences = relationship("EntityOccurrence", back_populates="entity")

    __table_args__ = (
        UniqueConstraint("text", "vertical", name="uq_entity_vertical"),
    )


# ── Entity Occurrences ────────────────────────────────────────────────────────
class EntityOccurrence(Base):
    __tablename__ = "entity_occurrences"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    entity_id = Column(String(36), ForeignKey("entities.id"), nullable=False)
    serp_result_id = Column(String(36), ForeignKey("serp_results.id"), nullable=False)
    position_in_doc = Column(Integer)
    context_window = Column(Text)
    confidence = Column(Float, default=1.0)

    # Relationships
    entity = relationship("Entity", back_populates="entity_occurrences")
    serp_result = relationship("SerpResult", back_populates="entity_occurrences")


# ── Generation Jobs ───────────────────────────────────────────────────────────
class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    keyword_id = Column(String(36), ForeignKey("keywords.id"), nullable=True)
    keyword_text = Column(Text, nullable=False)
    vertical = Column(String(100), nullable=False)
    status = Column(String(20), default="queued")  # queued/running/done/failed
    celery_task_id = Column(String(200))
    iterations_used = Column(Integer, default=0)
    final_novelty_score = Column(Float)
    predicted_position = Column(Integer)
    content = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)


# ── Novelty History ───────────────────────────────────────────────────────────
class NoveltyHistory(Base):
    __tablename__ = "novelty_history"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    keyword_id = Column(String(36), ForeignKey("keywords.id"), nullable=True)
    content_hash = Column(String(64), nullable=False, index=True)
    novelty_score = Column(Float, nullable=False)
    similarity_score = Column(Float)
    entity_novelty = Column(Float)
    relationship_novelty = Column(Float)
    semantic_diversity = Column(Float)
    passed = Column(Boolean, default=False)
    vertical = Column(String(100))
    scored_at = Column(DateTime, server_default=func.now())

    keyword = relationship("Keyword", back_populates="novelty_history")


# ── Analysis History ──────────────────────────────────────────────────────────
class AnalysisHistory(Base):
    __tablename__ = "analysis_history"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    keyword = Column(String(255), nullable=False, index=True)
    vertical = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    full_json_report = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


# ── ML Model Versions ─────────────────────────────────────────────────────────
class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    vertical = Column(String(100), nullable=False)
    model_type = Column(String(50), nullable=False)  # gradient_boosting / etc.
    version_tag = Column(String(100), nullable=False)
    file_path = Column(Text, nullable=False)
    training_samples = Column(Integer)
    accuracy_score = Column(Float)
    is_active = Column(Boolean, default=True)
    trained_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("vertical", "version_tag", name="uq_model_version"),
    )

# ── Advanced Caching & History (SERP Intel) ───────────────────────────────────

class SearchHistory(Base):
    __tablename__ = "search_history"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), nullable=True)
    keyword = Column(Text, nullable=False, index=True)
    normalized_keyword = Column(Text, nullable=False, index=True)
    page_name = Column(String(100))
    search_engine = Column(String(100))
    country = Column(String(10))
    language = Column(String(10))
    device = Column(String(20))
    searched_at = Column(DateTime, server_default=func.now())
    last_accessed = Column(DateTime, server_default=func.now())
    access_count = Column(Integer, default=1)
    cache_key = Column(String(255), index=True)
    analysis_id = Column(String(36))
    session_id = Column(String(100))
    analysis_duration_ms = Column(Integer)
    provider_used = Column(String(100))
    cache_status = Column(String(50))
    is_favorite = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    status = Column(String(50), default="COMPLETED")

class AnalysisCache(Base):
    __tablename__ = "analysis_cache"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    cache_key = Column(String(255), unique=True, index=True)
    keyword = Column(Text, nullable=False)
    serp_results_json = Column(Text)
    top_3_json = Column(Text)
    extracted_content_json = Column(Text)
    entity_analysis_json = Column(Text)
    seo_score = Column(Float)
    novelty_score = Column(Float)
    ranking_prediction_json = Column(Text)
    ai_summary = Column(Text)
    recommendations_json = Column(Text)
    website_authority_json = Column(Text)
    content_metadata_json = Column(Text)
    provider_info = Column(String(100))
    status = Column(String(50), default="PENDING") # e.g., SERP_FETCHED, CONTENT_EXTRACTED, AI_COMPLETE, FAILED
    raw_serp_response_json = Column(Text)
    credits_consumed = Column(Integer, default=0)
    response_time_ms = Column(Integer, default=0)
    error_log = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    expiry_time = Column(DateTime)
class ContentStorage(Base):
    __tablename__ = "content_storage"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    url = Column(Text, nullable=False, unique=True, index=True)
    content_hash = Column(String(64), index=True)
    downloaded_html = Column(Text)
    extracted_text = Column(Text)
    word_count = Column(Integer)
    entity_graph_json = Column(Text)
    metadata_json = Column(Text)
    http_status = Column(Integer)
    extraction_time_ms = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now())
    last_modified_header = Column(String(100))
    etag_header = Column(String(100))

class ReportStorage(Base):
    __tablename__ = "report_storage"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    analysis_id = Column(String(36), index=True)
    report_json = Column(Text, nullable=False)
    report_version = Column(String(50))
    schema_version = Column(String(50))
    prompt_version = Column(String(50))
    serp_provider_version = Column(String(50))
    gemini_version = Column(String(50))
    gemini_model = Column(String(50))
    prompt_hash = Column(String(64))
    temperature = Column(Float)
    max_tokens = Column(Integer)
    generation_time_ms = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

class ProviderHealth(Base):
    __tablename__ = "provider_health"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    provider_name = Column(String(100), unique=True, index=True)
    success_rate = Column(Float, default=100.0)
    average_response_time_ms = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    rate_limit_count = Column(Integer, default=0)
    current_health_status = Column(String(50), default="HEALTHY")
    last_successful_request = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now())

class CacheAnalytics(Base):
    __tablename__ = "cache_analytics"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    date_key = Column(String(20), unique=True, index=True)
    cache_hits = Column(Integer, default=0)
    cache_misses = Column(Integer, default=0)
    credits_saved = Column(Integer, default=0)
    gemini_calls_saved = Column(Integer, default=0)
    avg_analysis_time_ms = Column(Integer, default=0)
    avg_serp_response_time_ms = Column(Integer, default=0)
    avg_gemini_response_time_ms = Column(Integer, default=0)

class ApiUsageMetrics(Base):
    __tablename__ = "api_usage_metrics"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    date_key = Column(String(20), unique=True, index=True)
    total_requests = Column(Integer, default=0)
    serp_requests = Column(Integer, default=0)
    gemini_requests = Column(Integer, default=0)
    retries = Column(Integer, default=0)
    rate_limits = Column(Integer, default=0)
    remaining_credits = Column(Integer, default=0)

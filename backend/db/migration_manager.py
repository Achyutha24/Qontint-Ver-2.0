"""
Automatic Database Migration & Schema Validation Manager for Qontint Backend.

Features:
  1. Compares SQLAlchemy ORM models with current SQLite database schema (qontint.db).
  2. Automatically creates backup of qontint.db to qontint.db.bak before migrating.
  3. Removes stale UNIQUE constraints on analysis_cache.cache_key safely to enable versioning.
  4. Applies safe ALTER TABLE ... ADD COLUMN migrations without deleting data.
  5. Maintains schema_version table to track applied schema migrations.
  6. Validates post-migration schema compatibility on application startup.
"""
from __future__ import annotations

import logging
import os
import shutil
import sqlite3
from datetime import datetime
from typing import Dict, List, Tuple

from sqlalchemy import Column, DateTime, Boolean, Integer, Float, String, Text

logger = logging.getLogger("qontint.migration")


def get_sqlite_db_path() -> str:
    """Resolve local SQLite database path."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(backend_dir, "qontint.db")
    return db_path


def map_sqlalchemy_type_to_sqlite(col: Column) -> str:
    """Map SQLAlchemy Column type to SQLite column type string."""
    col_type = col.type
    if isinstance(col_type, (Integer, Boolean)):
        return "INTEGER"
    elif isinstance(col_type, Float):
        return "FLOAT"
    elif isinstance(col_type, DateTime):
        return "DATETIME"
    else:
        return "TEXT"


def backup_database(db_path: str):
    """Create a safety backup of qontint.db before running migrations."""
    if os.path.exists(db_path):
        backup_path = f"{db_path}.bak"
        try:
            shutil.copy2(db_path, backup_path)
            logger.info("📦 Created database backup at: %s", backup_path)
        except Exception as exc:
            logger.warning("⚠️ Database backup failed (non-fatal): %s", exc)


def remove_unique_constraint_on_cache_key(cursor: sqlite3.Cursor):
    """
    Safely removes UNIQUE constraint on analysis_cache.cache_key if present.
    Uses SQLite's recommended table recreation pattern:
      1. Check if table sql has UNIQUE(cache_key) or unique index
      2. Create analysis_cache_temp with identical schema without UNIQUE on cache_key
      3. Copy all data
      4. Drop old table
      5. Rename temp table to analysis_cache
      6. Recreate indexes on (cache_key, analysis_version) & (cache_key, is_latest)
    """
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='analysis_cache'")
    row = cursor.fetchone()
    if not row or not row[0]:
        return

    table_sql = row[0]
    cursor.execute("PRAGMA index_list(analysis_cache)")
    indexes = cursor.fetchall()
    
    has_unique_key = "UNIQUE" in table_sql.upper() and "CACHE_KEY" in table_sql.upper()
    for idx in indexes:
        if idx[2] == 1:  # Unique index
            cursor.execute(f"PRAGMA index_info('{idx[1]}')")
            idx_cols = [c[2] for c in cursor.fetchall()]
            if idx_cols == ['cache_key']:
                has_unique_key = True
                cursor.execute(f"DROP INDEX IF EXISTS {idx[1]}")

    if not has_unique_key:
        logger.info("analysis_cache table has no UNIQUE constraint on cache_key.")
        return

    logger.info("🔄 Migrating analysis_cache table: Removing UNIQUE constraint on cache_key while preserving all existing data...")

    # Fetch existing columns from analysis_cache
    cursor.execute("PRAGMA table_info(analysis_cache)")
    cols_info = cursor.fetchall()
    col_names = [c[1] for c in cols_info]
    cols_str = ", ".join(col_names)

    # 1. Create temporary table with exact schema but WITHOUT UNIQUE on cache_key
    cursor.execute("""
        CREATE TABLE analysis_cache_temp (
            id VARCHAR(36) PRIMARY KEY,
            cache_key VARCHAR(255),
            keyword TEXT NOT NULL,
            analysis_version INTEGER DEFAULT 1,
            analysis_type VARCHAR(50) DEFAULT 'SERP Intelligence',
            is_latest INTEGER DEFAULT 1,
            serp_results_json TEXT,
            top_3_json TEXT,
            extracted_content_json TEXT,
            entity_analysis_json TEXT,
            seo_score FLOAT,
            novelty_score FLOAT,
            ranking_prediction_json TEXT,
            ai_summary TEXT,
            recommendations_json TEXT,
            website_authority_json TEXT,
            content_metadata_json TEXT,
            provider_info VARCHAR(100),
            status VARCHAR(50) DEFAULT 'PENDING',
            raw_serp_response_json TEXT,
            credits_consumed INTEGER DEFAULT 0,
            response_time_ms INTEGER DEFAULT 0,
            error_log TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expiry_time DATETIME,
            semantic_snapshot_json TEXT,
            serp_snapshot_json TEXT,
            entity_snapshot_json TEXT,
            cluster_snapshot_json TEXT,
            recommendation_snapshot_json TEXT
        )
    """)

    # 2. Copy all data
    cursor.execute(f"INSERT INTO analysis_cache_temp ({cols_str}) SELECT {cols_str} FROM analysis_cache")

    # 3. Drop old table
    cursor.execute("DROP TABLE analysis_cache")

    # 4. Rename temp table to original
    cursor.execute("ALTER TABLE analysis_cache_temp RENAME TO analysis_cache")

    # 5. Recreate non-unique indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_analysis_cache_key_ver ON analysis_cache(cache_key, analysis_version)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_analysis_cache_key_latest ON analysis_cache(cache_key, is_latest)")

    logger.info("✅ Successfully removed UNIQUE constraint on analysis_cache.cache_key. All data preserved.")


def run_auto_migrations() -> bool:
    """
    Synchronizes SQLite schema with SQLAlchemy models in db.py.
    Returns True if migration succeeded or database was already up to date.
    """
    db_path = get_sqlite_db_path()
    if not os.path.exists(db_path):
        logger.info("Database file %s does not exist yet — will be created by SQLAlchemy.", db_path)
        return True

    backup_database(db_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. Ensure schema_version tracking table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS schema_version (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version VARCHAR(50) NOT NULL,
                description TEXT,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 2. Remove UNIQUE constraint on analysis_cache.cache_key if present
        remove_unique_constraint_on_cache_key(cursor)

        # 3. Import ORM models dynamically to inspect metadata
        from models.db import Base
        tables = Base.metadata.tables

        migrated_count = 0

        for table_name, table_obj in tables.items():
            # Check if table exists in SQLite
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            table_exists = cursor.fetchone() is not None

            if not table_exists:
                logger.info("Creating missing table '%s'", table_name)
                continue

            # Fetch existing column names for this table
            cursor.execute(f"PRAGMA table_info({table_name})")
            existing_cols = {col[1].lower(): col for col in cursor.fetchall()}

            for col in table_obj.columns:
                col_name = col.name
                if col_name.lower() not in existing_cols:
                    sqlite_type = map_sqlalchemy_type_to_sqlite(col)
                    alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {sqlite_type}"
                    logger.info("Migrating schema: Adding missing column %s.%s (%s)", table_name, col_name, sqlite_type)
                    cursor.execute(alter_sql)
                    migrated_count += 1

        # 4. Ensure critical indexes exist
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_analysis_cache_key_ver ON analysis_cache(cache_key, analysis_version)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_analysis_cache_key_latest ON analysis_cache(cache_key, is_latest)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_report_storage_analysis_id ON report_storage(analysis_id)")

        # 5. Record schema version entry
        version_str = f"v2.2-versioned-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        cursor.execute(
            "INSERT INTO schema_version (version, description) VALUES (?, ?)",
            (version_str, f"Migrated {migrated_count} column(s) and removed UNIQUE constraint on cache_key.")
        )
        conn.commit()
        logger.info("✅ Database migration successful: Schema versioned [Version %s]", version_str)
        return True

    except Exception as exc:
        conn.rollback()
        logger.error("❌ Database schema migration failed: %s", exc, exc_info=True)
        return False
    finally:
        conn.close()


def validate_schema_integrity() -> Tuple[bool, List[str]]:
    """
    Post-migration schema validation. Confirm every column expected by backend models exists.
    Returns (is_valid, missing_columns).
    """
    db_path = get_sqlite_db_path()
    if not os.path.exists(db_path):
        return True, []

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    missing: List[str] = []

    try:
        from models.db import Base
        for table_name, table_obj in Base.metadata.tables.items():
            cursor.execute(f"PRAGMA table_info({table_name})")
            existing_cols = {col[1].lower() for col in cursor.fetchall()}
            for col in table_obj.columns:
                if col.name.lower() not in existing_cols:
                    missing.append(f"{table_name}.{col.name}")
    except Exception as exc:
        logger.error("Schema validation error: %s", exc)
        return False, [str(exc)]
    finally:
        conn.close()

    is_valid = len(missing) == 0
    return is_valid, missing

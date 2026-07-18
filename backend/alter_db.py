import asyncio
import sqlite3

def alter_db():
    conn = sqlite3.connect('qontint.db')
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE analysis_cache ADD COLUMN status VARCHAR(50) DEFAULT 'PENDING'")
        cursor.execute("ALTER TABLE analysis_cache ADD COLUMN raw_serp_response_json TEXT")
        cursor.execute("ALTER TABLE analysis_cache ADD COLUMN credits_consumed INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE analysis_cache ADD COLUMN response_time_ms INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE analysis_cache ADD COLUMN error_log TEXT")
        conn.commit()
        print("Successfully altered table")
    except Exception as e:
        print("Error altering table:", e)
    finally:
        conn.close()

if __name__ == "__main__":
    alter_db()

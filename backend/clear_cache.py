import sqlite3
conn = sqlite3.connect('qontint.db')
conn.execute("DELETE FROM analysis_cache WHERE keyword='E-Commerce Platforms'")
conn.commit()
conn.close()

import requests
import json

payload = {
    "keyword": "B2B Marketing Strategies",
    "vertical": "b2b",
    "max_iterations": 3,
    "novelty_threshold": 0.35
}

try:
    resp = requests.post("http://127.0.0.1:8000/api/v1/generate", json=payload, timeout=120)
    print("STATUS:", resp.status_code)
    print("TEXT:", resp.text)
except Exception as e:
    print("ERROR:", e)

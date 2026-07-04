import requests
import json
import sys
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_analyze():
    print("Testing /analyze...")
    try:
        resp = requests.post(f"{BASE_URL}/analyze", json={
            "keyword": "crm software",
            "content": "CRM software is used by B2B companies to track leads. " * 20,
            "vertical": "B2B SaaS"
        }, timeout=30)
        
        if resp.status_code != 200:
            print(f"FAILED analyze: {resp.status_code} {resp.text}")
            return False
            
        data = resp.json()
        print("Analyze OK, processing_time:", data.get("total_processing_time_ms"))
        return True
    except Exception as e:
        print("Exception in analyze:", e)
        return False

def test_generate():
    print("Testing /generate...")
    try:
        resp = requests.post(f"{BASE_URL}/generate", json={
            "keyword": "fintech apis",
            "vertical": "Fintech",
            "max_iterations": 1,
            "novelty_threshold": 0.5
        }, timeout=30)
        
        if resp.status_code != 200:
            print(f"FAILED generate: {resp.status_code} {resp.text}")
            return False
            
        data = resp.json()
        print("Generate OK, success:", data.get("success"), "iterations:", data.get("iterations_used"))
        return True
    except Exception as e:
        print("Exception in generate:", e)
        return False

def test_graph():
    print("Testing /graph/snapshot/B2B SaaS...")
    try:
        resp = requests.get(f"{BASE_URL}/graph/snapshot/B2B%20SaaS", timeout=10)
        if resp.status_code != 200:
            print(f"FAILED graph: {resp.status_code} {resp.text}")
            return False
        data = resp.json()
        print(f"Graph OK, nodes: {len(data.get('nodes', []))} edges: {len(data.get('edges', []))}")
        return True
    except Exception as e:
        print("Exception in graph:", e)
        return False

if __name__ == "__main__":
    t1 = test_analyze()
    t2 = test_generate()
    t3 = test_graph()
    
    if not (t1 and t2 and t3):
        sys.exit(1)
    print("ALL TESTS PASSED")

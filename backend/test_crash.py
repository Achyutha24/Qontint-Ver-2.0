import subprocess
import time
import requests

# Start the server
proc = subprocess.Popen(
    ["python", "-m", "uvicorn", "main:app", "--port", "8001"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True
)

time.sleep(5)  # wait for startup

payload = {
    "keyword": "B2B Marketing Strategies",
    "vertical": "b2b",
    "max_iterations": 3,
    "novelty_threshold": 0.35
}

try:
    print("Testing generate endpoint on 8001...")
    resp = requests.post("http://127.0.0.1:8001/api/v1/generate", json=payload, timeout=60)
    print("STATUS:", resp.status_code)
except Exception as e:
    print("ERROR from request:", e)

print("Killing server...")
proc.terminate()
proc.wait()

print("SERVER LOGS:")
print(proc.stdout.read())

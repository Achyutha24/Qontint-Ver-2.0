import subprocess
import time
import requests
import sys

# Start the server
proc = subprocess.Popen(
    ["python", "-m", "uvicorn", "main:app", "--port", "8002"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    cwd="c:/Users/achyu/Desktop/Qontint Backup/backend"
)

# Wait for server to start
print("Waiting for server to start...")
for i in range(20):
    try:
        r = requests.get("http://127.0.0.1:8002/health", timeout=1)
        if r.status_code == 200:
            print("Server is up!")
            break
    except:
        pass
    time.sleep(1)
else:
    print("Server failed to start")
    proc.terminate()
    print(proc.stdout.read())
    sys.exit(1)

payload = {
    "keyword": "B2B Marketing Strategies",
    "vertical": "b2b",
    "max_iterations": 3,
    "novelty_threshold": 0.35
}

try:
    print("Testing generate endpoint on 8002...")
    resp = requests.post("http://127.0.0.1:8002/api/v1/generate", json=payload, timeout=120)
    print("STATUS:", resp.status_code)
    print("TEXT:", resp.text)
except Exception as e:
    print("ERROR from request:", e)

print("Killing server...")
proc.terminate()
proc.wait()

print("SERVER LOGS:")
print(proc.stdout.read())

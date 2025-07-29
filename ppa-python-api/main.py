from fastapi import FastAPI
from fastapi.responses import JSONResponse
from prometheus_client import start_http_server, Summary, Counter, Gauge, Histogram, generate_latest
import httpx
import time
import threading
import psutil
import os
import asyncio

app = FastAPI()

# Prometheus metrics
REQUESTS_TOTAL = Counter('ppa_python_requests_total', 'Total number of mixed task requests (Python)')
DURATION_HISTOGRAM = Histogram('ppa_python_mixed_task_duration_ms', 'Duration of mixed tasks in ms',
                                buckets=(100, 300, 500, 1000, 3000, 5000, 10000))
CPU_SECONDS = Gauge('ppa_python_process_cpu_seconds_total', 'CPU seconds used by Python process')
MEMORY_RSS = Gauge('ppa_python_process_memory_rss_bytes', 'RSS memory used by Python process')
HEAP_BYTES = Gauge('ppa_python_process_heap_bytes', 'Python heap memory usage (approx)')

# Start /metrics server in a thread
def start_metrics_server():
    start_http_server(8001)

threading.Thread(target=start_metrics_server, daemon=True).start()

# Background metric updater
def update_metrics():
    process = psutil.Process(os.getpid())
    while True:
        CPU_SECONDS.set(process.cpu_times().user + process.cpu_times().system)
        MEMORY_RSS.set(process.memory_info().rss)
        HEAP_BYTES.set(process.memory_info().heap if hasattr(process.memory_info(), 'heap') else 0)
        time.sleep(5)

threading.Thread(target=update_metrics, daemon=True).start()

# Naive Fibonacci
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

@app.get("/api/mixed-tasks")
async def mixed_tasks():
    REQUESTS_TOTAL.inc()
    start_time = time.time()

    dummy_url = "https://3nqxwoaq54.execute-api.us-east-1.amazonaws.com/default/PP_DummyAPI"

    # 5 async HTTP calls
    async with httpx.AsyncClient() as client:
        http_tasks = [client.get(dummy_url) for _ in range(5)]
        http_responses = await asyncio.gather(*http_tasks, return_exceptions=True)

    # 5 CPU-bound tasks
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=5) as executor:
        cpu_results = list(executor.map(fibonacci, [10]*5))

    duration_ms = (time.time() - start_time) * 1000
    DURATION_HISTOGRAM.observe(duration_ms)

    return JSONResponse({
        "TimeTakenMs": duration_ms,
        "ApiStatusCodes": [r.status_code if isinstance(r, httpx.Response) else 0 for r in http_responses],
        "CpuResults": cpu_results
    })

@app.get("/metrics")
def metrics():
    return JSONResponse(content=generate_latest(), media_type="text/plain")

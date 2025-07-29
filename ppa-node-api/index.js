import express from 'express';
import axios from 'axios';
import { collectDefaultMetrics, Registry, Gauge, Histogram, Counter } from 'prom-client';

const app = express();
const port = 3030;

// Create a registry and register default system metrics
const register = new Registry();
collectDefaultMetrics({ register });

// Custom metrics
const durationHistogram = new Histogram({
  name: 'ppa_mixed_task_duration_ms',
  help: 'Duration of mixed tasks in ms',
  buckets: [100, 300, 500, 1000, 3000, 5000, 10000],
});

const requestCounter = new Counter({
  name: 'ppa_mixed_task_requests_total',
  help: 'Total number of /api/mixed-tasks requests',
});

const cpuGauge = new Gauge({
  name: 'ppa_process_cpu_seconds_total',
  help: 'Total user + system CPU time used by the Node.js process',
});

const memoryRssGauge = new Gauge({
  name: 'ppa_process_memory_rss_bytes',
  help: 'Resident Set Size memory usage (entire allocated memory)',
});

const heapUsedGauge = new Gauge({
  name: 'ppa_process_heap_used_bytes',
  help: 'V8 heap used in bytes',
});

// Register custom metrics
register.registerMetric(durationHistogram);
register.registerMetric(requestCounter);
register.registerMetric(cpuGauge);
register.registerMetric(memoryRssGauge);
register.registerMetric(heapUsedGauge);

// Update memory and CPU usage every 5s
setInterval(() => {
  const usage = process.cpuUsage();
  const memory = process.memoryUsage();

  const userSec = usage.user / 1e6;    // microseconds to seconds
  const systemSec = usage.system / 1e6;
  cpuGauge.set(userSec + systemSec);

  memoryRssGauge.set(memory.rss);
  heapUsedGauge.set(memory.heapUsed);
}, 5000);

// Naive Fibonacci
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Main endpoint
app.get('/api/mixed-tasks', async (req, res) => {
  requestCounter.inc();
  const end = durationHistogram.startTimer();

  const url = 'https://3nqxwoaq54.execute-api.us-east-1.amazonaws.com/default/PP_DummyAPI';

  const httpTasks = Array.from({ length: 5 }, () => axios.get(url));
  const cpuTasks = Array.from({ length: 5 }, () => Promise.resolve(fibonacci(10)));

  try {
    const [httpResults, cpuResults] = await Promise.all([
      Promise.all(httpTasks),
      Promise.all(cpuTasks),
    ]);

    end(); // stop histogram timer

    res.json({
      ApiStatusCodes: httpResults.map((r) => r.status),
      CpuResults: cpuResults,
    });
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(port, () => {
  console.log(`Node.js PPA app running at http://localhost:${port}`);
});

import express from 'express';
import axios from 'axios';
import { collectDefaultMetrics, Registry, Gauge, Histogram, Counter } from 'prom-client';

const app = express();
const port = 3030;

const register = new Registry();
collectDefaultMetrics({ register });

const ppaRequestCounter = new Counter({
  name: 'ppa_node_requests_total',
  help: 'Total number of mixed task requests handled by Node.js app'
});

const ppaDurationHistogram = new Histogram({
  name: 'ppa_node_mixed_task_duration_ms',
  help: 'Time taken for /api/mixed-tasks in Node.js app',
  buckets: [100, 300, 500, 1000, 3000, 5000, 10000],
});

const ppaCpuGauge = new Gauge({
  name: 'ppa_node_process_cpu_seconds_total',
  help: 'CPU time used by Node.js process (user + system)'
});

const ppaMemoryRssGauge = new Gauge({
  name: 'ppa_node_process_memory_rss_bytes',
  help: 'Resident Set Size memory usage in Node.js'
});

const ppaHeapGauge = new Gauge({
  name: 'ppa_node_process_heap_bytes',
  help: 'Heap used by V8 in Node.js'
});

register.registerMetric(ppaRequestCounter);
register.registerMetric(ppaDurationHistogram);
register.registerMetric(ppaCpuGauge);
register.registerMetric(ppaMemoryRssGauge);
register.registerMetric(ppaHeapGauge);

setInterval(() => {
  const usage = process.cpuUsage();
  const mem = process.memoryUsage();

  const cpuTotalSec = (usage.user + usage.system) / 1e6;
  ppaCpuGauge.set(cpuTotalSec);
  ppaMemoryRssGauge.set(mem.rss);
  ppaHeapGauge.set(mem.heapUsed);
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

using Prometheus;
using System.Diagnostics;
using System.Net.Http;
using System.Numerics;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

HttpClient httpClient = new();

// 🔹 Metrics
var durationHistogram = Metrics.CreateHistogram("ppa_mixed_task_duration_ms", "Duration of mixed tasks in ms");
var requestCounter = Metrics.CreateCounter("ppa_mixed_task_requests_total", "Total mixed task requests");

var cpuTimeGauge = Metrics.CreateGauge("ppa_process_cpu_seconds_total", "Total CPU time used by the process (user + system)");
var memoryWorkingSetGauge = Metrics.CreateGauge("ppa_process_memory_working_set_bytes", "Working set (private memory used)");
var memoryHeapGauge = Metrics.CreateGauge("ppa_gc_heap_bytes", "Managed heap size (GC.GetTotalMemory)");

// 🔹 Background task to update memory/CPU usage every 5 seconds
var process = Process.GetCurrentProcess();
var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
_ = Task.Run(async () =>
{
    while (await timer.WaitForNextTickAsync())
    {
        process.Refresh();
        cpuTimeGauge.Set(process.TotalProcessorTime.TotalSeconds);
        memoryWorkingSetGauge.Set(process.WorkingSet64);
        memoryHeapGauge.Set(GC.GetTotalMemory(forceFullCollection: false));
    }
});

// 🔹 Expose /metrics
app.UseMetricServer();     // Prometheus endpoint
app.UseHttpMetrics();      // Auto track request durations

// 🔹 Main API
app.MapGet("/api/mixed-tasks", async () =>
{
    requestCounter.Inc();
    var timer = durationHistogram.NewTimer();

    try
    {
        // Async calls
        var apiCalls = Enumerable.Repeat("https://3nqxwoaq54.execute-api.us-east-1.amazonaws.com/default/PP_DummyAPI", 5)
            .Select(url => httpClient.GetAsync(url))
            .ToList();

        // CPU-bound tasks
        var cpuTasks = Enumerable.Range(0, 5)
            .Select(_ => Task.Run(() => Fibonacci(42)))
            .ToList();

        await Task.WhenAll(apiCalls.Concat<Task>(cpuTasks));

        return Results.Ok(new
        {
            ApiStatusCodes = apiCalls.Select(r => (int)r.Result.StatusCode),
            CpuResults = cpuTasks.Select(t => t.Result)
        });
    }
    finally
    {
        timer.Dispose();
    }
});

app.Run();

static BigInteger Fibonacci(int n)
{
    if (n <= 1) return n;
    return Fibonacci(n - 1) + Fibonacci(n - 2);
}

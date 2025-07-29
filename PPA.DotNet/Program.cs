using Prometheus;
using System.Diagnostics;
using System.Net.Http;
using System.Numerics;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

HttpClient httpClient = new();

// Custom Prometheus metrics for PPA
var ppaRequestCounter = Metrics.CreateCounter("ppa_dotnet_requests_total", "Total number of mixed task requests handled by .NET app");
var ppaDurationHistogram = Metrics.CreateHistogram("ppa_dotnet_mixed_task_duration_ms", "Time taken for /api/mixed-tasks in .NET app");
var ppaCpuTimeGauge = Metrics.CreateGauge("ppa_dotnet_process_cpu_seconds_total", "Total CPU time used by the .NET process (user + system)");
var ppaMemoryRssGauge = Metrics.CreateGauge("ppa_dotnet_process_memory_rss_bytes", "Resident memory usage (RSS) by .NET process");
var ppaHeapGauge = Metrics.CreateGauge("ppa_dotnet_process_heap_bytes", "Managed heap size in .NET");

var process = Process.GetCurrentProcess();
var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
_ = Task.Run(async () =>
{
    while (await timer.WaitForNextTickAsync())
    {
        process.Refresh();
        ppaCpuTimeGauge.Set(process.TotalProcessorTime.TotalSeconds);
        ppaMemoryRssGauge.Set(process.WorkingSet64);
        ppaHeapGauge.Set(GC.GetTotalMemory(false));
    }
});

app.UseMetricServer();
app.UseHttpMetrics();

// 🔹 Main API
app.MapGet("/api/mixed-tasks", async () =>
{
    ppaRequestCounter.Inc();
    var timer = ppaDurationHistogram.NewTimer();

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

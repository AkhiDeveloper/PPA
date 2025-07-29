package main

import (
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"

	"runtime"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	requestsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "ppa_go_requests_total",
		Help: "Total number of /api/mixed-tasks requests",
	})

	durationHistogram = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "ppa_go_mixed_task_duration_ms",
		Help:    "Duration of mixed tasks in milliseconds",
		Buckets: prometheus.ExponentialBuckets(100, 2, 10),
	})

	cpuGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "ppa_go_process_cpu_seconds_total",
		Help: "Total CPU time used by the Go process",
	})

	rssGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "ppa_go_process_memory_rss_bytes",
		Help: "Resident memory usage of Go process",
	})

	heapGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "ppa_go_process_heap_bytes",
		Help: "Heap memory usage of Go process",
	})
)

func init() {
	prometheus.MustRegister(requestsTotal, durationHistogram, cpuGauge, rssGauge, heapGauge)
}

func main() {
	// Background metrics collection every 5s
	go func() {
		for {
			var m runtime.MemStats
			runtime.ReadMemStats(&m)

			heapGauge.Set(float64(m.HeapAlloc))
			rssGauge.Set(float64(m.Sys))

			// NOTE: Go does not easily expose process CPU time portably
			// Optional: Use gopsutil or a native wrapper if precise CPU time is required
			cpuGauge.Set(float64(time.Since(startTime).Seconds())) // Simplified as uptime

			time.Sleep(5 * time.Second)
		}
	}()

	http.HandleFunc("/api/mixed-tasks", mixedTasksHandler)
	http.Handle("/metrics", promhttp.Handler())

	fmt.Println("PPA Go app listening on :8080")
	http.ListenAndServe(":8080", nil)
}

var startTime = time.Now()

func mixedTasksHandler(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	requestsTotal.Inc()

	// Dummy API URL
	apiURL := "https://3nqxwoaq54.execute-api.us-east-1.amazonaws.com/default/PP_DummyAPI"

	// HTTP calls
	var httpStatusCodes []int
	var wg sync.WaitGroup
	wg.Add(5)
	for i := 0; i < 5; i++ {
		go func() {
			defer wg.Done()
			resp, err := http.Get(apiURL)
			if err == nil {
				httpStatusCodes = append(httpStatusCodes, resp.StatusCode)
				resp.Body.Close()
			}
		}()
	}

	// CPU-bound tasks
	cpuResults := make([]*big.Int, 5)
	var cpuWg sync.WaitGroup
	cpuWg.Add(5)
	for i := 0; i < 5; i++ {
		go func(i int) {
			defer cpuWg.Done()
			cpuResults[i] = fibonacciBig(10)
		}(i)
	}

	wg.Wait()
	cpuWg.Wait()

	duration := time.Since(start).Milliseconds()
	durationHistogram.Observe(float64(duration))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"ApiStatusCodes": httpStatusCodes,
		"CpuResults":     cpuResults,
	})
}

func fibonacciBig(n int) *big.Int {
	if n <= 1 {
		return big.NewInt(int64(n))
	}
	return new(big.Int).Add(fibonacciBig(n-1), fibonacciBig(n-2))
}

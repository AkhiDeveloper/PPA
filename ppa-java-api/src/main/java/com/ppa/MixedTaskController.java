package com.ppa;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.Counter;
import jakarta.annotation.PostConstruct;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigInteger;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

@RestController
public class MixedTaskController {

    private final MeterRegistry registry;
    private final Timer taskTimer;
    private final Counter requestCounter;
    private final ScheduledExecutorService metricsUpdater = Executors.newSingleThreadScheduledExecutor();

    public MixedTaskController(MeterRegistry registry) {
        this.registry = registry;
        this.taskTimer = registry.timer("ppa_java_mixed_task_duration_ms");
        this.requestCounter = registry.counter("ppa_java_requests_total");
    }

    @PostConstruct
    public void startMetricsCollection() {
        metricsUpdater.scheduleAtFixedRate(() -> {
            long heapUsed = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
            long rss = Runtime.getRuntime().totalMemory();
            registry.gauge("ppa_java_process_heap_bytes", heapUsed);
            registry.gauge("ppa_java_process_memory_rss_bytes", rss);
            // Java doesn't expose total CPU time directly — placeholder here
        }, 0, 5, TimeUnit.SECONDS);
    }

    @GetMapping("/api/mixed-tasks")
    public Object handleMixedTasks() throws Exception {
        requestCounter.increment();

        return taskTimer.record(() -> {
            try {
                HttpClient client = HttpClient.newHttpClient();
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create("https://3nqxwoaq54.execute-api.us-east-1.amazonaws.com/default/PP_DummyAPI"))
                        .timeout(Duration.ofSeconds(5))
                        .build();

                ExecutorService executor = Executors.newFixedThreadPool(10);

                List<Future<Integer>> httpFutures = new ArrayList<>();
                for (int i = 0; i < 5; i++) {
                    httpFutures.add(executor.submit(() -> {
                        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                        return response.statusCode();
                    }));
                }

                List<Future<BigInteger>> cpuFutures = new ArrayList<>();
                for (int i = 0; i < 5; i++) {
                    cpuFutures.add(executor.submit(() -> fibonacci(10)));
                }

                List<Integer> statusCodes = new ArrayList<>();
                for (Future<Integer> f : httpFutures) {
                    statusCodes.add(f.get());
                }

                List<BigInteger> cpuResults = new ArrayList<>();
                for (Future<BigInteger> f : cpuFutures) {
                    cpuResults.add(f.get());
                }

                executor.shutdown();

                return new Object() {
                    public final List<Integer> ApiStatusCodes = statusCodes;
                    public final List<BigInteger> CpuResults = cpuResults;
                };
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    private static BigInteger fibonacci(int n) {
         if (n <= 1) {
        return BigInteger.valueOf(n);
    }
    return fibonacci(n - 1).add(fibonacci(n - 2));
    }
}
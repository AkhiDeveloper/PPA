# PPA Java API

This is a Spring Boot-based Java API for the Performance and Prometheus Analytics (PPA) project. It exposes endpoints that can be monitored by Prometheus and visualized in Grafana.

## Features

- RESTful API endpoints
- Prometheus metrics using Micrometer
- CPU-intensive and memory-intensive operations for performance testing
- Docker containerization

## Endpoints

- `/api/mixed-tasks` - Performs a mix of CPU and memory operations
- `/actuator/prometheus` - Exposes Prometheus metrics

## Building and Running

### Local Development

Prerequisites:
- Java 17 or higher
- Maven 3.6 or higher

```bash
# Build the project
mvn clean package

# Run the application
java -jar target/ppa-java-api-1.0-SNAPSHOT.jar
```

### Docker

```bash
# Build the Docker image
docker build -t ppa-java-api .

# Run the container
docker run -p 8090:8090 ppa-java-api
```

### Using Docker Compose

```bash
# From the root of the PPA project
docker-compose up -d
```

## Metrics

This API exposes the following metrics:
- `ppa_java_requests_total` - Counter for the number of API requests
- `ppa_java_mixed_task_duration_ms` - Timer for the duration of mixed tasks
- JVM metrics (memory, GC, threads, etc.) automatically exposed by Micrometer

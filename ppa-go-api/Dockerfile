# Stage 1: Build the Go binary
FROM golang:1.22 AS builder

WORKDIR /app

# Copy go.mod and go.sum first for caching
COPY go.mod ./
COPY go.sum ./
RUN go mod download

# Copy source code and build
COPY . ./
RUN CGO_ENABLED=0 go build -o ppa-go main.go

# Stage 2: Run the Go binary in a slim container
FROM debian:bullseye-slim

WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/ppa-go .

# Expose port
EXPOSE 8080

# Run app
CMD ["./ppa-go"]

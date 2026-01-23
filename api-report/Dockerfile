# Robust Dockerfile for api-report with YottaDB CGo support and embedded dashboard

# ---------- Stage 1: Build the dashboard (Node) ----------
FROM node:20-alpine AS dashboard-builder
WORKDIR /app/dashboard
COPY dashboard/package.json ./
RUN npm install
COPY dashboard/ ./
RUN npm run build

# ---------- Stage 2: Final Build and Runtime (YottaDB/Ubuntu based) ----------
FROM yottadb/yottadb-base:latest-master
USER root

# Install Go and build tools (Ubuntu based)
RUN apt-get update && apt-get install -y wget build-essential pkg-config && \
    wget https://go.dev/dl/go1.24.0.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.24.0.linux-amd64.tar.gz && \
    rm go1.24.0.linux-amd64.tar.gz

ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/go"
ENV CGO_ENABLED=1

# YottaDB environment for CGo
ENV ydb_dist=/opt/yottadb/current
ENV CGO_CFLAGS="-I/opt/yottadb/current"
ENV CGO_LDFLAGS="-L/opt/yottadb/current -lyottadb"

WORKDIR /app

# Copy dashboard assets from Stage 1 (needed for //go:embed in main.go)
COPY --from=dashboard-builder /app/dashboard/dist ./dashboard/dist

# Build Go API
COPY go.mod go.sum ./
RUN go mod download || true
COPY . .
RUN go mod tidy
RUN go build -v -o api-report .

# Final runtime setup
ENV LD_LIBRARY_PATH=/opt/yottadb/current
ENV PORT=8080

EXPOSE 8080

CMD ["./api-report"]

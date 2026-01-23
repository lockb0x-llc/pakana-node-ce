# Standardized Dockerfile for api-go with YottaDB CGo support
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

# Build Go API
COPY go.mod go.sum ./
RUN go mod download || true
COPY . .
RUN go mod tidy
RUN go build -v -o api-go .

# Ensure YottaDB environment for runtime
ENV LD_LIBRARY_PATH=/opt/yottadb/current

# Initialize YottaDB data directory
RUN mkdir -p /data/routines

CMD ["./api-go"]

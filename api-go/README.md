# API-Go Service (Ingestor)

Go-based service for ingesting Stellar network data into the Pakana private ledger.

## Purpose

Connects to Stellar Horizon and writes ledger headers and transaction metadata to YottaDB globals.

## Current State

- **Language**: Go 1.24.0
- **Stellar Ingestion**: **Active**. Streams ledgers from Stellar Testnet/Mainnet and writes headers and transaction envelopes to `^Stellar`.
- **YottaDB Connectivity**: **Optimized**. Uses `ipc: host` and shared `/tmp` for conflict-free writes. Verified on YottaDB r2.03 using the modern Go v2.x API.
- **Build**: Fully containerized using a multi-stage Go build process.

## YottaDB Integration (Go v2.x)

The service interacts with YottaDB using the modern Object-Oriented `Node` API:
- **Environment**:
  - `ydb_dist`: `/opt/yottadb/current`
  - `ydb_gbldir`: `/data/r2.03_x86_64/g/yottadb.gld`
  - `ydb_nodename`: `pakana-node` (Must match host)
  - `ydb_tmp`: `/data/tmp`
- **Initialisation**: Automatic on first call. No explicit `yottadb.Init()` required in the v2.x driver.
- **Concurrency**: Shares the host IPC with other containers via `ipc: host`.

## Usage

### In Docker (Production-ready)
```bash
docker compose up -d api-go
```

### Local Development
Requires YottaDB installed locally with the Go wrapper.
```bash
export ydb_gbldir=/path/to/your.gld
go run main.go
```

## Test Results

Latest execution log:
```
2026/01/18 13:43:48 Starting Stellar Ledger Ingestion Stream...
2026/01/18 13:43:53 Ingested Stellar Ledger: 549773 (Closed at: 2026-01-18 13:43:51 +0000 UTC)
2026/01/18 13:43:58 Ingested Stellar Ledger: 549774 (Closed at: 2026-01-18 13:43:56 +0000 UTC)
```

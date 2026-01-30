# API-Go Service: The Network Sentinel

## Executive Summary
The **api-go** service acts as the **"Network Sentinel"** for the Pakana Node. It is the high-performance ingress gateway that connects the sovereign private ledger to the public Stellar network.

Its primary mission is **Ingestion and Persistence**. It streams live data from the global financial network, filters it for relevance to your organization, and writes it to the local **YottaDB** state store with ACID compliance. By writing directly to shared memory via CGo, it ensures that data is available to the Rust validator and the Dashboard in microseconds.

## Purpose
Connects to Stellar Horizon and acts as the **Primary Writer** for the YottaDB state, handling:
1.  **Ledger Ingestion**: Continuous streaming of blocks (ledgers) from Stellar Mainnet/Testnet.
2.  **Historical Rehydration**: On-demand fetching of legacy account data for "Sparse History" support.
3.  **Atomic Persistence**: Using YottaDB's `TpE()` (Transaction Processing) to ensure no data is ever partially written.

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

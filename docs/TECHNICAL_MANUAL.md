# Pakana Node CE: Technical Manual & Operator's Guide

## 1. System Overview

The **Pakana Node Community Edition** is a specialized, sovereign appliance designed to bridge the gap between high-performance local data processing and public blockchain finality. It operates as a "Testnet Sentinel," ingesting streaming data from the Stellar Network, validating it against local logic, and projecting it into a hierarchical NoSQL store (YottaDB) for millisecond-latency access.

### The "Steel Thread" Architecture
The core data flow, known as the "Steel Thread," ensures end-to-end integrity from network ingestion to user reporting:

1.  **Ingest (`api-go`)**: Connects to the Stellar Horizon API. Streams ledger headers and transactions in real-time. Filters for relevant data and writes raw XDR to `^Stellar` globals in YottaDB using high-speed CGo bindings.
2.  **Storage (YottaDB)**: A hierarchical, schema-less key-value store optimized for in-memory speeds. Data is chemically persisted to a shared volume (`/data`).
3.  **Process (`core-rust`)**: A strongly-typed Rust service that monitors the `^Stellar` global. It decodes XDR envelopes, verifies signatures/integrity, and atomically updates derived state (like `^Account` balances) in the database.
4.  **Report (`api-report`)**: A read-only API layer that serves data to users via REST endpoints and a React-based dashboard. It uses YottaDB's Octo engine to query data via SQL where necessary.

## 2. Component Deep Dive

### A. api-go (The Ingestor)
-   **Role**: Network Sentinel.
-   **Language**: Go 1.24+.
-   **Key Library**: `stellar-sdk` (Go), `yottadb` (Go Wrapper).
-   **Behavior**:
    -   On startup, checks `^Stellar("latest")` to determine the last ingested ledger.
    -   Resumes streaming from that cursor to ensure no data gaps.
    -   Writes are "fire-and-forget" to the database to maximize ingestion throughput.

### B. core-rust (The Validator)
-   **Role**: State Transition Engine.
-   **Language**: Rust 1.75+.
-   **Key Crate**: `stellar-xdr` (Version 24.0.0).
-   **Behavior**:
    -   Runs an async monitoring loop on the `^Stellar` global.
    -   Decodes base64 XDR into strongly, statically typed Rust structs.
    -   Performs business logic validation (e.g., "Is this payment valid for this account?").
    -   Updates `^Account` globals.

### C. YottaDB / Octo (The State Store)
-   **Role**: Persistence & SQL Projection.
-   **Configuration**:
    -   **Shared Memory**: `ipc: host` mode in Docker allows all containers to access the *exact same* memory segments.
    -   **Locking**: Shared `ydb_tmp=/data/tmp` ensures process locks are respected across container boundaries.
    -   **SQL Mapping**: `init.sql` defines how the hierarchical globals (`^Account`) map to relational tables (`accounts`).

## 3. Security Model

### Network & Ports
-   **Public Face**: Only ports `80` (HTTP) and `443` (HTTPS) are exposed to the internet via the Caddy reverse proxy.
-   **Internal Only**: YottaDB ports (`9080`) are bound explicitly to `127.0.0.1`. They are **never** reachable from the outside world.
-   **Access**: SSH (Port 22) is restricted via Azure NSG to authorized keys only.

### Authentication
-   **API Access**: Protected by `X-API-Key` header.
-   **Database Access**: Requires local shell access (via SSH) to runs commands like `octo` or `mumps`.

## 4. Operational Guide

### VM Tuning (`vm_tuning.sh`)
The appliance requires kernel parameter adjustments to support YottaDB's large shared memory segments.
-   **Semaphores**: `kernel.sem="250 32000 100 128"` is applied to allow for sufficient IPC identifiers.
-   **Mount Options**: The `/data` volume is mounted with `noatime` to reduce write wear and latency on the SSD.

### Troubleshooting
-   **"HOSTCONFLICT" Error**: This usually means containers disagree on the Node Name or Lock Path.
    -   *Fix*: Ensure all services in `docker-compose.yml` share `ipc: host`, `hostname: pakana-node`, and `ydb_tmp=/data/tmp`.
-   **Ingestion Lag**: If the node falls behind the network.
    -   *Fix*: Check CPU usage on `api-go`. Upgrading to `Standard_F4s_v2` may be required for full network ingestion.

# API-Report Service: The Executive Dashboard

## Executive Summary
The **api-report** service acts as the **"Control Tower"** for the Pakana Node. It delivers a read-only, real-time visualization of the node's sovereign state through a **Premium Cyberpunk Dashboard**.

Designed for both technical operators and executive decision-makers, the dashboard combines **Glassmorphism** aesthetics with deep observability. It provides an immediate, high-contrast view of ledger health, transaction throughput, and asset distribution, all powered by a secure REST API.

## Purpose
Acts as the **Read-Only Projection** of the system, serving:
1.  **The Dashboard**: A React/Vite/Tailwind SPA embedded in the binary.
2.  **The API**: A secure REST interface for external systems to query the private ledger.
3.  **Observability**: Real-time component health checks for the Go and Rust kernels.

## Features

- **Language**: Go 1.24.0
- **Embedded Dashboard**: The frontend is built with React/Vite and embedded directly into the Go binary.
- **YottaDB Go v2.x**: High-performance read access using modern Go v2.x Object-Oriented `Node` API.
- **Authenticated Endpoints**: Secure access to ledger and account data via `X-API-Key`.
- **Health Monitoring**: Real-time status of `core-rust` and `api-go` ingestion.

## API Endpoints

All endpoints require the `X-API-Key` header (except `/health`).

- `GET /health`: Service health check.
- `GET /api/v1/ledgers/latest`: Returns the most recent ingested ledger.
- `GET /api/v1/accounts/{id}`: Returns account balance and sequence number.
- `GET /api/v1/accounts/{id}/trustlines`: Returns trustline balances for an account.

### Interactive API Documentation

Interactive Swagger-based documentation is available directly on the node:

- **Swagger UI (Internal)**: `http://localhost:8080/docs`
- **Swagger UI (Public)**: `https://build.lockb0x.dev/docs`
- **OpenAPI Spec**: `http://localhost:8080/openapi.yaml`

## Dashboard Architecture

The embedded dashboard is a modern, single-page application (SPA) designed for "Glassmorphism" aesthetics and privacy compliance.

### Tech Stack
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS (with custom glass/neon utilities)
- **State Management**: React Hooks (Controller Pattern in `App.tsx`)
- **Icons**: Lucide React

### Key Components
- **LedgerTable**: Real-time stream of Stellar ledgers.
- **StateExplorer**: Search interface for Accounts and Transactions (delegates to YottaDB).
- **MetricCards**: Visualizations for transaction volume and node health.

### Privacy & Analytics
- **Microsoft Clarity**: Integrated for heatmaps/session recording.
- **GDPR Compliance**: The `CookieBanner` component ensures Clarity is **never** initialized without explicit user consent (stored in `localStorage`).

## Build and Deployment

### Docker (Production)
The service uses a multi-stage Docker build:
1. **Frontend Stage**: Builds the React dashboard in `dashboard/`.
2. **Backend Stage**: Embeds the built assets and compiles the Go binary.
3. **Runtime Stage**: A lean Ubuntu-based image (yottadb-base) for execution.

```bash
docker compose up -d api-report
```

## Security

- **API Key**: Configuration via `PAKANA_API_KEY` (default: `changeme`).
- **Caddy Integration**: Protected by SSL when deployed via the root `docker-compose.yml` with Caddy.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `API_KEY` | `changeme` | Required API key for authenticated endpoints |
| `HORIZON_URL` | `https://horizon-testnet.stellar.org` | Stellar Horizon API endpoint |
| `ydb_gbldir` | `/data/r2.03_x86_64/g/yottadb.gld` | YottaDB global directory |

## Architecture: Read-Only Service

> **CRITICAL**: This service is **strictly read-only**. All database writes are handled by kernel services (`api-go` or `core-rust`).

See [AGENT_API_REPORT.md](./AGENT_API_REPORT.md) for enforcement guidelines.

## Sparse Blockchain History

The service implements an on-demand data retrieval pattern with **delegation to api-go for persistence**:

### Data Flow

```
1. Client Request → api-report
2. api-report checks YottaDB
   ├─ Hit: Return cached data
   └─ Miss: Delegate to api-go
3. api-go fetches from Horizon + persists to YottaDB (with ACID TpE)
4. api-report retries YottaDB lookup
5. Return data to client
```

### Key Points

- **api-report NEVER writes** to YottaDB directly
- Missing data triggers internal call to `api-go` endpoints:
  - `POST /internal/cache-account`
  - `POST /internal/cache-account-transactions`
- **api-go** handles all Horizon fetching and YottaDB persistence
- Ensures data integrity through atomic transactions

This conserves resources by caching only requested accounts/transactions instead of the entire 10+ year Stellar ledger history.


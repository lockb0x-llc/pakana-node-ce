# Pakana Private Ledger - Development Log

## Project Overview
Pakana is a private ledger system built on YottaDB with Stellar protocol integration. The architecture consists of:
- **YottaDB/Octo**: Core database with shared /data volume
- **api-go**: Go ingestor service using Stellar SDK to write ledger headers to ^Ledger global
- **core-rust**: Rust core service using Stellar-XDR to read ^Ledger and update ^Account balances

## Steel Thread Proof of Concept
**Objective**: Demonstrate end-to-end data flow from Go to YottaDB to Rust
- Go service writes timestamp to ^Ledger global
- Rust service reads the timestamp and verifies/logs it

## Development Timeline

### 2026-01-27 - Repository Cleanup & Normalization
- **Legacy Cruft Removal**: Deleted `DEPLOYMENT.md`, `setup.sh`, `db-init.sh`, `verify-remediation.sh`, `deploy.sh`.
- **Logic Consolidation**: `deploy_pakana.sh` is now the unified entrypoint for Azure deployment and VM bootstrapping (including YottaDB initialization).
- **Hardware Alignment**: Confirmed `deploy/main.bicep` uses `Standard_F2s_v2` Compute Optimized SKU and `PremiumV2_LRS` storage.
- **Documentation**: Updated README to reflect "Appliance-First" single-command deployment.

- **Interactive Documentation**: Integrated OpenAPI 3.0 and Swagger UI at `/docs` for developer onboarding.
- **Azure Integration Plan**: Formulated a comprehensive plan to integrate Azure Bicep deployment (F2s_v2) into the CE repository, ensuring a one-command "Appliance" experience.
- **MCP Configuration**: Initialized configuration for Azure, Docker, PostgreSQL (Octo), and GitHub MCP servers to enhance agent autonomy.

### 2026-01-23 - Status Report & "Persistence Save"
- **Steel Thread**: Verified stable.
- **Infrastructure**: Azure VM tuned and ready.
- **Current Objective**: Implement `deploy/main.bicep` and `deploy_pakana.sh` as per the walkthrough.
- **Next Step**: Configure MCP servers and proceed with Bicep template creation.

### 2026-01-21 - Phase 6 Release: TOKE & SSL
- **Token Issuance**: TOKE utility token minted and distributed from `GCWGJWZVNLBSDXCRMWZMWZI2K6GQJABYPTNBLLYOZP4GNTQCKIHYYIEE`.
- **Security Upgrade**: SSL/TLS certificates provisioned via Let's Encrypt for the `api-report` container.
- **Reporting Dashboard**: Dashboard verified as operational over HTTPS.

### 2026-01-21 - Security & Operations Review (Phase 5 Refinement)

- **Security Audit**: Identified exposed YottaDB ports and default secrets.
- **Remediation**:
  - Bound YottaDB ports (9080, 1337) to `127.0.0.1` in `docker-compose.yml`.
  - Added "Security & Operations" section to `README.md`.
  - Created `docs/SECURITY_OPS_REVIEW.md` for formal audit trail.
- **Documentation Fixes**:
  - Updated `README.md` to reference YottaDB `r2.03` (matching container).
  - Clarified SSH Tunnel requirement for DBeaver access.

### 2026-01-18 - Initial Scaffold
- Created project structure with docker-compose.yml
- Set up api-go directory with Go service
- Set up core-rust directory with Rust service
- Created setup.sh for local development (Ubuntu/WSL2)
- Implemented Steel Thread PoC

### 2026-01-17 - Architectural Review Adjustments
- Implemented `ipc: host` in Docker Compose for shared memory performance.
- Created `init.sql` with `accounts` table DDL.
- Created `vm_tuning.sh` and executed it on Azure VM (`kernel.sem` updated, `/data` remounted with `noatime`).
- Identified missing Docker installation on VM.
- Created `install_docker.sh` and successfully installed Docker and Docker Compose.

## Architecture Notes

### YottaDB Globals
- `^Ledger`: Stores Stellar ledger headers (written by api-go)
- `^Account`: Stores account balances (updated by core-rust)

### Data Flow
1. api-go connects to Stellar network
2. Ingests ledger headers via Stellar SDK
3. Writes to ^Ledger global in YottaDB
4. core-rust reads from ^Ledger
5. Processes transactions using Stellar-XDR
6. Updates ^Account balances

## Build and Run Instructions

### Using Docker Compose (Recommended)
```bash
docker-compose up --build
```

### Local Development Setup
```bash
# Run on Ubuntu/WSL2
./setup.sh

# Start services individually
cd api-go && go run main.go
cd core-rust && cargo run
```

## Dependencies
- YottaDB (latest-master)
- Go 1.21+
- Rust 1.75+
- Stellar SDK (Go)
- Stellar-XDR (Rust)
- YottaDB Go bindings (lang.yottadb.com/go/yottadb)
- yottadb Rust crate

## Issues and Resolutions
(To be documented as development progresses)

## Next Steps
- Implement full Stellar ledger ingestion
- Add transaction processing logic
- Implement account balance calculations
- Add monitoring and logging
- Performance optimization

# Project Pakana: The Sovereign Node Appliance

### "A Virtual Appliance for 21st Century Commerce"

## 1. Executive Summary

Project Pakana is a decentralized infrastructure initiative designed to bridge the gap between **Real World Assets (RWA)**, **DeFi**, and **Legal Compliance**. The "Pakana Node" is a sovereign, containerized virtual appliance that allows organizations to act as their own bank, notary, and record keeper.

By combining the speed of **YottaDB** (Hierarchical NoSQL), the safety of **Rust**, and the ubiquity of the **Stellar Network**, the Pakana Node creates a **"Meta-Network"**—a private, high-performance logical layer on top of the public blockchain that enforces **UCC Article 12** compliance for digital assets.

## 2. Core Value Proposition

* **Sovereignty:** You own your data. The node runs on your infrastructure (Azure VM), not a black-box SaaS.
* **Compliance:** Built-in implementation of the **Lockb0x Protocol** (IETF Draft) ensures every transaction creates a legally defensible "Controllable Electronic Record" (CER).
* **Performance:** Leveraging YottaDB's in-memory speeds allows for real-time validation of complex construction and development workflows that would choke a standard SQL database.

## 3. The "Meta-Network" Architecture

The Pakana Node does not fork the Stellar Network. Instead, it acts as a **Sovereign Indexer** and **Validation Anchor**.

1. **Public Layer (Stellar):** Handles value transfer (TOKE, USDC) and immutable timestamping (Anchoring).
2. **Private Layer (Pakana Node):** Handles rich state, document storage (PDF Waivers), business logic validation, and relation mapping.

### System Diagram

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Stellar       │────▶│   api-go     │────▶│   YottaDB       │
│   Network       │     │  (Ingestor)  │     │  ^Ledger        │
│    (Horizon)    │     └──────────────┘     │  ^Account       │
└─────────────────┘             │            └────────┬────────┘
                                │                     │
                                │            ┌────────▼────────┐
                                └───────────▶│  core-rust      │
                                             │ (Processor)     │
                                             └────────┬────────┘
                                                      │
                                             ┌────────▼────────┐
                                             │  api-report     │
                                             │ (REST & UI)     │
                                             └─────────────────┘
```


### Components

- **YottaDB**: Core database with persistent storage.
  - USES `yottadb/yottadb-base:latest-master` image.
  - Implements **Init Container** pattern for volume seeding (Version `r2.03_x86_64`).
- **api-go**: Go ingestor service (**Kernel - Writes to DB**)
  - Connects to Stellar network using Stellar SDK.
  - Writes to YottaDB globals via CGo bindings (YottaDB Go v2.x).
  - Provides internal endpoints for on-demand historical data caching.
- **core-rust**: Rust core processor (**Kernel - Writes to DB**)
  - High-performance transaction processing and verification.
  - Updates account state and balances in ^Account.
- **api-report**: Reporting & UI service (**Read-Only**)
  - Provides a RESTful API for ledger and account data.
  - Serves an embedded **React Dashboard** (Vite/Tailwind).
  - **Never writes to YottaDB** - delegates to api-go for historical data caching.

## Deployment & Infrastructure

### Azure VM Environment
- **OS**: Ubuntu 24.04 LTS
- **Hardware**: Azure VM with Premium SSD v2.
- **Tuning**: 
  - Kernel semaphores optimized: `kernel.sem=250 32000 100 128`.
  - Storage mounted with `noatime` for maximum performance.

### Docker Configuration
- **Host Identity**: All services use `hostname: pakana-node` and `ydb_nodename=pakana-node` to prevent YottaDB `HOSTCONFLICT` errors.
- **Persistence**: Managed via `yottadb-data` volume, mounted at `/data` across all services.
- **Shared State**:
  - `ipc: host`: Shares the host's IPC namespace.
  - `ydb_tmp=/data/tmp`: Shared temporary directory for lock files, ensuring all containers see the same database locks.
- **Seeding**: The `db-init` container automatically seeds the database files and creates `/data/tmp` on first run.

## Development Status (Phase 7 - Community Edition Release Candidate) 🚀

- [x] **YottaDB/Octo Deployment**: Functional with persistent storage on **r2.03**.
- [x] **Stellar Ingestion**: `api-go` streams ledgers from Stellar Testnet and persists them to `^Stellar`.
- [x] **Transaction Ingestion**: `api-go` fetches and stores transaction XDR/hash for each ledger.
- [x] **Cross-Service Monitoring**: `core-rust` monitors `^Stellar` and processes ledgers in real-time.
- [x] **XDR Validation**: `core-rust` decodes and validates Stellar transaction envelopes (Protocol 24).
- [x] **Account State Updates**: `core-rust` updates `^Account(source_account, "seq_num")` with sequence numbers.
- [x] **Balance Tracking**: `core-rust` calculates and applies balance deltas in stroops for native XLM.
- [x] **Trustline Tracking**: `core-rust` handles ChangeTrust operations and non-native asset balances (**TOKE verified**).
- [x] **Reporting API**: `api-report` provides REST API with API key authentication.
- [x] **Interactive Documentation**: **OpenAPI 3.0 / Swagger UI** integrated directly into the appliance. 📖
- [x] **Hardened Stability**: CGo shared memory iteration optimized for high-concurrency environments.
- [x] **SQL Access**: Octo SQL interface operational for reporting.
- [x] **API Documentation**: Interactive Swagger UI and OpenAPI 3.0 spec integrated.

## API Documentation

The reporting service serves an interactive Swagger UI for quick experimentation and exploration:

- **Swagger UI**: `http://<node-ip>:8080/docs`
- **OpenAPI Spec**: `http://<node-ip>:8080/openapi.yaml`

## Deployment Instructions

```bash
# Deploy to VM
scp pakana-node.tar.gz <vm-user>@<vm-ip>:~/
ssh <vm-user>@<vm-ip> "tar -xzf pakana-node.tar.gz && cd pakana-node && docker compose up -d"

# Initialize SQL Schema (First run only)
# Initialize SQL Schema (First run only)
cat init.sql | docker exec -i pakana-api-go /bin/bash -c "export ydb_gbldir=/data/r2.03_x86_64/g/yottadb.gld; export ydb_routines=\"/data/r2.03_x86_64/o/utf8 /data/r2.03_x86_64/r /data/r2.03_x86_64/o /opt/yottadb/current/plugin/o/utf8 /opt/yottadb/current/plugin/r /opt/yottadb/current/plugin/o /opt/yottadb/current/libyottadbutil.so /opt/yottadb/current/libyottadb.so /opt/yottadb/current\"; /opt/yottadb/current/plugin/octo/bin/octo"
```

## CI/CD & Automated Deployment

The Pakana Node features a bulletproof CI/CD pipeline using GitHub Actions for automated, "appliance-first" updates.

### GitHub Secrets Setup
To enable automated deployments, add the following Secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

1.  `VM_IP`: `4.246.101.185`
2.  `VM_USER`: `stevenadmin`
3.  `SSH_PRIVATE_KEY`: The contents of your `pakana-node.pem` file.

### Deployment Flow
1.  **Push to `main`**: Any merge or push to the `main` branch triggers the workflow.
2.  **Package**: GitHub Actions creates a clean release tarball (excluding `node_modules` and local database files).
3.  **Deploy**: The tarball is securely copied to the VM and the `deploy.sh` script is executed.
4.  **Health Check**: The script restarts Docker containers (preserving the database volume) and waits for the `/health` endpoint to signal "online" before completing.

> [!TIP]
> **Deployment SSH Timeout?** If GitHub Actions fails with `i/o timeout` on port 22, ensure your Azure Network Security Group (NSG) allows inbound traffic on port 22. Since the `GitHub` service tag may not be available in all regions, you can set the **Source** to `Any` or `AzureCloud`. Your deployment is secured by the `pakana-node.pem` private key.

## Security & Operations

### Network Security
- **Private By Design**: The Stellar network is private; ensure your `STELLAR_NETWORK_PASSPHRASE` is kept secret.
- **Database Access**: YottaDB ports (`9080`, `1337`) are bound to `127.0.0.1`. You **MUST** use an SSH Tunnel to access them via SQL/DBeaver. Do not open these ports in your firewall (NSG).
- **API Security**: The Reporting API is protected by `X-API-Key`. Change the default key using the `PAKANA_API_KEY` environment variable.

### TLS/SSL
- **Automatic HTTPS**: Caddy is configured to automatically provision certificates via Let's Encrypt for `PAKANA_DOMAIN`. (Confirmed: Activated on `api-report`).
- **Ports**: Only open ports `80` (HTTP) and `443` (HTTPS) to the internet.

### Issued Assets
- **TOKE**: Sovereign utility token.
  - **Distribution Account**: `GCWGJWZVNLBSDXCRMWZMWZI2K6GQJABYPTNBLLYOZP4GNTQCKIHYYIEE`
  - **Status**: Minted and Distributing.

## Project Structure

```
.
├── api-go/             # Go ingestor service
├── core-rust/          # Rust processor service
├── api-report/         # Reporting API service
│   └── dashboard/      # React frontend (Vite)
├── docs/               # Documentation (AGENTS.md, WALKTHROUGH.md)
├── init.sql            # Octo SQL DDL
├── docker-compose.yml  # Multi-service orchestration
├── vm_tuning.sh        # Host optimization script
└── setup.sh            # One-command deployment script
```

## Test Results

- **Go Write Test**: `2026/01/18 11:42:12 Successfully wrote timestamp to ^Ledger: 1768736532`
- **Go Read Test**: `2026/01/18 11:42:12 Verification: Read back value from ^Ledger: 1768736532`
- **SQL Test**: `CREATE TABLE accounts (...) GLOBAL '^Account';` -> Success.

## Next Steps

- [x] Implement Horizon stream for Stellar ledgers.
- [x] Develop Rust validator logic for Stellar-XDR transactions.
- [x] Connect transactions to account state updates.
- [x] Migrate to YottaDB r2.03 for SQL compatibility.
- [x] Implement balance tracking for native XLM.
- [x] Implement trustline tracking for non-XLM assets (LBX ready).
- [x] Implement Reporting API with authentication.
- [x] Issue TOKE token on Stellar network.
- [x] Configure SSL/TLS with Let's Encrypt.

## Reporting API Usage

```bash
# Health check (no auth required)
curl http://localhost:8080/health

# Get latest ledger
curl -H 'X-API-Key: YOUR_API_KEY' http://localhost:8080/api/v1/ledgers/latest

# Get account balance
curl -H 'X-API-Key: YOUR_API_KEY' http://localhost:8080/api/v1/accounts/{account_id}

# Get account trustlines
curl -H 'X-API-Key: YOUR_API_KEY' http://localhost:8080/api/v1/accounts/{account_id}/trustlines
```

## Future: Appliance Sizing & Sparse Blockchain History

### Current Status (Phase 6)
The current deployment uses Azure resources sized for full Stellar archive processing:
- **Storage**: 4TB Premium SSD (P50) - 7500 IOPS, 250 MB/s
- **Memory**: 112GB RAM
- **Partition**: 220GB active (mounted at `/data`)

### Planned Optimization: Sparse Blockchain History
Once the system is stable, reliable, secure, and performant, we will implement **Sparse Blockchain History** to dramatically reduce resource requirements:

**Design Principles:**
- **Filtered Ingestion**: Only store transactions involving Pakana-managed accounts
- **Rolling Window**: Maintain 90-day operational history (configurable)
- **Hierarchical Optimization**: Leverage YottaDB's in-process efficiency for hot data access
- **Appliance-First**: Target <100GB total footprint for portable "node-in-a-box" deployment

**Estimated Resource Requirements (Post-Sparse):**
- **Storage**: 128GB Premium SSD (P10) - 500 IOPS, 100 MB/s (~97% cost reduction)
- **Memory**: 16-32GB RAM (optimal for YottaDB buffer pool + working set)
- **VM**: Standard_D8s_v5 (8 vCPU, 32GB RAM) vs. current larger instance

**Implementation Roadmap:**
1. ✅ Verify remediation and establish stable baseline
2. ✅ Deploy clean system with thorough testing
3. ⏳ Implement sparse filtering and retention policies
4. ⏳ Collect metrics for 30+ days to validate resource usage
5. ⏳ Design optimal appliance packaging for edge/regional deployment

> [!NOTE]
> This optimization aligns with Pakana's sovereignty model: lean, portable, and cost-effective sovereign nodes that can be deployed anywhere, without requiring archive-scale infrastructure.

## Querying Data via SQL (DBeaver)

The Pakana Node exposes a PostgreSQL-compatible interface via **YottaDB Rocto**. Due to security and binding constraints, the most reliable way to connect is via an **SSH Tunnel**.

### Option 1: SSH Tunnel (Recommended)
1. In DBeaver, create a new **PostgreSQL** connection.
2. **Main Tab**:
   - **Host**: `localhost`
   - **Port**: `9080`
   - **Database**: `OCTO`
   - **User**: `stevenadmin`
3. **SSH Tab**:
   - Check **Use SSH Tunnel**.
   - **Host/IP**: `4.246.101.185`
   - **Port**: `22`
   - **User**: `stevenadmin`
   - **Authentication**: Select your `.pem` key file.
4. **Test Connection**.

### Example Query:
```sql
SELECT * FROM ledgers ORDER BY sequence DESC LIMIT 10;
```
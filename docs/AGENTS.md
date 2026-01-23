# Pakana Node: AI Agent Operational Guide

This document provides technical reference for AI agents interacting with the Pakana Node environment.

## 1. Environment & Paths

All services use a shared YottaDB volume mounted at `/data`.

| Variable | Value | Description |
| :--- | :--- | :--- |
| `ydb_dist` | `/opt/yottadb/current` | YottaDB binaries location |
| `ydb_gbldir` | `/data/r1.35_x86_64/g/octo.gld` | Active global directory |
| `ydb_nodename`| `pakana-node` | **CRITICAL**: Must match Docker `hostname` |
| `ydb_tmp` | `/data/tmp` | Shared lock file directory |
| `GTM_TMP` | `/data/tmp` | Legacy compatibility for lock files |

## 2. Infrastructure Status

### Azure VM Optimization
- **Kernel Tuning**: Completed (`kernel.sem` set).
- **Disk I/O**: Premium SSD v2 mounted at `/data` with `noatime`.

### Container Convergence
To resolve `HOSTCONFLICT` errors, all containers enforce:
1.  `ipc: host`: Shared IPC namespace.
2.  `hostname: pakana-node`: Identical network hostname.
3.  `ydb_nodename=pakana-node`: Identical YottaDB node ID.
4.  `ydb_tmp=/data/tmp`: Shared location on persistent volume for lock files.

## 3. Database Interaction (Octo/SQL)

The node uses Octo for SQL visibility into M-based globals.

### Schema Definition
```sql
CREATE TABLE accounts (
  id VARCHAR(56) PRIMARY KEY,
  balance NUMERIC(20,7),
  seq_num BIGINT,
  version INTEGER
) GLOBAL '^Account';

CREATE TABLE ledgers (
  sequence BIGINT PRIMARY KEY,
  closed_at VARCHAR(30)
) GLOBAL '^Stellar("ledger")';
```

### Executing SQL Queries
Agents must use the `yottadb` container (or any utilizing the shared env) and set the context correctly:
```bash
docker exec -i pakana-yottadb /bin/bash -c 'export ydb_dist=/opt/yottadb/current; export ydb_gbldir=/data/r1.35_x86_64/g/octo.gld; export ydb_nodename=pakana-node; export ydb_routines="/data/r1.35_x86_64/o/utf8 /data/r1.35_x86_64/r /data/r1.35_x86_64/o /opt/yottadb/current/plugin/o/utf8 /opt/yottadb/current/plugin/r /opt/yottadb/current/plugin/o /opt/yottadb/current/libyottadbutil.so /opt/yottadb/current/libyottadb.so /opt/yottadb/current"; echo "SELECT * FROM ledgers ORDER BY sequence DESC LIMIT 5;" | /opt/yottadb/current/plugin/octo/bin/octo'
```

### 3.1 External SQL Access (DBeaver)
You can connect to the database from personal tools like DBeaver:
- **Host**: `4.246.101.185`
- **Port**: `9080`
- **Database**: `OCTO`
- **User/Pass**: (none required)
- **Driver**: **PostgreSQL**

## 4. Operation & Troubleshooting

### Data Seeding Logic
If `/data` is empty, `db-init` seeds it. It also ensures `/data/tmp` exists with correct permissions.

### Ghost Locks (HOSTCONFLICT)
If `HOSTCONFLICT` persists despite configuration:
1.  **Stop all containers**: `docker compose down`
2.  **Reset Volume (Drastic)**: `docker compose down -v` (Data loss!)
3.  **Manual Rundown**: Run `mupip rundown -f "*"` in a temp container mounting the volume.

### Deployment Lifecycle
1.  **Host Tuning**: Run `vm_tuning.sh`.
2.  **Container Start**: `docker compose up -d`.
3.  **SQL Setup**: exec init scripts.

## 5. Development Progress Log
- [x] Host IPC Convergence implementation.
- [x] Init Container seeding strategy.
- [x] Steel Thread PoC: Go <-> YottaDB <-> Rust (Validated).
- [x] Octo SQL visibility for accounts and ledgers.
- [x] Stellar Testnet Live Ingestion.
- [x] Rust XDR Validator Implementation.
- [x] **Phase 3**: Transaction ingestion (XDR + hash) and account state updates.
- [x] **YottaDB r2.03 Migration**: Fresh start migration for SQL compatibility.
- [x] **Phase 4**: Account balance tracking (stellar-xdr v24.0, native XLM in stroops).
- [x] **Phase 4.1**: Trustline balance tracking (ChangeTrust, non-native assets, TOKE ready).
- [x] **Phase 5**: Reporting API (`api-report` service with REST endpoints and API key auth).
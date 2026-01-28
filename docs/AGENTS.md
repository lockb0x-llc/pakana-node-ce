# Pakana Node: AI Agent Operational Guide

> **Role**: You are the Systems Architect for the Pakana Node CE.
> **Context**: High-performance, sovereign blockchain appliance.

## 1. Technical Stack
*   **Database**: YottaDB r2.03 (Hierarchical Key-Value) + Octo (SQL).
*   **Ingest**: Go 1.24 + CGo (Direct YottaDB Bindings).
*   **Core**: Rust 1.75 + `stellar-xdr`.
*   **Infra**: Docker Compose, Azure Linux (Ubuntu 24.04).

## 2. Infrastructure Constraints
*   **Shared Memory**: All containers share `ipc: host`. Any new container needing DB access MUST have this flag.
*   **Locking**: The directory `/data/tmp` is critical for YottaDB lock management. Do not change this path.
*   **Network**: The node is behind a Caddy reverse proxy. Internal services bind to `127.0.0.1`.

## 3. Common Tasks

### Adding a New YottaDB Global
If you need to store new data types:
1.  **Define Structure**: `^MyGlobal({key1}, {key2}) = value`.
2.  **Map to SQL (Optional)**: Update `init.sql` to `CREATE TABLE ... GLOBAL '^MyGlobal'`.
3.  **Update Permission**: Ensure `yottadb.gld` allows the definition (usually covered by DEFAULT region).

### Debugging "Lock" Issues
If the database seems "stuck":
1.  Check `docker compose logs yottadb`.
2.  Ensure no zombie processes are holding locks in `/data/tmp`.

## 4. Documentation Strategy
*   **User-Facing**: `README.md`, `TECHNICAL_MANUAL.md`.
*   **Internal**: This file, `LOG.md`.
*   **Tone**: Professional, technical, open-source community focus.
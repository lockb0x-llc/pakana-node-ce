# Core-Rust Service: The Validator

## Executive Summary
The **core-rust** service is the mathematical heart of the Pakana Node. It serves as **"The Validator"**, responsible for enforcing business logic, cryptographic safety, and regulatory compliance on every transaction.

Built on **Rust**, it leverages memory safety and zero-cost abstractions to process complex Stellar XDR envelopes at wire speed. It ensures that every asset transfer, account update, and trustline change adheres to the **Lockb0x Protocol** (IETF Draft) for Controllable Electronic Records (CER).

## Purpose
Acts as the **State Processor** for the node, operating directly on the YottaDB shared memory segment to:
1.  **Decode XDR**: Parses raw binary Stellar Protocol 24 envelopes.
2.  **Enforce Rules**: Validates transaction preconditions (signatures, fees, sequence numbers).
3.  **Commit State**: Updates account balances and metadata in `^Account` using strict atomic transactions.

## Current State

- **Build Environment**: **Standardized**. Using Rust **1.93.0** (Stable) within a YottaDB r2.03 environment.
- **Functionality**: **Active Core Processor**. Polls `^Stellar("latest")`, decodes XDR envelopes using the `stellar-xdr` crate, and applies state transitions to `^Account` (balances and sequence numbers).
- **YottaDB Integration**: Uses the `yottadb` crate **v2.1.0** for high-performance TP-safe access.

## Validator Features
- Decodes Stellar XDR `TransactionEnvelope` (Protocol 24).
- Validates transaction constraints (Fee, Sequence, Source Presence).
- **Balance Tracking**: Calculates and applies native XLM balance deltas in stroops.
- **Trustline Tracking**: Supports `ChangeTrust` and non-native asset tracking.
- **Atomic Operations**: All state changes are committed within YottaDB Transaction Processing (TP) blocks.

## Build and Run

### Docker (Appliance-First)
```bash
docker compose up -d core-rust
```

### Dependency Notes
The service requires:
- `libclang-dev` and `clang-18` (for bindgen and YottaDB interop).
- `LD_LIBRARY_PATH` pointing to YottaDB dist (`/opt/yottadb/current`).
- `RUST_LOG=info` for visibility.

## Architecture: Shared Memory & Validation
- **Shared Memory**: Uses `ipc: host` to access YottaDB in-process for sub-millisecond state access.
- **Lock Management**: Shared `ydb_tmp=/data/tmp` ensures deterministic locking across the stack.
- **Protocol 24 Ready**: Built to handle the latest Stellar network features and XDR structures.

## Next Steps
- [ ] Implement enhanced signature verification logic.
- [ ] Extend `ChangeTrust` logic for complex multi-asset scenarios.
- [ ] Add support for Soroban-adjacent state metadata (Deferred).

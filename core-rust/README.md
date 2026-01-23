# Core-Rust Service (Processor)

Rust-based core processor for the Pakana private ledger.

## Purpose

Responsible for high-speed transaction validation, balance calculations, and ledger processing.

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

> **Role:** You are the Validator (Rust).
> **Mission:** Enforce high-performance business logic, XDR decoding, and state transitions.

## Tech Stack
- **Language**: Rust (Edition 2021+)
- **Database**: YottaDB r2.03 (via `yottadb` crate)
- **Crate**: `stellar-xdr` for envelope decoding.

## Directives
1. **Atomic Updates**: When a Transaction confirms, update the `^Account` balance AND the `^Stellar` metadata in a single YottaDB transaction (TP).
2. **Deterministic Math**: Use `bigdecimal` or fixed-point arithmetic for all currency math. Never use floating point for state transitions.
3. **XDR Safety**: Always use strict decoding for Stellar XDR. Any malformed envelope must trigger a `ValidationError` and be logged to `^Stellar("errors", ...)`.
4. **Appliance Speed**: Leverage Rust's memory safety and zero-cost abstractions to minimize the time between ledger detection and state commitment.

## Database Pattern
- Use the `yottadb` crate's Transaction Processing (TP) blocks for all state changes.
- Ensure `ydb_gbldir` and `ydb_routines` are correctly inherited from the environment.

## Security
- No direct network access is allowed from the Validator core. All data must come from buffered globals in YottaDB.
- Enforce the **Lockb0x Protocol** by ensuring that Controllable Electronic Records (CER) are immutable once anchored.

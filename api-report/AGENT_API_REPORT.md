# Agent Instructions: api-report Service

## Architecture Overview

This service is a **Reporting API** that provides read-only access to Pakana blockchain data. It serves as a query layer over YottaDB and external data sources (Stellar Horizon).
The system is now standardized on Go 1.24.0 and the modern YottaDB Go v2.x "Node" API, running on a clean YottaDB r2.03 architecture.

## Read-Only Constraint

> [!CAUTION]
> This service must be **strictly read-only**. Any database write operations violate the core architecture.

### Prohibited Operations

- ❌ Do NOT use `yottadb.SetValE()`, `Set()`, `Delete()`, or any write functions.
- ❌ Do NOT persist data to YottaDB globals (`^Account`, `^Stellar`, etc.).
- ❌ Do NOT launch goroutines that write to the database.
- ❌ Do NOT cache Horizon API responses in YottaDB. Any write from this service violates **shared memory safety** and can cause **YottaDB corruption** due to the process-level locking model.

### Allowed Operations

- ✅ Read from YottaDB using:
  - `yottadb.ValE()` - Get value
  - `yottadb.SubNextE()` - Iterate subscripts
  - `yottadb.SubPrevE()` - Reverse iterate
- ✅ Query external APIs (Horizon) for data not in YottaDB
- ✅ Return data to HTTP clients
- ✅ Transform/aggregate data for reporting

## If Write Operation is Needed

All database writes must be routed through the **kernel services**:

1. **api-go** (Ingestor): Primary data ingestion from Stellar network
2. **core-rust** (Verifier): Transaction validation and balance updates

### How to Route Writes

If a new feature requires persisting data:

1. **Determine which kernel service should handle it**:
   - Ledger/transaction ingestion → `api-go`
   - Account state updates/validation → `core-rust`

2. **Add the write operation to that service**:
   - Create new endpoint or extend existing logic
   - Use `yottadb.TpE()` for ACID transactions

3. **Call from api-report if needed**:
   ```go
   // Example: Trigger background ingestion via api-go
   resp, err :=http.Post("http://api-go:PORT/ingest-account", ...)
   ```

## YottaDB Access Pattern

This service uses the YottaDB Go v2.x driver which:
- Auto-initializes on first YottaDB call (no explicit `Init()`)
- Coordinates IPC with other processes via `ipc: host` in Docker
- Uses shared memory for efficient read access

### Global Structure (Read-Only Reference)

```
^Account(accountID, "balance")          → Native XLM balance (stroops)
^Account(accountID, "seq_num")          → Sequence number
^Account(accountID, "trustlines", ...)  → Asset trustlines

^Stellar("latest")                      → Latest ingested ledger sequence
^Stellar("ledger", seq, "closed_at")    → Ledger close time
^Stellar("ledger", seq, "tx", idx, ...) → Transaction data
```

## Enforcement

Any PR that introduces `SetValE`, `DeleteE`, `TpE` (write transaction), or other write operations to this service must be rejected with reference to this document.

---

## Sparse Blockchain History Pattern

### Problem

We don't store the entire 10+ year Stellar ledger history in YottaDB. When a legacy account or transaction is requested, we need to:
1. Check if it exists in YottaDB
2. If not, fetch from Horizon and cache it
3. Return the data

### ❌ WRONG: Direct Write from api-report

```go
// ARCHITECTURAL VIOLATION - DO NOT DO THIS
func fetchAccountFromHorizon(accountID string) (*AccountResponse, error) {
    hzAccount, err := hzClient.AccountDetail(...)
    
    // ❌ Writing directly to YottaDB
    go persistAccountToYDB(response)
    
    return response, nil
}
```

### ✅ CORRECT: Delegate to api-go

```go
func fetchAccount(accountID string) (*AccountResponse, error) {
    // 1. Check YottaDB first
    balance, err := yottadb.ValE(...)
    if err == nil {
        return buildAccountResponse(...) // Cache hit
    }
    
    // 2. Not in cache - request api-go to fetch and persist
    if err := requestAccountCache(accountID); err != nil {
        return nil, err // Not found on Horizon
    }
    
    // 3. Retry YottaDB lookup (should be cached now)
    balance, err = yottadb.ValE(...)
    return buildAccountResponse(...)
}

func requestAccountCache(accountID string) error {
    // Call api-go internal endpoint
    resp, err := http.Post("http://pakana-api-go:8081/internal/cache-account",
                           "application/json",
                           marshalAccountRequest(accountID))
    // Handle response...
}
```

**Flow**:
```
api-report (Read-Only)
    ↓ YottaDB lookup (miss)
    ↓ HTTP POST to api-go
api-go (Kernel)
    ↓ Fetch from Horizon
    ↓ Persist with TpE()
    ↓ Return 200 OK
api-report
    ↓ Retry YottaDB (hit)
    ↓ Return to client
```

### api-go Endpoints (For Reference)

- `POST /internal/cache-account` - Cache account data
- `POST /internal/cache-account-transactions` - Cache transaction history

These are internal endpoints (not exposed externally) for service-to-service communication.

---

## UI & Dashboard (Cyberpunk Aesthetic)

This service serves the **Pakana Dashboard**, which must adhere to a "Premium Cyberpunk" design system.

### Design Directives:
- **Glassmorphism**: Use `backdrop-blur-md` and semi-transparent backgrounds (`bg-slate-950/xx`).
- **Neon Accents**: Use status-based neon shadows and borders (e.g., `shadow-[0_0_15px_rgba(16,185,129,0.2)]`).
- **Interactive Tooltips**: All data displays (Metrics, Badges, Cards) MUST include descriptive tooltips (using the `Tooltip` component) explaining the underlying tech (e.g., explaining that "Validator Active" means the Rust core is applying XDR transitions via YottaDB TP).

### Observability Architecture:
- **Component IDs**: Every UI element MUST have a unique `data-component-id`. Format: `ComponentType-Identity` (e.g., `Card-LatestLedger`, `Badge-IngestionStatus`).
- **Contextual Labels**: Use IDs that describe the *domain function* of the component, not its visual layout. This allows agents and humans to debug data flow instantly.

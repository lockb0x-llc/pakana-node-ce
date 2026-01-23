# System Architecture & Design

## 1. High-Level Diagram

```mermaid
graph TD
    User[C# Pakana App] -->|HTTPS/JSON| Proxy[Caddy Reverse Proxy]
    Proxy -->|Read/Write CER| ApiPakana[api-pakana (Rust)]
    Proxy -->|Ingest/Stream| ApiGo[api-go (Go)]
    
    ApiGo -->|Writes| YottaDB[(YottaDB)]
    ApiPakana -->|Reads/Writes| YottaDB
    ApiPakana -->|File IO| SSD[Premium SSD /data]
    
    CoreRust[core-rust (Validator)] -->|Monitors| YottaDB
    CoreRust -->|Updates| YottaDB
    
    ApiGo <-->|Horizon API| Stellar[Stellar Network]

```

## 2. Service Definitions

### **A. `api-pakana` (The Codex Engine)**

* **Role:** The primary interface for the Pakana App. Replaces the generic reporting tool.
* **Tech:** Rust (Axum/Actix), `libyottadb`.
* **Responsibility:**
1. Accepts raw file uploads (Waivers).
2. Computes SHA-256 NI-URIs locally.
3. Constructs "Draft" Codex Entries.
4. Writes to `^Codex` global.



### **B. `api-go` (The Sentinel)**

* **Role:** Network Ingestion.
* **Tech:** Go, `stellar-sdk`.
* **Responsibility:**
1. Streams Ledgers.
2. **Smart Filter:** Discards transactions irrelevant to known Pakana DIDs/Assets.
3. Writes raw XDR to `^Stellar`.



### **C. `core-rust` (The Logic Core)**

* **Role:** Async Event Processor.
* **Tech:** Rust.
* **Responsibility:**
1. Watches `^Stellar` for new transactions.
2. Verifies Memo Hashes against `^Codex` entries.
3. "Finalizes" a Codex Entry (adds Anchor info) when the Stellar Tx is confirmed.

## 3. The Closed Meta-Network Architecture

The Pakana Node operates as a **Closed Meta-Network**—a sovereign overlay that leverages the public Stellar blockchain as a decentralized source of truth while maintaining a private, resilient, and high-performance execution environment.

### **Key Concepts**

*   **Public Anchor / Private State:** The public Stellar network serves as the immutable "Anchor." Transactions on the public ledger provide cryptographic finality and timestamping for private state transitions within the Pakana Node.
*   **Proof of Custody & Provenance:** Beyond a ledger state machine, the node acts as a **Sovereign Repository**. It provides verifiable proof of custody, provenance, and existence for data-represented assets (e.g., construction lien waivers, legal documents).
*   **Virtual Private Resilience:** Pakana nodes are designed to inter-connect in a decentralized VPN/P2P mesh. This allows for the creation of highly resilient private networks that can operate even if individual nodes or centralized infrastructure fail.
*   **Low-Cost Sovereignty:** The appliance-first design is optimized for YottaDB's hierarchical storage, allowing for massive throughput and sub-10ms latency on low-cost virtual machines and edge devices.
*   **Logical Isolation:** By utilizing the **Lockb0x Protocol**, Pakana ensures that private data remains private, with only cryptographic hashes (NI-URIs) shared on the public chain for global verification.

## 4. Sparse Blockchain History Pattern

The Pakana Node employs a **Sparse Blockchain History** approach for efficient resource usage while maintaining full veracity.

### **Principle**
Instead of syncing the entire Stellar ledger history, the node:
1. **Ingests only new transactions** via `api-go` streaming.
2. **Fetches historical data on-demand** when accounts are queried.
3. **Caches all fetched data** to YottaDB for future local-only access.

### **Data Flow**
```
┌─────────────────────────────────────────────────────────┐
│ Query: GET /api/v1/accounts/{id}                        │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Check YottaDB (^Account)  →  Found? Return locally.  │
└────────────────────────┬────────────────────────────────┘
                         │ Not Found
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Query Stellar Horizon API                            │
│    • Account details                                    │
│    • Full transaction history (async)                   │
└────────────────────────┬────────────────────────────────┘
                         │ Found
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Persist to YottaDB                                   │
│    • ^Account(id, "balance"|"trustlines"|...)           │
│    • ^Stellar("account_tx", id, idx, "hash"|"xdr")      │
│ 4. Return data to user                                  │
└─────────────────────────────────────────────────────────┘
```

### **YottaDB Schema (Account Data)**
| Global | Purpose |
|--------|---------|
| `^Account(id, "balance")` | Native XLM balance (stroops) |
| `^Account(id, "trustlines", asset, "balance")` | Asset balances |
| `^Stellar("account_tx", id, idx, "hash")` | Transaction hash |
| `^Stellar("account_tx", id, idx, "xdr")` | Transaction envelope |
| `^Stellar("account_tx", id, idx, "ledger")` | Ledger sequence |
| `^Stellar("account_tx", id, "count")` | Total transaction count |

### **Benefits**
- **Resource Efficiency**: Only stores data relevant to Pakana operations.
- **Full Auditability**: Transaction history retrieved back to initial funding.
- **Performance**: Subsequent queries served from local YottaDB.
- **Veracity**: Data sourced from authoritative Stellar network.

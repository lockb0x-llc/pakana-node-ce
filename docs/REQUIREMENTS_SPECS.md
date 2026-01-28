# Requirements & Technical Specifications

## 1. Hardware Profile (Azure F-Series)

The Community Edition is optimized for the **Azure Compute Optimized** family.

*   **SKU**: `Standard_F2s_v2` (2 vCPUs, 4GB RAM) or higher.
    *   *Why*: YottaDB and XDR validation are CPU-intensive. High clock speeds benefit throughput.
*   **Storage**: **Premium SSD v2** (LRS).
    *   *Requirement*: Hosted at `/data` with `noatime`.
    *   *IOPS*: Minimum 3000 IOPS for ledger saturation.
*   **OS**: Ubuntu 24.04 LTS (Noble Numbat).

## 2. Functional Requirements

### R1. Network Sentinel
The system MUST be able to keep up with the Stellar Testnet ledger close rate (approx. every 5 seconds).
*   **Metric**: Ingestion latency < 2s.

### R2. Data Sovereignty
The system MUST store all cryptographic state locally.
*   **Implementation**: All ledger data (`^Stellar`) and account state (`^Account`) resides on the specific `/data` volume. No external database dependencies.

### R3. API Security
The system MUST protect its read-only API.
*   **Method**: `X-API-Key` header authentication.
*   **Encryption**: TLS 1.3 via Caddy reverse proxy.

## 3. Data Model (YottaDB Hierarchical)

The system uses a "Tree" structure instead of Tables.

### A. The Ledger Store
```m
; Ledger Header
^Stellar("ledger", {sequence}) = "close_time|hash|prev_hash"

; Transactions
^Stellar("ledger", {sequence}, "tx", {index}) = "base64_envelope_xdr"
^Stellar("ledger", {sequence}, "tx", {index}, "hash") = "hex_hash"
```

### B. The Account State
```m
; Native Balance (XLM in stroops)
^Account({account_id}, "balance") = 10000000000

; Trustlines (Asset Balances)
^Account({account_id}, "trustlines", {asset_code}, {issuer_id}, "balance") = 500

; Metadata
^Account({account_id}, "seq_num") = 123456789
```

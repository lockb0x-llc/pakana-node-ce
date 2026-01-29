# Catalog & Gap Analysis: Pakana Node Community Edition

This document provides a feature matrix and technical gap analysis for the current state of Project Pakana (v1.0.0 CE), identifying discrepancies between documentation and implementation.

## 1. Feature Matrix (Current vs. Goal)

| Component | Feature | Status | Gap / Notes |
| :--- | :--- | :--- | :--- |
| **Ingestion (api-go)** | Ledger Streaming | ✅ Stable | Streams Testnet ledgers to `^Stellar`. |
| | Transaction Indexing | ✅ Stable | Stores hash/metadata in `^Stellar`. |
| | **Smart Filtering** | ❌ **GAPPED** | README/Roadmap mentions filtering by Pakana Accounts; currently streams *all* network traffic. |
| **Validation (core-rust)** | XDR Decoding | ✅ Stable | Handles Protocol 24 envelopes. |
| | Balance Tracking | ✅ Stable | Updates Stroops in `^Account`. |
| | **Trustline Tracking** | ⚠️ **BROKEN** | Discrepancy in YDB Global schema between `api-go` and `api-report` (see below). |
| **Reporting (api-report)** | REST API | ✅ Stable | Auth via `X-API-Key`. |
| | **Read-Through Cache** | ⚠️ Partial | Implemented in `api-report` handlers, but ignores planned delegation to `api-go`. |
| | **StateExplorer UI** | ⚠️ Partial | Balance/Seq works; Trustlines display is currently broken. |
| | **api-pakana Pivot** | ❌ **GAPPED** | Roadmap suggests pivot to Rust-based `api-pakana`. Currently legacy Go `api-report`. |
| **Infrastructure** | Azure Appliance | ✅ Stable | `Standard_F2s_v2` with Premium SSD v2. |
| | Caddy SSL | ✅ Stable | `pakana.lockb0x.io` auto-provisioning. |
| | **Sparse History** | ⚠️ Partial | Exists as on-demand rehydration, but lacks 90-day pruning and stream-level filtering. |

---

## 2. Technical Gap Analysis

### [G-01] Trustline Schema Collision
*   **Issue**: `api-go` and `api-report` use different YottaDB global hierarchies for asset storage.
*   **Impact**: Trustlines appear in the database but are invisible to the Dashboard UI.
*   **Root Cause**:
    *   `api-go`: `^Account(id, "trustlines", assetCode, "balance")`
    *   `api-report`: `^Account(id, "trustlines", assetCode, issuer, "balance")`
*   **Remediation**: Standardize on the hierarchical Issuer-inclusive structure to support multi-issuer assets (e.g., USDC).

### [G-02] Sparse History: Cache vs. Filter
*   **Issue**: The implementation uses "On-demand Hydration" (pull) rather than "Smart Filtering" (push).
*   **Impact**: The node still ingests high-volume network noise before it reaches the cache logic.
*   **Root Cause**: `api-go` lacks a whitelist check in its main stream loop.
*   **Remediation**: Implement a `^Tracked` global whitelisting relevant Account IDs to drop transactions at the ingestion stage.

### [G-03] Service Responsibility Overlap
*   **Issue**: `api-report` (Read-Only) is performing write operations (Horizon Hydration).
*   **Impact**: Violates "Appliance-First" design and bypasses `core-rust` validation logic for hydrated accounts.
*   **Remediation**: Enforce delegation. `api-report` should call `api-go:8081/internal/cache-account` and let the Ingestor handle writes.

### [G-04] Rehydration Persistence
*   **Issue**: Rehydrated accounts (fetched from Horizon) lack the `last_modified` pointer required for `core-rust` to resume delta-validation.
*   **Remediation**: Ensure total state capture during rehydration, including sub-entries like signers and data entries.

---

## 3. High-Priority Remediation Plan

1.  **Standardize Global Schema**: Update `api-go` to include the `issuer` in the `^Account` hierarchy.
2.  **Restore Trustline Display**: Fix `api-report` handlers to match the standardized schema.
3.  **Bridge Internal API**: Connect `api-report` to `api-go`'s internal hydration endpoint to restore "Read-Only" integrity.
4.  **Implement Whitelist Filter**: Add whitelisting to `api-go` main stream to achieve true "Sparse History".

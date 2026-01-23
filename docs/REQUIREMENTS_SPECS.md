# Requirements & Technical Specifications

## 1. Functional Requirements

* **R1. Ingestion:** The system MUST ingest transactions from the Stellar Network (Testnet/Mainnet) via Horizon, filtering specifically for "Pakana-tagged" accounts (identified by `home_domain` or specific Asset issuers).
* **R2. Lockb0x Compliance:** The system MUST implement the Lockb0x Protocol v0.0.3 to generate, validate, and store **Codex Entries** (CERs).
* *Constraint:* Must support `ni:///sha-256` integrity proofs.


* **R3. Atomic Validation:** The system MUST validate that every "Payment" (Disbursement) is cryptographically linked to a "Deliverable" (Waiver/Invoice) via a Memo Hash.
* **R4. Hybrid Storage:** The system MUST store "State" (Balances, Relations) in YottaDB and "Artifacts" (PDFs, JSON Blobs) in a local, cryptographically addressed file store (`/data/storage/blobs`).

## 2. Non-Functional Requirements

* **N1. Performance:** API read latency < 10ms for 95th percentile. YottaDB writes MUST use `ipc: host` for direct memory access.
* **N2. Sovereignty:** The appliance MUST be deployable via a single `docker compose up` command on a fresh Ubuntu 24.04 VM.
* **N3. Security:** No database ports exposed publicly. TLS via Caddy reverse proxy. API Access via `X-API-Key`.

## 3. Data Model Specification (YottaDB Globals)

The system transitions from Relational (SQL) thinking to Hierarchical (M-style) thinking.

### **The Codex (Lockb0x Store)**

```m
; Root Record (Canonical JSON)
^Codex("uuid-v4") = "{ ... json content ... }"

; Indices for high-speed lookup
^CodexIdx("artifact", "workorder-789", "uuid-v4") = 1
^CodexIdx("integrity", "ni:///sha-256;...", "uuid-v4") = 1

```

### **The Business State (Hybrid Migration Target)**

```m
; Organization Root
^Pakana("Org", {OrgId}) = "Name|OwnerDID|Status"
^Pakana("Org", {OrgId}, "Stellar", "M") = "M-Account-Address"

; Project & WorkOrder Hierarchy
^Pakana("Org", {OrgId}, "Proj", {ProjId}) = "Title|ManagerDID"
^Pakana("Org", {OrgId}, "Proj", {ProjId}, "WO", {WorkOrderId}) = "Funding|Status"

```

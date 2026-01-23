Here is the comprehensive documentation suite for the **Pakana Node**, designed to serve as the master blueprint for the project's strategic rollout, technical implementation, and eventual monetization.

This content is structured to be dropped directly into your repository.

---

### **1. Project Root: The Master Plan**

**File:** `README.md` (or `docs/MASTER_PLAN.md`)

# Project Pakana: The Sovereign Node Appliance (Community Edition)

### "A Virtual Appliance for 21st Century Commerce"

## 1. Executive Summary

Project Pakana is a decentralized infrastructure initiative designed to bridge the gap between **Real World Assets (RWA)**, **DeFi**, and **Legal Compliance**. The "Pakana Node" is a sovereign, containerized virtual appliance that allows organizations to act as their own bank, notary, and record keeper.

By combining the speed of **YottaDB** (Hierarchical NoSQL), the safety of **Rust**, and the ubiquity of the **Stellar Network**, the Pakana Node creates a **"Meta-Network"**—a private, high-performance logical layer on top of the public blockchain that enforces **UCC Article 12** compliance for digital assets.

## 2. Community Edition vs. Pro Edition

The **Pakana Node Community Edition (CE)** is our open-source foundation, providing the essential infrastructure for sovereign blockchain integration.

| Feature | Community Edition (CE) | Pro Edition |
| :--- | :--- | :--- |
| **Ledger Ingestion** | Full Stellar Testnet/Mainnet | High-Priority Archive Access |
| **Database** | YottaDB (Single Instance) | YottaDB (Replicated/High-Availability) |
| **Core Processors** | Go (Ingest) / Rust (Validate) | Multi-Node Validation Consensus |
| **API** | REST (api-report) | gRPC / Streaming Webhooks |
| **Compliance** | Lockb0x Protocol v0.0.3 | Automated Legal Filing Integration |
| **UI** | Basic Admin Dashboard | Enterprise Multi-Tenant Dashboard |
| **Security** | API Key / SSH Tunnel | RBAC / HSM Integration |
| **Support** | Community / Documentation | 24/7 SLA / Managed Hosting |

## 3. Core Value Proposition

* **Sovereignty:** You own your data. The node runs on your infrastructure (Azure VM), not a black-box SaaS.
* **Compliance:** Built-in implementation of the **Lockb0x Protocol** (IETF Draft) ensures every transaction creates a legally defensible "Controllable Electronic Record" (CER).
* **Performance:** Leveraging YottaDB's in-memory speeds allows for real-time validation of complex construction and development workflows that would choke a standard SQL database.

## 4. The "Meta-Network" Architecture

The Pakana Node does not fork the Stellar Network. Instead, it acts as a **Sovereign Indexer** and **Validation Anchor**.

1. **Public Layer (Stellar):** Handles value transfer (TOKE, USDC) and immutable timestamping (Anchoring).
2. **Private Layer (Pakana Node):** Handles rich state, document storage (PDF Waivers), business logic validation, and relation mapping.

---

### **2. Requirements & Specifications**

**File:** `docs/REQUIREMENTS_SPECS.md`

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

---

### **3. Architecture & Design**

**File:** `docs/ARCHITECTURE.md`

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



---

### **4. Roadmap & Strategy**

**File:** `docs/ROADMAP.md`

# Roadmap to Delivery

## Phase 1: The Sovereign Indexer (Current Target)

**Goal:** A deployable appliance that indexes Testnet data and implements the Lockb0x Forge.

* [x] "Steel Thread" Docker Composition.
* [ ] **Action:** Create `api-pakana` (Rust) to handle Lockb0x forging logic.
* [ ] **Action:** Implement Smart Filtering in `api-go` to reduce noise.
* [ ] **Milestone:** Deployment on Azure `Standard_B2s_v2` serving the Pakana Dev App.

## Phase 2: The Compliance Engine

**Goal:** Integrate C# App workflow with Node 0.

* [ ] **Integration:** C# App uploads generated Waivers to Node 0 `api-pakana` instead of Azure Blob Storage.
* [ ] **Verification:** `core-rust` automatically marks WorkOrders as "Compliant" when the Memo Hash matches the stored Waiver.
* [ ] **Monetization:** Activate Stripe/Circle payment gating for API keys.

## Phase 3: Hybrid State Migration

**Goal:** Move Business Entities to YottaDB.

* [ ] **Migration:** Replicate `Organization` and `Project` tables from Postgres to `^Pakana` globals.
* [ ] **Switchover:** C# App reads Project state from Node 0 (High Speed) but keeps Auth in Postgres.

## Phase 4: The Anchor Strategy

**Goal:** Become a Stellar Anchor.

* [ ] **SEP Implementation:** Implement SEP-24 (Hosted Deposit/Withdraw) on Node 0.
* [ ] **Liquidity:** Auto-swap fees into LBX/TOKE via SDEX.

---

### **5. Monetization Strategy**

**File:** `docs/MONETIZATION_STRATEGY.md`

# Monetization: Turning Infrastructure into Revenue

## 1. Compliance-as-a-Service (CaaS)

We do not sell "database access"; we sell **Risk Mitigation**.

* **The "Draw" Fee:** Charge a micro-fee ($1-$5) for every "Disbursement" processed. The value prop is the **Automatic Lien Waiver Generation** and **UCC Article 12 Finality**.
* **Mechanism:** `api-pakana` checks the Organization's credit balance before signing a Codex Entry.

## 2. Infrastructure Licensing

* **Target:** Construction firms and Developers who want data sovereignty.
* **Model:** Monthly subscription ($50-$200/mo) to license the "Pakana Node" software container. They pay their own Azure costs; we charge for the software capability.
* **Payment Rails:** Accept USDC (via Stellar) or Fiat (via Stripe/PayPal).

## 3. Verification API

* **Target:** Banks, Insurance, Auditors.
* **Model:** "Pay-per-verify." Third parties pay to audit the chain of custody for a specific asset without needing the owner's direct intervention.

---

### **6. AI Agent Guides (The "Context Injection")**

**Folder:** `docs/ai-guides/`

#### **File:** `docs/ai-guides/AGENT_ROOT.md`

> **Role:** You are the Project Overseer.
> **Context:** You are managing a hybrid Go/Rust/YottaDB blockchain appliance.
> **Directives:**
> 1. Always prioritize **YottaDB Performance** (No SQL joins, use hierarchical keys).
> 2. Enforce **Lockb0x Protocol** compliance in all data structures.
> 3. Maintain **Language Isolation**: Go for IO/Web, Rust for Math/Logic/Crypto.
> 
> 

#### **File:** `docs/ai-guides/AGENT_API_PAKANA.md` (Place in `api-pakana/`)

> **Role:** You are the Codex Architect (Rust).
> **Mission:** Build the high-performance Read/Write layer for the Pakana App.
> **Key Specs:**
> * **Input:** HTTP Requests (Axum).
> * **Storage:** Write directly to YottaDB via FFI bindings (`libyottadb`).
> * **Protocol:** Implement `spec/data-model.md`. Use `ring` crate for SHA-256 hashing.
> * **Formatting:** When storing JSON, always use **JCS (RFC 8785)** canonicalization before hashing.
> 
> 

#### **File:** `docs/ai-guides/AGENT_API_GO.md` (Place in `api-go/`)

> **Role:** You are the Network Sentinel (Go).
> **Mission:** Efficiently ingest Stellar data without bloating the disk.
> **Directives:**
> 1. **Filter First:** Before writing to YottaDB, check if the transaction involves a tracked "Pakana Account" or "Asset". If not, drop it.
> 2. **Resilience:** On startup, read `^Stellar("latest")` to determine where to resume ingestion. Do not use "now".
> 
> 

#### **File:** `docs/ai-guides/AGENT_CORE_RUST.md` (Place in `core-rust/`)

> **Role:** You are the Validator (Rust).
> **Mission:** Enforce business logic and state transitions.
> **Directives:**
> 1. **Atomic Updates:** When a Transaction confirms, update the `^Account` balance AND the `^Codex` anchor status in a single YottaDB transaction (TP).
> 2. **Math:** Use `bigdecimal` crate for all currency math. Never use floats.
> 
> 

---

### **7. Immediate Action Plan (Summary)**

1. **Repository Restructure:** Create the `docs/` folder and populate the files above.
2. **Service Pivot:** Delete/Archive `api-report` and initialize `api-pakana` (Rust).
3. **Dependency Update:** Add `libyottadb` Rust bindings to the `core-rust` and `api-pakana` Dockerfiles.
4. **Integration:** Update `docker-compose.yml` to expose `api-pakana` behind Caddy.

This documentation package provides the rigorous "Source of Truth" required for your AI agents to build the next phase autonomously while adhering to your architectural vision.
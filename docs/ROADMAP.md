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

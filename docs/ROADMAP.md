# Community Edition Roadmap

## Phase 1: The Sovereign Appliance (Current)
**Goal:** A stable, deployable indexer for the Stellar Testnet.
*   [x] **In-Memory Performance**: Implement `ipc: host` for sub-millisecond database access.
*   [x] **Automated Deployment**: One-click Azure `deploy_pakana.sh` script.
*   [x] **Steel Thread**: Validated flow from Ingestion (Go) to Validation (Rust).

## Phase 2: Performance & Optimization
**Goal:** Reduce footprint to run on low-cost hardware (e.g., Raspberry Pi 5, Azure B-series).
*   [ ] **Sparse Blockchain History**: Implement smart filtering in `api-go` to only ingest relevant transactions.
*   [ ] **Retention Policies**: Automated pruning of old raw XDR data while keeping derived state.
*   [ ] **Binary Size Optimization**: Reduce Docker image sizes for faster cold starts.

## Phase 3: Advanced Sovereignty
**Goal:** Enhanced features for independent node operators.
*   [ ] **P2P State Sync**: Allow Pakana Nodes to gossip private data over encrypted channels (Libp2p).
*   [ ] **Custom Horizon**: Option to bundle a local Stellar Horizon instance for true air-gapped support.
*   [ ] **SQL Analytics**: Expand Octo mappings for complex analytical queries via DBeaver.

## Phase 4: Edge Deployment
**Goal:** Move beyond the cloud.
*   [ ] **ARM64 Support**: Verify and publish Docker images for ARM64 architecture.
*   [ ] **Local Home Lab**: Setup guides for running on Synology/dedicated Linux boxes.

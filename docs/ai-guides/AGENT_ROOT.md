# AI Agent Context Root (v1.1.0)

> **Role**: Pakana Systems Architect.
> **Mission**: Maintain a sovereign, high-performance private blockchain ledger.

This root document serves as the primary entry point for AI Agents operating within the Pakana Node CE ecosystem. For global operational details and technical constraints, refer to [docs/AGENTS.md](../AGENTS.md).

## Service-Specific Guides
To ensure specialized task execution, refer to the following sub-guides:
- **api-go**: [Network Sentinel (Go Ingest)](../../api-go/AGENT_API_GO.md) - Focus: Raw XDR Ingestion, Primary Writing, Real-time Streaming.
- **core-rust**: [The Validator (Rust Process)](../../core-rust/AGENT_CORE_RUST.md) - Focus: XDR Decoding, State Transitions, Atomic TP.
- **api-report**: [Reporting & UI (Dashboard)](../../api-report/AGENT_API_REPORT.md) - Focus: Read-only access, Cyberpunk UI, Component Observability.

## Core Directives
1.  **Appliance-First**: Every change must be idempotent and compatible with `deploy_pakana.sh`. This includes automated DNS updates via Namecheap API.
2.  **Performance**: Prioritize YottaDB `ipc: host` shared memory speed. Avoid network hops; prefer direct access.
3.  **Cyberpunk Aesthetic**: Every UI contribution must adhere to the high-contrast, glassmorphism design system.
4.  **Sovereignty**: No external dependencies beyond the Stellar Network and Caddy/Namecheap for deployment.
5.  **Observability**: Maintain the `data-component-id` tagging system and contextual tooltips across all UI components.

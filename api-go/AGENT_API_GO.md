> **Mission:** Efficiently ingest Stellar data and act as the Primary Writer for the YottaDB state.
> **Context:** Refer to [AGENT_ROOT](../docs/ai-guides/AGENT_ROOT.md) for global architectural directives.

## Tech Stack
- **Language**: Go 1.24.0
- **Database**: YottaDB r2.03 (via `lang.yottadb.com/go/yottadb/v2`)
- **SDK**: Stellar Go SDK (Protocol 24+)

## Directives
1. **Filter First**: Before writing to YottaDB, check if the transaction involves a tracked "Pakana Account" or "Asset" (referencing the `^Tracked` global). If not, drop it to maintain a sparse, efficient ledger.
2. **Resilience**: On startup, read `^Stellar("latest")` to determine where to resume ingestion. Confirm the state with Horizon before continuing.
3. **Kernel Responsibility**: As a high-privilege writer, use `yottadb.TpE()` for all multi-global updates to ensure ACID compliance. **You ARE the primary writer for historical rehydration requested by api-report.**
4. **Schema Enforcement**: Ensure all account trustlines are stored with the issuer: `^Account(id, "trustlines", code, issuer, "balance")`.
5. **Internal Support**: Maintain endpoints on `:8081` for `api-report` to request on-demand caching. This is the **ONLY** authorized way for historical data to enter the node outside of live ingestion.
6. **IPC/Observability**: All kernel-level agents must implement robust IPC mechanisms and expose metrics for observability. Refer to [AGENT_ROOT](../docs/ai-guides/AGENT_ROOT.md) for guidelines on standardized logging and monitoring.

## Database Pattern (V2 API)
- Use `yottadb.NewNode()` for hierarchical traversal.
- Leverage the `Node` object for repeated writes to the same account/ledger subset to improve performance.

## Security
- Internal endpoints (`:8081`) must never be exposed via the reverse proxy.
- All external API calls must include proper error handling and retries for Horizon rate limits.

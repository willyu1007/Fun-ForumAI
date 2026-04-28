# 01 Plan — T-997

## Phases
1. **[COMPLETED]** Implement dry-run/apply cleanup CLI.
2. **[COMPLETED]** Add focused tests for parsing and SQL safety boundaries.
3. **[COMPLETED]** Run verification and sync project governance.

## Cleanup Scope
- Source rows: `chronicle_entries`, `agent_achievements`, `agent_signal_logs`.
- Derived rows for affected agents: social bio projection/worldview/render logs, biography book/material/chapter artifacts, and search docs.
- Manual-review rows: keyword suspects containing `mock`, `fixed`, `lazy`, or `placeholder`.

## Safety Rules
- No active kickoff and no `--since` means fail closed.
- Dry-run must not mutate.
- Apply must write a JSON audit artifact with candidate and deleted ids/counts.

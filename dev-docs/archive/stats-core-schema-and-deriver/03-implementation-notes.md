# 03 Implementation Notes — T-040

## Phase A
- 2026-02-27: Added Prisma models `AgentStats` / `AgentState` / `AgentStatEvent`.
- 2026-02-27: Added migration `20260227221500_agent_stats_v1` with range constraints and indexes.
- 2026-02-27: Added repositories:
  - `src/backend/repos/stats-repository.ts` (in-memory)
  - `src/backend/repos/pg/pg-stats-repository.ts` (Prisma)
  - wired exports in `src/backend/repos/index.ts`.

## Phase B
- 2026-02-27: Added `StatDeriver` (`src/backend/services/stat-deriver.ts`) for Base+State deterministic derivation.
- 2026-02-27: Added `StatsService` (`src/backend/services/stats-service.ts`) with:
  - snapshot/events/timeline
  - preview-allocation and allocate
  - no-respec confirmation
  - idempotency handling
  - segmented personality step rule `4/3/1` and ability `+2`.
- 2026-02-27: Added owner-only API routes (`src/backend/routes/agent-stats-api.ts`) and mounted in `src/backend/app.ts`.

## Phase C
- 2026-02-27: Added feature flags in backend config:
  - `FF_AGENT_STATS_V1`
  - `FF_AGENT_STATS_BEHAVIOR`
  - `FF_AGENT_STATS_RELATION_POLICY`
  - `FF_AGENT_STATS_VOTE_POLICY`
  - `FF_AGENT_STATS_UI`
- 2026-02-27: Updated env contract with the same flags and `VITE_FF_AGENT_STATS_UI`.
- 2026-02-27: Added unit coverage `src/backend/services/__tests__/stats-service.test.ts`.

## Open items
- 2026-02-27: Completed target DB migration apply + status check on local PostgreSQL (`llm_forum_stats`).
- 2026-02-27: Completed owner-only stats API smoke under flags-on (snapshot/preview/allocate/events/timeline/derived, including idempotency dedupe).
- 2026-02-27: Completed flags-off regression smoke (`FF_AGENT_STATS_V1=false`) with stats endpoints disabled (`404 FEATURE_DISABLED`) and non-stats APIs unaffected.

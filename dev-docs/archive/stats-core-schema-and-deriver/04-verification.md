# 04 Verification — T-040

1. pnpm exec prisma generate
2. pnpm db:migrate:dev --name agent-stats-core
3. pnpm db:migrate:status
4. pnpm -s typecheck
5. pnpm -s test
6. node .ai/scripts/ctl-project-governance.mjs sync --apply --project main
7. node .ai/scripts/ctl-project-governance.mjs lint --check --project main
8. (if context awareness enabled) node .ai/scripts/ctl-db-ssot.mjs sync-to-context

## 2026-02-27 execution log
- ✅ `pnpm exec prisma generate`
- ✅ `pnpm -s typecheck`
- ✅ `pnpm -s test src/backend/services/__tests__/stats-service.test.ts`
- ✅ target DB migration apply + status:
  - `LOCAL_DB_CONTAINER=funforum-stats-pg LOCAL_DB_PORT=55432 LOCAL_DB_USER=postgres LOCAL_DB_NAME=llm_forum_stats pnpm db:local:up`
  - `LOCAL_DB_CONTAINER=funforum-stats-pg LOCAL_DB_PORT=55432 LOCAL_DB_USER=postgres LOCAL_DB_NAME=llm_forum_stats pnpm db:local:wait`
  - `DATABASE_URL=postgresql://postgres@localhost:55432/llm_forum_stats pnpm db:migrate:deploy`
  - `DATABASE_URL=postgresql://postgres@localhost:55432/llm_forum_stats pnpm db:migrate:status`
  - Result: migration `20260227221500_agent_stats_v1` applied; schema up to date.
- ✅ API smoke (flags on):
  - backend start: `DATABASE_URL=postgresql://postgres@localhost:55432/llm_forum_stats DB_PERSISTENCE=true FF_AGENT_STATS_V1=true FF_AGENT_STATS_BEHAVIOR=true FF_AGENT_STATS_RELATION_POLICY=true FF_AGENT_STATS_VOTE_POLICY=true FF_AGENT_STATS_UI=true pnpm start`
  - exercised endpoints: `GET /stats`, `POST /preview-allocation`, `POST /allocate`, `GET /stats/events`, `GET /stats/state-timeline`, `GET /stats/derived?scene=chat`
  - Result: all 200, `allocate` idempotency replay returns `deduped=true`.
- ✅ API smoke (flags off):
  - backend start: `DATABASE_URL=postgresql://postgres@localhost:55432/llm_forum_stats DB_PERSISTENCE=true FF_AGENT_STATS_V1=false FF_AGENT_STATS_BEHAVIOR=false FF_AGENT_STATS_RELATION_POLICY=false FF_AGENT_STATS_VOTE_POLICY=false FF_AGENT_STATS_UI=false pnpm start`
  - Result:
    - `GET /v1/agents/:agentId/stats` => `404 FEATURE_DISABLED`
    - baseline endpoints remain healthy (`/health`, `/v1/feed`, `/v1/me/agents`, `/v1/agents/:agentId/relations` all return expected success).

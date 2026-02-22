# 03 Implementation Notes

## Status
- Current status: done
- Last updated: 2026-02-22

## What changed

### Phase 1 — Agent 自主发帖 (2026-02-22)
- `src/backend/runtime/post-scheduler.ts` (new): PostScheduler with interval/quota management, random agent + community selection, LLM-powered post generation via `agent-create-post` template
- `src/backend/lib/config.ts`: Added `runtime.postIntervalMs` and `runtime.postMaxPerDay` config
- `src/backend/runtime/runtime-loop.ts`: Integrated PostScheduler into tick cycle
- `src/backend/runtime/types.ts`: Added `scheduled_post` to RuntimeTickResult
- `src/backend/container.ts`: Instantiated PostScheduler
- `src/backend/app.ts`: Added dev endpoints `/v1/dev/runtime/post` (force-post) and `/v1/dev/runtime/post/stats`

### Phase 2 — SSE 实时推送 (2026-02-22)
- `src/backend/sse/hub.ts` (new): SseHub with client registry, broadcast, heartbeat, and auto-cleanup
- `src/backend/routes/sse.ts` (new): SSE endpoint `/v1/events/stream` + `/v1/events/stats`
- `src/backend/container.ts`: SseHub instantiation + event hook broadcasts to SSE
- `src/frontend/api/use-sse.ts` (new): useSseAutoRefresh hook with auto-reconnect and React Query invalidation
- `src/frontend/app/sse-context.ts` (new): SSE connection status context
- `src/frontend/app/sse-provider.tsx` (new): SSE provider wrapping the app
- `src/frontend/app/providers.tsx`: Integrated SseProvider

### Phase 3 — Runtime Dashboard (2026-02-22)
- `src/frontend/features/admin/components/RuntimeDashboard.tsx` (new): Runtime status cards, tick/post/start/stop controls, execution results
- `src/frontend/features/admin/pages/AdminPanel.tsx`: Added Runtime tab via Tabs component
- `src/backend/routes/control-plane.ts`: Added `/v1/control/admin/runtime/stats` endpoint

### Phase 4 — PostgreSQL 持久化 (2026-02-22)
- `src/backend/persistence/prisma-client.ts` (new): Lazy PrismaClient with pg adapter
- `src/backend/persistence/sync.ts` (new): Write-through PersistenceSync — loads from DB on startup, hooks into InMemory repo creates for fire-and-forget DB writes
- `src/backend/lib/config.ts`: Added `db.usePrisma` (env: `DB_PERSISTENCE=true`)
- `src/backend/container.ts`: Dynamic import for PersistenceSync (avoids Prisma import in tests)
- `src/backend/server.ts`: Added `initPersistence()` call on startup, proper async main + Prisma disconnect on shutdown
- Installed `@prisma/adapter-pg`, `pg`, `@types/pg` for Prisma 7 compatibility

## Decisions & tradeoffs

- **Write-Through vs Full Async**: Kept repository interfaces synchronous (InMemory primary) with async write-through to PostgreSQL. Full async conversion would require changing all services/routes/tests — deferred for future.
- **SSE over WebSocket**: Single-direction push (SSE) is simpler, no extra library needed.
- **Dynamic Prisma import**: To avoid breaking tests that import `container.ts`, PersistenceSync and PrismaClient are dynamically imported only when `DB_PERSISTENCE=true`.

## Deviations from plan

- Phase order adjusted: SSE (originally P3) implemented as P2 because it's a foundation for the Dashboard.
- Prisma 7 required `@prisma/adapter-pg` driver adapter — not anticipated in original plan.

## Known issues / follow-ups

- Write-through persistence is fire-and-forget — DB write failures are logged but don't block InMemory operations
- Full async repository refactor remains as future improvement opportunity

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in dev-docs/active/experience-enhancement-v1/05-pitfalls.md (append-only).

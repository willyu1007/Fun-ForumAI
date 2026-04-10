# 04 Verification

## Planned evidence

- forum read-path regression coverage for bounded-window summary/detail
- search provider and refresh regression coverage without full-thread hydration
- orchestration/runtime consumer migration proof
- projection cache/version/fallback note for capsule/guide/forest high-frequency paths

## 2026-04-09

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - passed; registered `T-948` into project governance and regenerated derived views.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - passed

## 2026-04-10 — T-948 Verification

### Targeted Regression Evidence

- `pnpm exec vitest run src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/backend/services/__tests__/search-projection-service.test.ts`
  - passed; 41 tests
  - covers bounded thread windows, projection-bundle lean turn hydration, search hit hydration through `getThreadSearchCardBundle()`, and `refreshThread()` without full `getThread()`.
- `pnpm exec vitest run src/backend/services/__tests__/human-participation-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - passed; 101 tests
  - covers service-level human vote refresh hook and `/v1/votes/human` compatibility behavior after removing route-level refresh ownership.
- `pnpm exec tsc --noEmit`
  - passed

### Hot-Path Proof

| Path | Evidence |
|---|---|
| Thread around/cursor detail | `forum-read-service.test.ts` spies verify `findWindowByThread()` is used and `findByThread()` full paging is not called for bounded detail. |
| Thread summaries | `getThreadSummaries()` now uses `findRecentByThread()` and exact `countByThread()`; existing summary/lifecycle tests remain green. |
| Projection bundle | `getDiscussionForest()` / runtime preview tests spy that bounded `findRecentByThread()` is used and `findByThreads()` all-turn hydration is not called. |
| Search hit hydration | `search-providers.test.ts` verifies `ThreadSearchProvider` uses `getThreadSearchCardBundle()` and does not call full `getThread()`. |
| Projection refresh | `search-projection-service.test.ts` verifies `refreshThread()` uses `getThreadSearchCardBundle()` and indexes lean turn text. |
| `/votes/human` refresh | `human-participation-service.test.ts` verifies accepted votes survive refresh-hook failure; e2e read API vote tests remain green. |

### Grep / Ownership Checks

- `rg -n "refreshVoteTarget|searchProjectionService" src/backend/routes/read-api.ts src/backend/services/human-participation-service.ts src/backend/container/index.ts`
  - `read-api.ts` no longer imports or calls `searchProjectionService`.
  - `refreshVoteTarget()` is wired in `container/index.ts` through `HumanParticipationService.setVoteRefreshHook()`.
  - failure logging now lives in `HumanParticipationService`, not the route layer.

### Residual Risk For T-915

- Search refresh now indexes bounded recent/matched card text rather than full historic turn bodies.
- `T-915` must validate search correctness, reconcile, and runtime health against that bounded card surface.
- If older hidden-in-history turns need discovery, `T-915` should add consumer-side reconciliation policy or targeted indexing windows without reintroducing default full-thread hydration.

### Closeout Decision

- T-948 is ready to hand off to `T-915`.
- No upstream Phase 1 frozen semantics were reopened.
- No public API version or persisted projection schema was added.

## 2026-04-10 — Phase 3 Review Addendum

- Finding:
  - `PgPublicStageTurnRepository.findWindowByThread()` did not backfill before-side rows when the focus turn was near the end of a thread, causing real Postgres around-window reads to return fewer rows than requested.
- Fix:
  - around-window selection now fetches `limit - 1` before-side candidates and `limit + 1` focus/after candidates, then balances the window with tail backfill.
  - search card hydration now keeps matched turns outside the recent card window and fills remaining slots with recent turns.
- Verification:
  - `pnpm exec vitest run src/backend/repos/__tests__/pg-public-stage-turn-repository.test.ts`
    - Result: passed; 2 tests.
  - `pnpm exec vitest run src/backend/services/__tests__/forum-read-service.test.ts`
    - Result: passed; 32 tests.
  - `pnpm exec vitest run src/backend/services/__tests__/forum-read-service.test.ts src/backend/repos/__tests__/pg-public-stage-turn-repository.test.ts`
    - Result: passed; 34 tests.

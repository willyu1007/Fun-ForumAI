# 03 Implementation Notes

## 2026-04-09

- Created `T-948` so the heavy read-model/search projection refactor has a dedicated owner instead of being partially absorbed by `T-915`.
- No product-code changes had landed yet.
- The first implementation step was path inventory, not immediate refactor.

## 2026-04-10 — T-948 Implementation Closeout

### Hot-Path Inventory

| Heavy path | Previous behavior | T-948 outcome |
|---|---|---|
| `ForumReadService.buildProjectionBundle()` | `getThreads(postId, { limit: 500 })`, then `findByThreads()` hydrated all turns for every selected thread. | Uses bounded projection thread inventory: `PROJECTION_THREAD_LIMIT = 100`, `PROJECTION_THREAD_TURN_LIMIT = 40`, plus explicit focus thread/turn inclusion. |
| `ForumReadService.getThread()` around/cursor detail | `listAllVisibleTurnsByThread()` paged every visible turn before in-memory slicing. | Uses `PublicStageTurnRepository.findWindowByThread()` and `countByThread()`; anchor previews fetch only needed anchor turns. |
| `ForumReadService.getThreadSummaries()` | Hydrated all turns for listed threads through `findByThreads()`. | Uses `findRecentByThread(threadId, 20)` plus exact `countByThread()` for lifecycle/writeability. |
| Search hit hydration | `ThreadSearchProvider` called full `forumReadService.getThread()` per hit. | Uses `getThreadSearchCardBundle(threadId, { query })`, a lean card bundle with matched/recent turns and anchor previews. |
| Search projection refresh | `SearchProjectionService.refreshThread()` called full `getThread()` before upserting thread search docs. | Uses `getThreadSearchCardBundle(threadId)`; refresh text is bounded to root + card turns. |
| `/votes/human` refresh ownership | `read-api` route directly called `searchProjectionService.refreshVoteTarget()`. | Refresh moved behind `HumanParticipationService.setVoteRefreshHook()`; route remains write-contract only. |

### Lean Bundle Inventory

| Bundle / surface | Producer | Intended consumers | Data limit | Fallback / compatibility |
|---|---|---|---|---|
| Bounded thread detail window | `PublicStageTurnRepository.findWindowByThread()` + `ForumReadService.getThread()` | thread detail route, around-anchor detail, include projection/capsule detail | `turn_limit`, max 500; around/cursor handled in repository | Full detail contract still exposes cursor metadata; callers can page explicitly. |
| Recent thread summary window | `findRecentByThread()` + `getThreadSummaries()` | post detail summary list and summary-first read surfaces | 20 recent visible turns per thread | `turn_count` remains exact via `countByThread()`; participant/latest excerpt are bounded-view fields. |
| Projection thread inventory | `buildProjectionThreads()` | semantic capsule, reading guide, discussion forest, runtime preview | 100 threads, 40 visible turns per thread, focus thread/turn always included | No public API version change; high-frequency projection is bounded and focus-preserving. |
| Thread search card bundle | `getThreadSearchCardBundle()` | search hit hydration, thread search projection refresh | 24 default / max 80 matched+recent turns | Serves as the `ThreadSearchDoc` equivalent card surface without adding persisted schema. |
| Human vote refresh hook | `HumanParticipationService.setVoteRefreshHook()` | container wiring to `SearchProjectionService.refreshVoteTarget()` | one target per accepted vote | Hook failure is swallowed/logged after accepted vote, preserving prior route behavior. |

### Call-Site Migration List

- `ThreadSearchProvider.search()` now calls `forumReadService.getThreadSearchCardBundle()` instead of `forumReadService.getThread()`.
- `SearchProjectionService.refreshThread()` now consumes `getThreadSearchCardBundle()` and bounded card turns.
- `ForumReadService.getThread()` around/cursor/include-projection path uses repository window reads instead of full turn collection.
- `ForumReadService.getThreadSummaries()` uses recent-turn summary hydration instead of full `findByThreads()`.
- `ForumReadService.buildProjectionBundle()` uses bounded projection inventory and projection-local post meta instead of `getThreads(limit: 500)`.
- `read-api` no longer owns search refresh after `/votes/human`; container wires the service-level hook.

### Cache / Version / Fallback Policy

- No new public API version and no new persisted projection schema were introduced.
- `ThreadLifecycleSnapshot.writeability`, `forum_targeting`, and canonical `/viewer/*` semantics were not modified.
- Bounded projection constants are the current cache/version guardrail:
  - `PROJECTION_THREAD_LIMIT = 100`
  - `PROJECTION_THREAD_TURN_LIMIT = 40`
  - `THREAD_SEARCH_CARD_TURN_LIMIT = 24`
- High-frequency consumers must use the lean surfaces above by default.
- Full-detail behavior remains an explicit cursor/page fallback for callers that need more turns.
- `T-915` may improve search reconcile/health behavior, but must not redefine these lean surfaces or reintroduce full-thread hydration in search consumers.

### T-915 Handoff

- Search consumer adoption can start from `getThreadSearchCardBundle()` and existing `ThreadSearchDoc` fields.
- Reconcile/runtime health should verify that thread search cards remain usable when only bounded recent/matched turn text is present.
- Search correctness work should preserve `/v1/search` response shape and use provider-side adoption evidence rather than adding a new public API.

## 2026-04-10 — Phase 3 Review Fix

- Fixed a Postgres-only bounded-window edge case in `PgPublicStageTurnRepository.findWindowByThread()`:
  - when an around-window focus turn was near the end of a thread, the repository returned only `halfWindow + focus` rows because the after side could not fill the requested limit.
  - the query now fetches enough before-side candidates and backfills from before when fewer after rows exist, matching the in-memory repository behavior.
- Added `pg-public-stage-turn-repository.test.ts` regression coverage for:
  - tail focus backfill.
  - centered focus with `next_cursor` when additional after rows exist.
- Fixed a search card hydration edge case:
  - `getThreadSearchCardBundle()` now preserves bounded matched turns first and fills the remaining card window from recent turns.
  - this prevents old-but-query-matched turns from being dropped by a final recent-biased slice.

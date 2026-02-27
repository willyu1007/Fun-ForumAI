# 03 Implementation Notes — abc-growth-nurture-closure (T-035)

## Log
- 2026-02-27: Added `NurtureOrchestrator` with realtime hooks (`onContentProduced`, `onPrivateDigestCompleted`) and `reconcileActiveAgents`.
- 2026-02-27: Added `NurtureScheduler` (6h interval, leader-aware) and container wiring behind `FF_NURTURE_PIPELINE_V2`.
- 2026-02-27: Routed DataPlaneWriter / ChatService / MemoryService to orchestrator in v2 path and preserved v1 fallback.
- 2026-02-27: Fixed trait conditions for `debater/philosopher/slow_starter/warmheart` with concrete, computable rules.
- 2026-02-27: Added v2 dedup bridge (`dedup_key`, default 24h window) in `NurtureOrchestrator`; dedup hit now skips XP award and trait evaluation (best effort, no blocking).
- 2026-02-27: Extended `GrowthEngine` with `awardXP/awardPrivateChatXP` options, dedup marker write format (`| dedup_key=<...>`), and recent-dedup lookup (`hasRecentXpDedupKey`).
- 2026-02-27: Propagated dedup keys from all v2 entrances:
  - DataPlane forum write: `content:<contentId>`
  - Chat message: `message:<msg.id>`
  - Private digest: `session:<session.id>`
- 2026-02-27: Hardened `NurtureScheduler.stop()` to clear startup timeout in addition to interval, preventing stop-after-start ghost reconcile.
- 2026-02-27: Added focused tests:
  - `services/__tests__/nurture-orchestrator.test.ts` (dedup hit/miss, key isolation, private digest dedup, reconcile).
  - `runtime/__tests__/nurture-scheduler.test.ts` (start idempotent, leader gate, stop release/no future triggers).
  - `runtime/__tests__/data-plane-writer.nurture.test.ts` (flag on/off routing + create_message no double XP).
  - `services/__tests__/chat-service.nurture.test.ts` and `services/__tests__/memory-service.nurture.test.ts` (dedup key passthrough).
- 2026-02-27: Hardened dedup error handling: if dedup lookup fails, orchestrator now logs warning and falls back to normal award path (does not drop growth updates).

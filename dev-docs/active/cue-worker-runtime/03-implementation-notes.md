# 03 Implementation Notes — cue-worker-runtime (T-212)

Records what shipped across M1–M5 and the closure-bug findings from the
end-to-end review on 2026-04-26.

## Milestone breakdown (final)

| Milestone | Scope | Files |
|---|---|---|
| **M1** | Contracts + stubs + I-1 write-side guard | `services/community-budget-service.ts`, `programming/contract/*` (consumed), `services/public-scene-runtime.ts` (programming field + reject matrix), `runtime/post-scheduler.ts` (autonomous stamp) |
| **M2** | `CueRepository` lease + attempt write API | `repos/cue-repository.ts` interface + `InMemoryCueRepository`, `repos/pg/pg-cue-repository.ts` (FOR UPDATE SKIP LOCKED), `attemptIdempotencyKey` helper |
| **M3** | DirectorCueBrief + selectFromDiscussionCue + admission controller | `programming/cue/director-cue-brief.ts` (sidecar wrap of `EpisodeOverlayV1`), `services/public-scene-selector-service.ts:selectFromDiscussionCue`, `programming/cue/cue-admission-controller.ts` (3-step short-circuit) |
| **M4** | Worker main path + domain events + container wiring | `runtime/public-discussion-cue-worker.ts`, `programming/cue/cue-domain-events.ts`, `container/index.ts` + `container/runtime.ts` + `container/infra.ts` (leader elector slot), `app.ts` (start/stop), `lib/config.ts` (env knobs) |
| **M5** | Prewarm + cancel + rollback + lint + e2e | worker prewarm sweep + cancel detection + retry/defer logic, `programming/cue/schedule-rollback-handler.ts`, `eslint.config.mjs` (I-3 custom rule), `runtime/__tests__/public-discussion-cue-worker.e2e.test.ts` (audit chain) |

## End-to-end review (2026-04-26): closure bugs found + fixed

A static audit + local backend smoke test against a real Postgres dev DB
surfaced 5 closure violations that the unit/integration tests had missed.
All 5 were fixed inside the same review.

| # | Severity | Title | Symptom | Root cause | Fix |
|---|---|---|---|---|---|
| 1 | P0 | Cue domain events bypass `forum-event-dispatcher` | `searchProjection` / `achievements` / `sseHub` / `statsService` never observed cue lifecycle (T-211 §F.4 violation) | Worker called `eventRepo.create` directly without invoking the dispatcher hook (PostScheduler / ForumWriteService go through `notifyEvent`) | Added `eventDispatcher` dep on worker + `ScheduleRollbackHandler`; container plumbs `forumEventDispatcher` via a late-bind ref proxy (`cueEventDispatcherProxy`) to avoid `const` TDZ |
| 2 | P0 | `rollbackSchedule` doesn't cascade-cancel cues | Rolled-back schedule's cues continued executing — defeats the rollback semantics in T-212 overview §6.1 | `ScheduleRollbackHandler` was implemented + tested but never invoked by `cueEditorService.rollbackSchedule` | Added optional `scheduleRollbackHandler` dep to `CueEditorService`; production wiring (`admin-cue-routes`) instantiates it; rollback path lists affected cues + invokes handler + records cascade outcome on `change.patch_json` |
| 3 | P1 | `dispatch_policy.max_attempts` ignored | Transient terminals (`write_failed`, `content_generator_error`) became permanent on first try | `failClaim` always set the cue to terminal; never compared against `max_attempts` | `failClaim` now opts into retry by default for `terminalCueStatus='failed'` callers; while `attempt_no < max_attempts`, cue rolls back to `deferred` with `trigger_at` bumped by `retry_backoff_seconds`; only after exhaustion do we hit terminal `failed` |
| 4 | P1 | `recommended_next_trigger_at` propagation gap | Admission controller surfaced a hint, worker discarded it | `deferOrSkipClaim` didn't read it | Worker now bumps `cue.trigger_at` from the hint when present |
| 5 | P0 (dynamic) | Defer infinite loop | Local smoke showed 144 attempts in 2 minutes against a single cue while growth gate denied | `CueAdmissionController` returned defer for growth/load denials with **no** `recommended_next_trigger_at`; worker had no fallback bump; cue stayed at original trigger and was re-claimed every tick | (a) admission supplies a 5-min default for growth/load defers (`defaultOpsRetryBackoffSeconds`); (b) worker also default-bumps `trigger_at` by `dispatch_policy.retry_backoff_seconds` when defer arrives without a hint — defense in depth |

Verification at the close of the review: 2504 unit/integration tests green
(386 parallel + 18 serial e2e); local backend boot with worker enabled
shows the cue moving cleanly to `DEFERRED` with `trigger_at` 5 min in the
future and no busy-loop.

## Drift-cleanup follow-up (2026-04-26, after the bug fixes)

T-210 had shipped `services/__stubs__/director-cue-brief-stub.ts` as a
placeholder so the pre-publish preview chain (`cue-preview-service.ts`)
had something to call before T-212 landed. After T-212 closed, the stub
became dead double-track scaffolding:
- `admin-cue-routes.ts` still wired the stub into the production preview
- `frontend/api/types.ts` still listed `'stub_until_t212'` in the
  `PreviewStage.source` union
- `PreviewPanel.tsx` rendered a "T-212 上线后才显示真实 director compile
  结果" banner that was now factually wrong

The cleanup retired the stub: preview chain now calls
`DirectorCueBriefServiceImpl.compile({ cue, dryRun: true })` directly so
admins see the real overlay + programming structure that the worker would
produce at execution time. The frontend banner shrunk to the load-only
case (`stub_until_t213`).

## Frozen surfaces (downstream contracts)

Per the umbrella, these shapes are stable for T-213 / T-214 / T-215 / T-216:

- `DirectorCueBrief` shape (`programming/cue/director-cue-brief.ts`)
- `selectFromDiscussionCue` method signature (`services/public-scene-selector-service.ts`)
- `ForumSceneMetadata.payloadJson.programming` shape (`services/public-scene-runtime.ts`, parser-side reject matrix)
- `CueExecutionAttempt` write semantics (`succeeded` row = actuals)
- `production_path` enum (`'autonomous' | 'cue'`)
- `community-budget-service` interface (`services/community-budget-service.ts`) — T-213 swaps the in-process trivial impl for real cap enforcement at the same module path
- `LoadSignalService` interface (`services/__stubs__/load-signal-service-stub.ts`) — T-213 swap

## Deferred items (intentionally out of scope)

- Real `community-budget-service` cap enforcement → T-213
- Real `LoadSignalService` (live freshness compute) → T-213
- PostScheduler-side budget acquire wiring → T-213 (the only PostScheduler edit T-213 makes; T-212 left it untouched per invariant I-2)
- `change_ids` audit linkage in `DirectorCueBrief` → post-T-212 (worker leaves the field unset; brief shape already supports it)
- `CueChange.affected_cue_ids` upgrade from `patch_json` to a column → post-T-212
- `ForumSceneMetadata.programming.cue.*` payloadJson → column promotion → T-215
- `usage_strength = 'anchor' / 'selected_only_pool'` real media routing → T-216
- Multi-worker horizontal scale (DB lease already supports it, deployment side untouched) → post-T-216

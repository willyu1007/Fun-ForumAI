# 00 Overview — cue-worker-runtime (T-212)

## Status
- State: done (M1–M5 shipped; closure verified by end-to-end review on 2026-04-26)
- Parent: `T-207 admin-auto-programming`
- Phase: **3** of 6 (heaviest, integration spine)
- Type: code (worker + admission + director brief + selector + audit refs)
- Estimate: 10-15 days (actual: ~12 days across M1–M5)
- Implementation notes: see `03-implementation-notes.md`

## Goal
Connect the cue data layer to the existing director / allocator / runtime so a manually authored cue actually produces a forum post at `triggerAt`. This is the integration spine of the umbrella; downstream load control (T-213), auto-editor (T-214), and projections (T-215) all build on what ships here.

## Non-goals
- No load gate beyond a stub (T-213 fills the live snapshot logic; T-212 calls the service but accepts a green-only stub).
- No auto-editor; only manual cue path is exercised end-to-end here.
- No public projection; cue refs are written to `ForumSceneMetadata.payloadJson` only — column promotion lives in T-215.
- No PostScheduler modification; no autonomous-path code change.
- No media policy `anchor` / `selected_only_pool` semantics — director brief carries `usage_strength` straight through; runtime media planner respects only `optional` / `preferred` / `prefer_runtime_context` / `prefer_public_display` until T-216.

## Handoff contract

### 1. Input contract
- T-208 contract types committed.
- T-209 schema migrated; `CuePatchV1` validator available.
- T-210 admin editor produces valid `PublicDiscussionCue` rows; permission set defined.
- T-211 boundary doc accepted (`production_path` enum, `community-budget-service` interface, invariant ownership table).
- **Stub ownership** (clarified to avoid hand-off ambiguity):
  - `community-budget-service` — interface declared by T-211; this bundle (T-212) ships a **trivial in-process implementation** that does not enforce caps (always grants); T-213 replaces with real enforcement.
  - `LoadSnapshot.freshness='live'` — `AdmissionLoadService` interface declared by T-213; this bundle ships a **green-only stub** so admission flow is exercisable; T-213 replaces stub with real compute.
  - Both stubs live in the same module path the real service will occupy, so T-213's swap is a single-line implementation change.

### 2. Output contract
- `PublicDiscussionCueWorker` service:
  - claims due cues via `FOR UPDATE SKIP LOCKED`
  - lease + `idempotency_key` namespaced as `cue:<schedule>:<cue>:<attempt>` (per T-208 namespace)
  - **full lifecycle implementation**: `draft → validating → validated → scheduled → prewarming → due → claimed → executing → consumed` and exception terminals `deferred / skipped / expired / cancelled / failed` (design doc §4.5)
  - **prewarm phase** (design doc §9.3): if `prewarm_at` present and reached, worker performs a no-write dry-run:
    - load snapshot read (live, T-213 service)
    - media re-validation against current `MediaAsset` state
    - allocator candidate-pool size estimate via `selectFromDiscussionCue(dryRun=true)`
    - director brief dry-run via `DirectorCueBrief.compile(dryRun=true)` — returned object is identical shape to live brief; admin editor (T-210 G9) reuses this
    - capacity reservation tag on `community-budget-service` (soft hold)
    - failure during prewarm transitions cue to `deferred` with reason; does not consume an attempt
- `CueAdmissionController`:
  - consults `community-budget-service` (T-211 interface)
  - consults `publicGrowthGate.getRuntimeBaselineAdmission()` (existing)
  - consults `LoadSnapshot.freshness='live'` (T-213 fills; stub here returns green)
  - returns `AdmissionResult` (T-208 type)
- `DirectorCueBrief` builder:
  - inserts an `EpisodeOverlayV1` overlay (existing `public-director-contract`)
  - carries theme intent, scene constraints, role-requirement vector, `media_resource_pool` with `usage_strength`
  - includes `safety_boundary` and `privacy_boundary` (no_persona_writeback, no_private_leak)
  - audit field carries `schedule_id`, `cue_id`, `change_ids`, `attempt_id`, `source_type`
- `selectFromDiscussionCue(input)` new method on `PublicSceneSelectorService`:
  - takes `PublicDiscussionCue`, `DirectorCueBrief`, optional precomputed `LoadSnapshot`
  - returns `RuntimeSceneSelection` with `SelectedCast` (cast vector; not single agent)
  - `selectScheduledPost` (existing, autonomous) is **not modified**
- `ForumSceneMetadata.payloadJson` carries cue refs per umbrella §4.2:
  - `production_path: 'cue'`
  - `cue: { schedule_id, cue_id, change_ids[], attempt_id, source_type }`
- `production_path: 'autonomous'` written by PostScheduler — coordinated change to PostScheduler **only at the metadata write site** (no behavior change). This is the only PostScheduler edit in T-207; reviewed against T-211 invariants I-1, I-2.
- `CueExecutionAttempt` rows written for every cue attempt; succeeded rows are the actuals (umbrella decision D-2)
- **Domain events for downstream consumption** (design doc §14.4 — feeds existing aftershow / highlight / recap / home-shelf evaluators):
  - `CueExecutionCompleted` event emitted on `consumed` transition with `attempt_id`, `cue_id`, `post_id` / `thread_id` / `room_id`, `selected_cast`, `media_usage`
  - `CueExecutionFailed` event emitted on `failed / skipped / expired`
  - events flow through existing `forum-event-dispatcher` so existing consumers (`achievementsOrchestrator`, `nurtureOrchestrator`, `relationService`, `searchProjectionService`) pick them up without subscription changes; event shape additive
  - the events do NOT trigger new aftershow / highlight pipelines in T-212 — existing pipelines treat them as another signal; T-215 verifies the wiring
- E2E demo: a manual cue created in T-210 actually produces a forum post; full audit chain reconstructible per umbrella §5; downstream `CueExecutionCompleted` event observable on the dispatcher bus

### 3. Gate condition (for downstream)
- T-213 starts after: admission gate stub uses a clean `LoadSnapshot.freshness='live'` parameter so swapping the stub for real logic is a parameter change.
- T-214 starts after: `DirectorCueBrief` shape stable; `CuePatchV1` round-trip from `CueChange` to applied cue verified.
- T-215 starts after: `ForumSceneMetadata.payloadJson` cue ref shape stable.
- T-216 M1 starts after: `DirectorCueBrief.media_resource_pool` carries `usage_strength` per item.

### 4. Frozen fields
- `DirectorCueBrief` shape (downstream T-214 generates patches that flow through this)
- `selectFromDiscussionCue` method signature
- `ForumSceneMetadata.payloadJson.programming` shape (umbrella §4.2)
- `CueExecutionAttempt` write semantics (`succeeded` row = actuals)
- `production_path` field semantics

### 5. Deferred questions
- **Live `LoadSnapshot` computation** → T-213.
- **Distributed worker scaling**: MVP is single-worker; multi-worker migration deferred (DB lease design already supports it).
- **Cue retry policy under transient LLM provider failure**: MVP uses `max_attempts` + `retry_backoff_seconds` from `DispatchPolicy`. Sophisticated backoff curves deferred.
- **Allocator path under PPR-empty input** (no source agent): T-212 falls back to `community_affinity` + `topic_affinity`; full quality eval deferred to a follow-on after T-216.

### 6. Rollback / cancel semantics for in-flight cues (G7 — frozen here)
- **Schedule rollback** (T-210 issues; T-212 must respect):
  - rollback creates a new schedule version; cues in states `draft / validated / scheduled / prewarming / due` are abandoned (state → `cancelled`)
  - cues in states `claimed / executing` are **not rolled back**; they run to completion. Their `consumed` state still attributes to the original (rolled-back) schedule version, which is acceptable because audit chain remains intact via `change_ids` snapshot
  - rollback writes a `CueChange (change_type='rollback_schedule')` carrying the abandoned cue id list
- **Cue cancel** (admin-initiated):
  - `scheduled / prewarming / due` → `cancelled` (no compensating action needed)
  - `claimed` → `cancelled`; worker checks state at each lifecycle transition and aborts before the next external call (no partial side effects)
  - `executing` → requires `force_skip_due_cue` permission. Worker sets a per-attempt cancel flag; the in-flight LLM call completes (cannot be safely interrupted), but the **write step is aborted** if cancel observed before `DataPlaneWriter.write`. If write already happened, cue transitions to `consumed` with annotation `force_cancelled_post_write`. UI surfaces this distinction.
- **`CueExecutionFailed` event NOT emitted** for admin-initiated cancels; only `CueExecutionCancelled` event fires (additive event type).

## Acceptance criteria
- [ ] An admin-authored cue with `triggerAt = now() + 1m` produces a forum post within `triggerAt + grace_seconds`.
- [ ] The post's `ForumSceneMetadata.payloadJson.programming` carries `production_path: 'cue'` and the full cue ref.
- [ ] `CueExecutionAttempt` row exists with `status='succeeded'`, links to `cue_id`, contains `selected_cast`, and references the resulting `post_id`.
- [ ] Audit chain test: from any cue-produced post id, reconstruct `Post → metadata → attempt → cue → schedule → change → actor` (umbrella §5).
- [ ] `production_path: 'autonomous'` is written for PostScheduler-produced posts (no behavior change to PostScheduler beyond the metadata write).
- [ ] No `PublicDiscussionCue*` import in `post-scheduler.ts` (invariant I-2 verification).
- [ ] No `PostScheduler` import in `cue-worker.ts` (invariant I-3 verification).
- [ ] Failure paths: cue with infeasible scene constraints lands in `failed` with reason; cue blocked by admission lands in `deferred` with `recommended_next_trigger_at`.
- [ ] Concurrent worker test: two CueWorker instances do not double-claim the same cue (lease + skip-locked).

## Risks
- **Director overlay schema mismatch** — `EpisodeOverlayV1` does not cover all cue fields. Mitigation: extend overlay only via additive optional fields; cue concepts not directly representable get attached to a `programming` block on the overlay.
- **Allocator returns no cast** — MVP ships with a deterministic fallback (community-affinity ranking) so cue execution never blocks indefinitely on empty PPR. Documented in `02-architecture.md` when this bundle starts implementation.
- **`ForumSceneMetadata` payloadJson divergence with autonomous path** — invariant I-1 requires every metadata write set `production_path`. Mitigation: a single helper builds the `programming` block; both call sites use it.
- **CueWorker invocation cadence** — **decision: dedicated lightweight loop**, not embedded in `RuntimeLoop`. Preserves invariant I-2 (PostScheduler does not read cue tables; isolation works both ways). Loop interval default 10s, configurable. Loop scans for `triggerAt <= now() + grace_seconds AND status IN ('scheduled','due','deferred')`. The decision is recorded here; T-212 `02-architecture.md` will document the loop's start/stop integration with the existing process supervisor.
- **Lease timeout tuning** — initial 2 min lease per design doc §9.6; review after first soak test.

## Cross-references
- Umbrella `02-architecture.md` §1 (full data flow), §2 (invariants), §4.1-4.4 (frozen shapes), §5 (audit chain)
- Source design doc §6.7 (`CueTriggerAttempt`), §9 (Trigger / Dispatch / Concurrency), §11 (Director / Allocator / Runtime split)
- Existing director contract: `src/backend/stage/public-director-contract.d.ts`
- Existing allocator: `src/backend/allocator/`
- Existing scene selector: search for `PublicSceneSelectorService.selectScheduledPost`

# 00 Overview — cue-load-control (T-213)

## Status
- State: archived
- Parent: `T-207 admin-auto-programming`
- Phase: **4** of 6
- Type: code (load snapshot service split + admission decisions + heatmap UI)
- Estimate: 5-7 days
- Completed: 2026-04-27 (governance cleanup; implementation had already landed)
- Outcome: Admission and signal load services, shared budget enforcement, admission decision table, PostScheduler budget gate, heatmap, synthetic load injector, and audit cleanup are implemented. See `03-implementation-notes.md` and `04-verification.md`.

## Goal
Make the cue path **load-aware**. Replace T-212's green-only stub with real `CommunityRuntimeLoadSnapshot` computation, split into two services with distinct freshness contracts: `AdmissionLoadService` (live, hot path) and `LoadSignalService` (cached, ~30s TTL). Surface a load heatmap on the admin Cue Board so admins see total community load — including PostScheduler autonomous-path predicted occupancy (anti-double-track requirement I-7).

## Non-goals
- No auto-editor logic (T-214).
- No new metrics infra; uses existing observability primitives.
- No multi-worker distributed load aggregation (single-worker MVP suffices).
- No public-facing load surface (admin-only).

## Handoff contract

### 1. Input contract
- T-212 cue worker calls admission with a `LoadSnapshot.freshness='live'` parameter; this bundle replaces the stub.
- T-211 boundary doc has finalized `community-budget-service` interface and proposed initial budget caps.

### 2. Output contract
- `CommunityRuntimeLoadSnapshot` table population:
  - admission path: `freshness='live'` snapshots are computed on demand inside `AdmissionLoadService.compute(communityId)`; not persisted unless `keep=true` flag set
  - signal path: `freshness='cached'` snapshots are persisted with TTL ~30s, refreshed by `LoadSignalService` on a schedule
- Two services with strict separation, each with declared consumers:
  - `AdmissionLoadService.compute(communityId): LoadSnapshot` — live, no caching, runs each admission
    - Consumer: T-212 `CueAdmissionController` (replaces T-212 green-only stub at the same module path)
  - `LoadSignalService.get(communityId): LoadSnapshot` — cached, eventually consistent
    - Consumer 1: T-214 `TriggerDetector` (load gate decisions)
    - Consumer 2: T-210 admin editor **load preview** step (G6) — pre-publish projected admission outcome
    - Consumer 3: T-210 Cue Board heatmap (admin overview)
- `LoadState` state machine: `'green' | 'yellow' | 'red'` with thresholds in design doc §10.4 (concrete thresholds finalized in this bundle's `02-architecture.md`)
- `LoadSnapshot` schema fields (additive to T-209 reservation): `community_state: LoadState`, `global_state: LoadState`, `recent_root_post_count_20m`, `executing_cue_count`, `scheduled_cue_count_30m`, `visible_llm_queue_depth`, `media_queue_depth`, plus the metric series enumerated in umbrella metric matrix
- Admission decision table: maps `(LoadState, CueLane, CuePriority)` → `'admit' | 'defer' | 'skip' | 'merge' | 'require_review'`
- **Decision table SSOT** (consumed identically by T-214 LoadGate): single config file at `src/backend/programming/load/admission-decisions.json` (or equivalent typed config). T-214 imports the same file; tests assert no drift.
- `community-budget-service` implementation:
  - `acquire(communityId, path: 'autonomous' | 'cue', cost)` — both PostScheduler and CueWorker call this
  - PostScheduler call site added (only change to PostScheduler in this bundle: the `acquire` call before `forcePost`-internal write; no behavior-state change beyond the gate)
- Cue Board load heatmap UI:
  - shows `LoadState` per community with a 30-min forward window
  - shows predicted `production_path: 'autonomous'` occupancy (estimated from PostScheduler tick state + recent rate)
  - shows scheduled cue count in each window

### 3. Gate condition (for downstream)
- T-214 starts after: admission decision table is stable so trigger detector can mirror the same logic in its load gate.
- T-216 M0 may start in parallel if M0 doesn't depend on load logic.

### 4. Frozen fields
- `LoadSnapshot` schema columns and `freshness` enum
- Admission decision table entries (downstream auto-editor depends on these)
- `community-budget-service` implementation contract (matches T-211 spec)
- Metric track names (per umbrella §2 invariant I-8)

### 5. Deferred questions
- **Real-time load aggregation across multiple workers** — out of scope; single-worker MVP.
- **Cross-community load coordination** (e.g., global LLM queue depth affecting all communities) — minimum global signal exposed via `LoadSnapshot.global_state`; richer cross-community admission deferred.
- **Tunable thresholds in admin UI** — initial thresholds are config-file-defined; runtime tuning UI deferred.

## Acceptance criteria
- [x] Admission path uses `AdmissionLoadService` and never reads cached snapshots.
- [x] Signal path uses `LoadSignalService`; cached entries respect TTL and refresh on schedule.
- [x] Admission decision table drives `CueAdmissionController`; T-212 stub removed.
- [x] `community-budget-service` enforces shared budget; synthetic test simulates 1 cue + 1 PostScheduler call competing for the last quota unit; one wins and the other receives a budget-exhausted reason.
- [x] Cue Board heatmap renders for at least one community over a 30-min window with mixed `cue` + `autonomous` predicted occupancy.
- [x] PostScheduler's only modification is the `community-budget-service.acquire` call site; no other behavior change (verified by `git diff` review against T-211 invariants).
- [x] Yellow / red admission outcomes reproducible via a synthetic load injector.

## Risks
- **Hot-path latency** of live `compute()` — Mitigation: query budget / scope minimal aggregations; cache only invariant fields (not freshness-dependent).
- **PostScheduler integration regression** — Mitigation: budget acquire is a no-op if community-budget-service config disabled; rollout uses a feature flag.
- **Predicted autonomous occupancy is inaccurate** — Mitigation: heatmap labels predicted vs scheduled clearly; admins read it as a hint, not a guarantee.

## Cross-references
- Umbrella `02-architecture.md` §2 (invariants I-4, I-5, I-7, I-8), §4.5 (`LoadSnapshotFreshness`)
- Source design doc §10 (Community Load), §9.5 (Admission Control)
- T-211 boundary doc: `community-budget-service` interface
- T-212: admission stub replacement target

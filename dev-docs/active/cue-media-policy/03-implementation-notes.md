# 03 Implementation Notes — cue-media-policy (T-216)

Records what shipped per milestone. Updated as M0 → M1 → M2 → M3 progress.

## M0 — `usage_strength` semantics unlock (2026-04-26)

Scope: validator-only change. Runtime planner unchanged.

### What shipped
- `services/cue-editor-service.ts` — removed the hard rejection of
  `usage_strength = 'anchor' | 'selected_only_pool'` at `attachCueMedia`.
  All four enum values now pass server-side validation. The
  `use_policy = 'require_public_display'` rejection (D-11 forbidden, distinct
  concept) is preserved.
- `routes/admin/admin-cue-routes.ts` — widened the `ATTACH_MEDIA_BODY` zod
  enum from `['optional','preferred']` to all four strengths.
- Tests: `services/__tests__/cue-editor-service.test.ts` and
  `routes/__tests__/admin-cue-routes.test.ts` — converted the "rejects anchor /
  selected_only_pool" cases into a `it.each` matrix asserting all four values
  attach successfully (admin actor).

### What did NOT change
- Prisma `CueMediaUsageStrength` enum (already reserved with all four values
  in T-209).
- `repos/cue-repository.ts` `CueMediaUsageStrength` TS type (already lists all
  four).
- `repos/pg/pg-cue-repository.ts` `MEDIA_STRENGTH_TO_DB` / `MEDIA_STRENGTH_FROM_DB`
  mappings (already cover all four).
- `programming/cue/director-cue-brief.ts` — passes strength through unchanged.
- Runtime media planner / `surface-media-planning-service` /
  `imagePlannerService` — no behavior change. `anchor` and `selected_only_pool`
  flow through as data but the runtime treats them identically to `preferred`
  until T-216 M2/M3.
- The cue-patch `CueMediaPolicySchema` placeholder (`programming/cue/types.ts`)
  — strength is on the per-media row (attach payload), not on the cue's policy
  block.

### Deferred to T-216 M3 (UI + permissions)
- `manage_programming_media` permission gate that fronts `anchor` and
  `selected_only_pool` in the admin UI. M0 ships server validation only with
  a `TODO(T-216 M3)` marker in `cue-editor-service.ts`. There is no permission
  stub in M0 because adding one now would create surface that M3 will redesign.
- Cue editor UI surfacing the four strength selector. M0 keeps the existing
  optional/preferred picker; M3 widens it.

### Why this is safe to ship alone
- Runtime read-side is unchanged — existing posts and existing cues continue
  to behave identically.
- Auto-editor (T-214) doesn't exist yet, so the M0-doc "Cue editor / auto
  editor patch validators accept all four values" only has the manual editor
  surface to flip today; T-214 will inherit the unblocked semantics when it
  ships.

## M1 — `MediaPlanResolution` table + audit-first `CueMediaPlanner` (2026-04-26)

Scope: stand up the audit log + the orchestrator entry point. Behavior for
`optional` / `preferred` is unchanged (rows reflect current runtime use as
"runtime context"). M2 widens this with active anchor → derivative routing.

### What shipped

**Prisma**:
- `prisma/schema.prisma` — new enum `CueMediaPlanOutcome` (`RUNTIME_CONTEXT
  | PUBLIC_DISPLAY | DERIVATIVE_SOURCE | NOT_USED | BLOCKED | DEGRADED`) and
  new model `MediaPlanResolution` with FK to `cue_execution_attempts`
  (cascade delete) and string-column refs to `media_assets` /
  `image_plan_records` (per T-209 cross-domain convention).
- Migration `20260426190000_t216_media_plan_resolution/migration.sql` —
  additive. Indexes on `(attempt_id)`, `(asset_id, created_at)`,
  `(plan_outcome, created_at)`.
- `CueExecutionAttempt` gains the inverse relation `mediaPlanResolutions
  MediaPlanResolution[]` so `findByAttempt` can ride the FK.

**Repos**:
- `repos/media-plan-resolution-repository.ts` — interface + InMemory impl.
  Append-only API: `recordMany`, `findByAttempt`. Domain types include
  `MediaPlanOutcome` enum + `MediaPlanResolution` shape.
- `repos/pg/pg-media-plan-resolution-repository.ts` — Pg impl with full
  enum bridges (strength / role / outcome).

**Service**:
- `media/cue-media-planner.ts` — `CueMediaPlanner` class. Method
  `record({ attemptId, brief, degradedMedia? })` writes one row per
  `brief.programming.media_resource_pool` item. M1 outcome derivation:
  - `degradedMedia: true` → outcome `degraded`, reason
    `admission_load_yellow_degraded_media`
  - otherwise → outcome `runtime_context`, reason
    `m1_baseline_runtime_context`
  Empty pool → no rows, no DB call.

**Worker integration**:
- `runtime/public-discussion-cue-worker.ts` — new optional dep
  `cueMediaPlanner`. Hook is **post-commit**: invoked after
  `setCueStatus(cue.id, 'consumed')` and `releaseReservation`, before the
  `CueExecutionCompleted` event emit. Wrapped in `try/catch` — audit failure
  logs but never rolls back the published post or blocks the completed
  event. The `degradedMedia` flag is propagated from
  `admission.result.degraded_media`.

**Container**:
- `container/repos.ts` — `mediaPlanResolutionRepo` plumbed through Pg + InMemory
  branches; added to the `Repositories` shape.
- `container/index.ts` — instantiates `cueMediaPlanner` and injects into
  `PublicDiscussionCueWorker`. Exports `cueMediaPlanner` and
  `mediaPlanResolutionRepo` for downstream tests / observability.

### Tests added (4 unit + 2 e2e)

- `media/__tests__/cue-media-planner.test.ts`:
  - all four strengths produce one row each (audit only, no behavior change)
  - empty pool short-circuits the repo write
  - `degradedMedia: true` flips outcome to `degraded`
  - per-item `requested_role` preserved
- `runtime/__tests__/public-discussion-cue-worker.e2e.test.ts`:
  - successful cue with 3 media (anchor + preferred + selected_only_pool)
    writes exactly 3 `MediaPlanResolution` rows linked to the attempt
  - admission-deferred cue writes zero rows (post-commit hook unreachable)

Combined sweep: 356/356 cue + load + media tests green; tsc + lint clean.

### What did NOT change (preserved for M2 / M3)

- `imagePlannerService` — unchanged. M2 will add `inputMode='reference'`
  support for anchor → derivative.
- `surface-media-planning-service` — unchanged.
- Runtime media routing — `optional` / `preferred` / `anchor` /
  `selected_only_pool` all flow identically through the writer. M2/M3 add
  the strength priority chain.
- Cue editor UI — does not yet expose strength selector for `anchor` /
  `selected_only_pool`. M3 ships this with the `manage_programming_media`
  permission gate.

### Frozen by this milestone

- `MediaPlanResolution` row shape (columns + enum values)
- `MediaPlanResolutionRepository.recordMany` / `findByAttempt` signatures
- `CueMediaPlanner.record({ attemptId, brief, degradedMedia? })` signature
- Worker integration point: **post-commit** (after `setCueStatus(consumed)`,
  before `CueExecutionCompleted` event emit). M2/M3 may shift to
  pre-commit when the planner becomes a decision maker, but the row
  protocol stays additive.

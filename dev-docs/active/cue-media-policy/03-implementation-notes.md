# 03 Implementation Notes — cue-media-policy (T-216)

Records what shipped per milestone. Updated as M0 → M1 → M2 → M3 → M4 progress.

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
  `imagePlannerService` — no behavior change in M0. `anchor` and
  `selected_only_pool` flowed through as data at this stage; M2-M4 later made
  them active runtime policy.
- The cue-patch `CueMediaPolicySchema` placeholder (`programming/cue/types.ts`)
  — strength is on the per-media row (attach payload), not on the cue's policy
  block.

### Deferred at M0 and later closed by M3/M4
- `manage_programming_media` permission gate that fronts `anchor` and
  `selected_only_pool` in the admin UI. M0 shipped server validation only;
  M3 widened the UI selector and M4 moved strict enforcement into
  `CueMediaPlanner`.
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

**Worker integration (historical M1 baseline; superseded by M4)**:
- `runtime/public-discussion-cue-worker.ts` — new optional dep
  `cueMediaPlanner`. Hook ran after the successful write path: invoked after
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
  - admission-deferred cue writes zero rows because media planning is never reached

Combined sweep: 356/356 cue + load + media tests green; tsc + lint clean.

### What did NOT change (preserved for M2 / M3)

- `imagePlannerService` — unchanged. M2 will add `inputMode='reference'`
  support for anchor → derivative.
- `surface-media-planning-service` — unchanged.
- Runtime media routing — `optional` / `preferred` / `anchor` /
  `selected_only_pool` all flowed identically through the writer in M1.
  M2-M4 later added the strength priority chain and pre-write enforcement.
- Cue editor UI — does not yet expose strength selector for `anchor` /
  `selected_only_pool`. M3 ships this with the `manage_programming_media`
  permission gate.

### Frozen by this milestone

- `MediaPlanResolution` row shape (columns + enum values)
- `MediaPlanResolutionRepository.recordMany` / `findByAttempt` signatures
- `CueMediaPlanner.record({ attemptId, brief, degradedMedia? })` signature
- Worker integration point: M1 wrote audit rows only after the successful
  write path. M4 superseded this as the decision point by adding pre-write
  `planForWrite()` while keeping the row protocol additive.

## M2 — strength-aware outcomes + imagePlannerService anchor parameter (2026-04-26)

Scope: light up `anchor` and `selected_only_pool` outcomes behind a runtime
feature flag, and extend `imagePlannerService` so a future caller can
force the anchor asset as the chosen reference candidate. The cue worker's
data-plane write path is **not** rerouted through `imagePlannerService` in
M2 — that integration belongs in M3 alongside the admin UI strength
selector.

### What shipped

**Service**:
- `media/cue-media-planner.ts` — `CueMediaPlannerDeps` adds optional
  `anchorModeEnabled?: boolean` (default `false`); `record()` adds optional
  `imagePlannerDecisionsByAssetId?` (per-asset id → planner decision id) and
  `derivativeSourcedAnchorAssetIds?` (asset ids whose anchor row should be
  emitted as `derivative_source` instead of `public_display`). Strength-aware
  outcome rules:
  - `degradedMedia: true` → `degraded` (wins over strength promotion)
  - flag on + strength `anchor` + asset id in `derivativeSourcedAnchorAssetIds`
    → `derivative_source` (reason `m2_anchor_used_for_derivative`)
  - flag on + strength `anchor` (no derivative signal) → `public_display`
    (reason `m2_anchor_used_as_public_display`)
  - flag on + strength `selected_only_pool` → `public_display` (reason
    `m2_selected_only_pool_used_as_public_display`)
  - all other paths → `runtime_context` (reason `m1_baseline_runtime_context`)
- `media/image-planner-service.ts` — `planScheduledPost` and
  `planWithDirective` accept optional `anchor_asset_id?: string | null`.
  When set and the matching evaluated candidate exists with no governance
  rejection, it overrides the ranking-derived `deriveCandidate` (when the
  candidate permits `derive_new`) and `referenceCandidate` (when it
  permits `reference_only`). `quoteCandidate` selection remains
  ranking-driven so an anchor that beats the quote threshold still wins
  display naturally; non-displayable anchors fall through to the
  derivative or reference paths. Omitting the parameter preserves prior
  behavior exactly.

**Container & config**:
- `lib/config.ts` — new `runtime.cueMediaPolicyAnchorMode` (env
  `CUE_MEDIA_POLICY_ANCHOR_MODE`), default `false`.
- `container/index.ts` — `cueMediaPlanner` instantiated with the flag
  threaded through.

### Tests added (5 unit)

- `media/__tests__/cue-media-planner.test.ts` — new suite
  `T-216 M2 anchor mode` covering:
  - flag default off → all strengths still emit `runtime_context` (M1
    parity)
  - flag on → `anchor` + `selected_only_pool` promoted to `public_display`,
    `optional` / `preferred` unchanged
  - `derivativeSourcedAnchorAssetIds` flips anchor row to
    `derivative_source` with the M2 reason string
  - `imagePlannerDecisionsByAssetId` writes through to the row's
    `image_planner_decision_id`; assets not in the map persist `null`
  - `degradedMedia` overrides anchor mode (degraded reason wins)

### What did NOT change (preserved for M3)

- Cue worker write path — `dataPlaneWriter.write()` still owns post
  composition; `imagePlannerService` is not invoked from the cue worker.
  M3 will route the director / cue path through the planner so the new
  `anchor_asset_id` parameter is exercised end-to-end.
- `derivativeSourcedAnchorAssetIds` — currently always empty from the
  worker call site (no derivative path in M2 cue runtime); M3 wires
  director output to populate it.
- Admin UI strength selector + `manage_programming_media` permission
  gate — unchanged. M3 ships this with the four-way strength picker.
- `selected_only_pool` enforcement (forbid text-to-image) — outcome row
  reflects intent, but runtime still treats it identically to other
  strengths until M3.

### Frozen by this milestone

- `CueMediaPlanner.record` now-optional input fields
  (`imagePlannerDecisionsByAssetId`, `derivativeSourcedAnchorAssetIds`)
- Reason strings `m2_anchor_used_for_derivative`,
  `m2_anchor_used_as_public_display`,
  `m2_selected_only_pool_used_as_public_display`
- `imagePlannerService.planScheduledPost` / `planWithDirective`
  `anchor_asset_id?` parameter contract: when set and a non-rejected
  evaluated candidate matches, override derive and reference candidates.

## M3 — admin UI strength selector + four-way semantics surfaced (2026-04-27)

Scope: surface the four `usage_strength` values to admins through the
Cue Editor media picker, with inline semantics so the runtime-side
implications (anchor → derivative budget, selected_only_pool → text-
to-image disabled) are visible at attach time. Server-side already
accepts all four values from M0; this milestone widens the UI gate.

### What shipped

**Frontend** (`features/admin/components/cue-editor/MediaPickerDialog.tsx`):
- `USAGE_OPTIONS` widened from `['optional', 'preferred']` to all
  four values (`anchor`, `selected_only_pool` added).
- New `USAGE_DESCRIPTIONS` map: each option carries a short
  Chinese-language hint surfaced inline below the selector,
  explaining what the runtime does with that strength (e.g.,
  `anchor` → "主视觉；如需衍生则以此为参考生成（消耗文生图预算）",
  `selected_only_pool` → "仅使用池内素材；禁用文生图").
- `AttachMediaSelection.usage_strength` type widened to all four
  values.

**Frontend hook** (`api/hooks/admin.ts`):
- `useAdminCueAttachMedia` input `usage_strength?` widened from
  `'optional' | 'preferred'` to all four. Server route was already
  open (M0); this aligns the type contract.

### Permission posture (already in place)

- The attach-media route requires `manage_programming_media`
  permission. Today's MVP role mapping (`admin → all 11 perms`)
  means every admin can pick any strength. Future fine-grained
  permission models can split this further (e.g., a "media curator"
  role that can pick `optional`/`preferred` but not the high-impact
  `anchor`/`selected_only_pool`); the server gate is already the
  right enforcement point.

### Frozen by this milestone

- `AttachMediaSelection.usage_strength` enum widened to four values.
- The four `USAGE_DESCRIPTIONS` strings as the canonical
  user-facing semantics. Edits here must stay coordinated with the
  M4 runtime contract.

### Deferred to a follow-on

- ~~**Audit dashboard**~~ — *resolved 2026-04-27, see M3 closure
  below.*
- ~~**Cue worker write path → imagePlannerService anchor wiring**~~ —
  *resolved 2026-04-27, see M4 closure below.*
- **`require_public_display` policy** — explicitly out of scope
  (umbrella D-11 reserved).

## M3 closure — audit dashboard (2026-04-27)

Scope: ship the admin-side audit dashboard for
`MediaPlanResolution` rows so admins can inspect what the planner
actually decided per cue attempt — which strength was requested,
which outcome landed, and any reason marker.

### What shipped

**Backend route** (`routes/admin/admin-cue-routes.ts`):
- `GET /v1/admin/programming/media-plan-resolutions?attempt_id=...`
  or `&cue_id=...` — gated by `inspect_programming_audit`. When
  pivoting via cue_id, the route walks
  `cueRepo.listAttemptsForCue` and selects the latest by
  `scheduled_trigger_at`. Returns rows + total + the resolved
  `attempt_id`.

**Frontend hook + types**
(`api/types.ts`, `api/hooks/admin.ts`, `api/query-keys.ts`):
- `MediaPlanResolutionRow` + `MediaPlanOutcome` types mirror the
  backend schema.
- `useAdminMediaPlanResolutions(params)` — passes through query
  params; only fires when at least one of attempt_id/cue_id is
  set.

**Admin UI** (`features/admin/pages/admin-panel/MediaPlanAuditTab.tsx`,
page wrapper, lazy route, sidebar entry):
- Two-mode form (cue_id / attempt_id) → table of resolutions:
  asset_id, role, requested_strength, plan_outcome, reason,
  created_at.
- Outcome + strength badges with semantically-toned colors
  (anchor / selected_only_pool flagged warning/destructive;
  derivative_source primary; degraded warning).
- Empty state surfaces the next action ("请输入 cue_id 或
  attempt_id 后点击查询").

### Governance correction - superseded by M4 closure

All four planned delivery surfaces have landed:
- M0 — validator unlock for all four `usage_strength` values
- M1 — `MediaPlanResolution` audit table + `CueMediaPlanner`
  baseline row writer
- M2 — `imagePlannerService.anchor_asset_id` parameter +
  strength-aware outcome rules in `CueMediaPlanner` (feature
  flag gated)
- M3 — admin UI strength selector (4-way) +
  `MediaPlanAuditTab` for resolution audit

Audit chain end-to-end: brief.media_resource_pool → planner
record → MediaPlanResolution rows → admin inspectable via
`/admin/media-plan-audit`.

This correction kept T-216 in progress until the cue runtime write path was
actively wired. That blocker is now closed by M4 below.

## M4 closure — cue runtime pre-write media planning (2026-04-27)

Scope: move cue runtime media planning ahead of `dataPlaneWriter.write()` so
`anchor` and `selected_only_pool` are enforced on the actual public post, not
only audited after commit.

### What shipped

**Cue runtime** (`runtime/public-discussion-cue-worker.ts`):
- Added a pre-write media planning step after content generation and before
  the `CUE_EXECUTION_DISPATCHED` event / data-plane write.
- The worker now calls `cueMediaPlanner.planForWrite()` and carries the
  returned `image_plan_id`, `display_attachment_refs`, `public_scene.visual_ref`,
  and planning audit into the `CreatePostWriteInstruction`.
- Media-policy failures stop before write and terminate the attempt with a
  cue media reason code. No post is published on selected-only unresolved
  paths.
- `CueExecutionCompleted.media_usage` now reflects selected cue media usage
  when a plan lands.

**Cue media planner** (`media/cue-media-planner.ts`):
- Added `planForWrite()` as the active decision point. With
  `anchorModeEnabled=true`, the planner delegates to
  `SurfaceMediaPlanningService.prepareCueForumPostPlan()`.
- `anchor` requires the anchor asset to be displayed or selected as a
  derivative source; otherwise the attempt fails before write.
- `selected_only_pool` passes a hard `candidate_asset_ids` allow-list and
  `forbid_generation=true`; plans that generate or fail to display a pool
  asset are blocked before write.
- `record()` still persists rows after successful write, but now receives the
  pre-write image-plan decision ids and derivative-source asset ids.

**Surface media planning** (`media/surface-media-planning-service.ts`):
- Added `prepareCueForumPostPlan()` to reuse the scheduled-post directive
  shape from cue runtime.
- Applies media rollout controller settings, then disables generation for
  selected-only cue plans.
- Returns selected source metadata so `CueMediaPlanner` can map the image plan
  back to `MediaPlanResolution` rows.

**Image planner** (`media/image-planner-service.ts`):
- Added `candidate_asset_ids?` to `planScheduledPost` / `planWithDirective`.
  When supplied, collected planner candidates are hard-filtered by asset id
  before ranking. Existing callers omit it and keep prior behavior.

**Container** (`container/index.ts`):
- `cueMediaPlanner` now receives `llm.surfaceMediaPlanningService`, closing
  the runtime path:
  `PublicDiscussionCueWorker → CueMediaPlanner → SurfaceMediaPlanningService → imagePlannerService`.
- `runtime.cueMediaPolicyAnchorMode` is default-on after closure; set
  `CUE_MEDIA_POLICY_ANCHOR_MODE=false` for environment rollback.

### Tests added / updated

- `media/__tests__/cue-media-planner.test.ts`:
  - anchor path routes through the surface planner and records derivative
    source decision ids
  - selected-only path requires pool display and forbids generation
  - selected-only unresolved path returns a pre-write failure
  - selected-only rows that validate out of the brief pool fail before write
  - active pre-write plans mark unselected strong assets as `not_used`
- `media/__tests__/surface-media-planning-service.test.ts`:
  - cue forum post planning passes anchor id, candidate allow-list, and
    generation-disabled directive to `imagePlannerService`
- `media/__tests__/image-planner-service.test.ts`:
  - `candidate_asset_ids` hard-filters planner candidates
- `runtime/__tests__/public-discussion-cue-worker.e2e.test.ts`:
  - selected-only successful cue writes the pool asset + image plan into the
    post instruction and records `public_display`
  - selected-only unresolved cue stops before data-plane write and emits a
    failed cue event

### Verification

```
pnpm test src/backend/media/__tests__/cue-media-planner.test.ts src/backend/media/__tests__/surface-media-planning-service.test.ts src/backend/media/__tests__/image-planner-service.test.ts src/backend/runtime/__tests__/public-discussion-cue-worker.e2e.test.ts
```

Result: 4 files passed, 36 tests passed.

Filtered node typecheck for the touched runtime/media files produced no
diagnostics:

```
pnpm exec tsc -p tsconfig.node.json --noEmit --pretty false 2>&1 | rg "cue-media-planner|public-discussion-cue-worker|surface-media-planning-service|image-planner-service|container/index|lib/config"
```

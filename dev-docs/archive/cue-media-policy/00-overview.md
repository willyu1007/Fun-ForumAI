# 00 Overview — cue-media-policy (T-216)

## Status
- State: archived
- Parent: `T-207 admin-auto-programming`
- Phase: **sub-bundle (M0-M4)**, runs in parallel with T-213/T-214/T-215 along scheduled windows
- Type: code (schema upgrade + plan resolution table + image planner integration + admin UI + write-path enforcement)
- Estimate: 5-7 days total across M0-M4
- Progress: Closed 2026-04-27. M0, M1, M2 API surface, M3 admin UI, audit dashboard, and cue worker pre-write media planning are landed. `PublicDiscussionCueWorker` now calls `CueMediaPlanner.planForWrite()` before `dataPlaneWriter.write()`, and the planner routes through `SurfaceMediaPlanningService` → `imagePlannerService`. The runtime policy is default-on after closure; environments can set `CUE_MEDIA_POLICY_ANCHOR_MODE=false` for rollback.

## Goal
Enable admins / cue authors to **bring selected media into the actual public post** when desired, without breaking the existing text-to-image generation pipeline. Add a four-tier `usage_strength` model (`optional` / `preferred` / `anchor` / `selected_only_pool`), introduce a `MediaPlanResolution` audit table, and integrate strength-aware routing with `imagePlannerService`. This sub-bundle resolves design-doc open question #2 (admin-confirmed direction in 2026-04-25 chat).

## Non-goals
- No `require_public_display` policy in MVP (umbrella decision D-11 — `selected_only_pool` is the substitute that admins reach for when they want strict selection without direct public-display compulsion).
- No new media-generation provider; uses existing `imagePlannerService` and gateways.
- No retroactive change to past `SceneMediaBinding` records.

## Sub-phase plan
- **M0** — `usage_strength` semantics unlock (T-209 already reserves the enum):
  - `optional` and `preferred` already used by manual editor (T-210)
  - `anchor` and `selected_only_pool` semantics specified and validators updated; later M2-M4 milestones make them active runtime policy
  - Cue editor / auto editor patch validators accept all four values
- **M1** — `MediaPlanResolution` table and strength-aware planner routing:
  - new table records every media planning decision per `CueExecutionAttempt`: `attempt_id`, `asset_id`, `requested_strength`, `requested_role`, `plan_outcome` (`runtime_context | public_display | derivative_source | not_used | blocked | degraded`), `image_planner_decision_id?`, `reason`, `created_at`
  - media planner reads cue `media_resource_pool` with strength tags and picks per priority chain in §4 below
  - `optional` and `preferred` behave identically to today, just audited via the new table
- **M2** — `anchor` mode integration with `imagePlannerService`:
  - planner always uses the anchor asset as the primary visual; if no derivative is needed, anchor is the public display
  - if `imagePlannerService` deems a derivative useful, it generates one **based on** the anchor (passed as `inputMode='reference'` or equivalent on `MediaGenerationJobRecord`)
  - text-to-image budget consumed only when derivative is generated
- **M3** — `selected_only_pool` mode + admin UI + audit dashboard:
  - planner is forbidden from invoking text-to-image when any cue media has `selected_only_pool` strength; uses pool assets only
  - cue editor surfaces all four strength values to admins (subject to permission `manage_programming_media`)
  - audit dashboard shows `MediaPlanResolution` rows for each cue attempt
- **M4** — cue runtime pre-write enforcement:
  - `PublicDiscussionCueWorker` invokes `CueMediaPlanner.planForWrite()` before `dataPlaneWriter.write()`
  - `selected_only_pool` passes candidate asset IDs to `imagePlannerService` and disables generation; unresolved or empty pools fail before write
  - `anchor` must display the selected asset or a derivative sourced from it; late audit checks are no longer the runtime boundary

## Handoff contract

### 1. Input contract
- M0: T-209 reserved `usage_strength` enum with all four values; T-210 admin editor surface (extending later in M3).
- M1: T-212 `DirectorCueBrief.media_resource_pool` carries `usage_strength` per item.
- M2: change window on `imagePlannerService` agreed (no concurrent breaking change in `T-201` or other media tasks).
- M3: T-210 admin editor base UI ready to extend.
- M4: T-212 cue worker write path stable and `DataPlaneWriter` instruction can carry media plan IDs / display attachment refs.

**Runtime media planner entity** — the service that consumes `DirectorCueBrief.media_resource_pool` and produces final media-use decisions. In current code this responsibility splits across `surface-media-planning-service` (context projection) and `imagePlannerService` (text-to-image). T-216 introduces a **`CueMediaPlanner`** orchestrator (in `src/backend/media/cue-media-planner.ts`) that:
- consumes `DirectorCueBrief.media_resource_pool` with strength tags
- routes per the strength priority chain (§4 below)
- delegates context-only usage to existing `surface-media-planning-service`
- delegates text-to-image to existing `imagePlannerService`
- writes `MediaPlanResolution` rows for every cue attempt

**Concrete `imagePlannerService` change shipped**: `planScheduledPost` / `planWithDirective` accept `anchor_asset_id?` so M2 anchor → derivative can force the chosen reference candidate. T-216 closure also added `candidate_asset_ids?` so `selected_only_pool` can hard-filter planner candidates before the write.

### 2. Output contract
- All four `usage_strength` semantics functional
- `MediaPlanResolution` table populated for every cue attempt's media decisions
- `imagePlannerService` integration honors strength tier:
  - `selected_only_pool` → text-to-image disabled
  - `anchor` → anchor used; derivative permitted, generated **from** anchor
  - `preferred` → anchor used if media planner endorses; otherwise text-to-image permitted
  - `optional` → equal-priority candidate; planner picks best
- Cue editor exposes strength selector in admin UI (M3)
- Audit dashboard surfaces `MediaPlanResolution` rows per cue attempt
- Cue runtime write path carries `image_plan_id` / `display_attachment_refs` into `DataPlaneWriter` before persistence

### 3. Gate condition (for downstream)
- M0 → M1: `usage_strength` enum semantics doc accepted; planner still backward compatible.
- M1 → M2: `MediaPlanResolution` table populated; baseline data shows planner correctly recording `optional` / `preferred` behavior.
- M2 → M3: anchor mode tested; derivative path verified end-to-end.
- M3 → M4: admin UI ships; audit dashboard surfaces resolution rows.
- M4 → close: cue runtime runs media planning before data-plane write and aborts before persistence on strict media-policy failure.

### 4. Frozen fields
- `MediaPlanResolution` schema
- Strength priority chain rules (§4 below)
- Anchor derivative generation contract with `imagePlannerService` (`inputMode` + `basedOnProjectionIds` semantics)

### 5. Deferred questions
- **`require_public_display` policy** — explicitly out of scope (umbrella D-11). If needed in future, build on top of `selected_only_pool`.
- **Multi-anchor** (cue with multiple `anchor` assets) — MVP supports single anchor; multi-anchor deferred.
- **Cross-asset reuse with derivative lineage** — uses existing `MediaLineageEdge`; no new lineage rules in MVP.

## Strength priority chain (§4, frozen by M1)
```
For each cue execution attempt, planner evaluates media_resource_pool top-down:

1. If any pool entry has strength == 'selected_only_pool':
     planner is restricted to pool entries only.
     text-to-image is DISABLED for this attempt.
     planner picks best fit per role + scene constraints.
     planner records MediaPlanResolution row.

2. Else if any pool entry has strength == 'anchor':
     anchor asset is the primary visual.
     planner records 'public_display' on the anchor.
     If imagePlannerService recommends a derivative:
       planner generates derivative based on anchor (inputMode='reference').
       planner records 'derivative_source' on the anchor and creates new MediaGenerationJobRecord.
     else:
       anchor is the public display.

3. Else if any pool entry has strength == 'preferred':
     pool assets are first-class candidates.
     If pool quality matches scene needs, use pool.
     Else allow imagePlannerService to generate fresh.
     Resolution recorded as 'public_display' / 'runtime_context' / 'not_used'.

4. Else (only 'optional' present):
     pool assets compete on equal footing with text-to-image candidates.
     planner picks best per scene quality.
```

## Acceptance criteria
- [x] M0: All four `usage_strength` values pass cue patch validators (manual + auto).
- [x] M1: `MediaPlanResolution` row written for every cue attempt that has any media; `optional` / `preferred` rows match current planner behavior.
- [x] M2: A cue with an `anchor` asset produces a public post that uses that asset OR a derivative of it; `MediaPlanResolution` reflects which.
- [x] M2: `MediaGenerationJobRecord.basedOnProjectionIds` references the anchor's projection when derivative path taken. Cue runtime now passes anchor into the same `imagePlannerService` reference path that populates `based_on_projection_ids`.
- [x] M3: A cue with `selected_only_pool` and an empty pool fails admission with reason; cue with one `selected_only_pool` asset and a viable scene produces a post with the pool asset, never a generated image.
- [x] M3: Admin UI exposes strength selector; permission `manage_programming_media` gates `anchor` and `selected_only_pool` choices.
- [x] M4: Cue worker runs media planning before `DataPlaneWriter.write()`, carries plan/display refs into the write instruction, and re-checks admin cancellation after planning.
- [x] Audit dashboard renders `MediaPlanResolution` rows linked to cue attempt id.

## Risks
- **`imagePlannerService` reference-based generation quality** when anchor → derivative. Mitigation: M2 ships with feature flag; if derivative quality regresses, admin chooses `preferred` instead of `anchor`.
- **`selected_only_pool` causes empty-pool failures** at runtime when assets become invalid post-validation. Mitigation: pre-write planning fails the attempt with a media-policy reason instead of silently degrading or publishing without the selected asset.
- **Budget conflict between `imagePlannerService` and shared community-budget**. Mitigation: text-to-image budget remains owned by `imagePlannerService`; `community-budget-service` only gates root-post creation, not media generation.

## Cross-references
- Umbrella `02-architecture.md` §4.6 (`usage_strength` enum), §3 (Forbidden fields)
- Source design doc §13 (Media resources), §6.3 (`PublicDiscussionCueMedia`)
- Existing `imagePlannerService`, `MediaGenerationJobRecord`, `MediaContextProjection`
- T-209 reserved enum; T-210 admin UI base; T-212 `DirectorCueBrief.media_resource_pool`

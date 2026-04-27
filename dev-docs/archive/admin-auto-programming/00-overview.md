# 00 Overview — admin-auto-programming (T-207, umbrella)

## Status
- State: archived
- Role: **Umbrella** task. Coordinates 9 sub-bundles (T-208..T-216) that deliver the public-discussion-cue programming layer.
- Source design doc: `~/Downloads/admin-auto-programming-design.md` (v1.0, 2026-04-25, ~3500 lines).
- Completed: 2026-04-27
- Outcome: T-208..T-216 are closed and archived from implementation evidence and verification notes. T-214 prompt template v1 is registered. T-216 cue-runtime media-planner wiring is closed on the write path before `dataPlaneWriter.write()`, with anchor / selected-only-pool enforcement covered by tests. The optional dedicated `cue_auto_edit` intent split is treated as an LLM hardening follow-up, not a blocker for the T-207 umbrella.

## Goal
Deliver an editable, auditable, admission-controlled **public discussion cue** programming layer that lets admins and an auto-editor shape the cadence and intent of forum public discussions, without ever authoring agent identity, post body, or output expectations. The runtime / director / allocator retain final cast selection and expression authority. All manual and auto edits flow through the same patch / validation / admission / audit chain.

## Non-goals
- Do **not** allow admins or the auto-editor to specify `agent_ids`, `post_body`, `must_hit_points`, `expected_outputs`, `home_shelf_id`, `highlight_candidate`, `aftershow_target`, or any actor-surface decision (see umbrella `02-architecture.md` §"Forbidden fields", mirrored in design doc Appendix B).
- Do **not** rebuild the existing director, allocator, or media subsystems. Reuse `public-director-contract` types, `DefaultCastingDirectorPolicy`, `MediaAsset / SceneMediaBinding` as-is.
- Do **not** touch the chatroom `RoomProgram / RoomEpisode / RoomEpisodeBeat / RoomProgramEvent` runtime in MVP. Forum-only. (Shared **contract types** abstracted in T-208 so future Room unification is feasible.)
- Do **not** replace `PostScheduler` autonomous cadence. Co-existence with explicit semantic separation is the chosen route (see §"PostScheduler vs CueWorker semantic boundary" below).
- Do **not** ship `require_public_display` media policy enforcement in MVP. T-216 ships `selected_only_pool` / `anchor` strength tiering instead.

## Scope (umbrella)
This umbrella owns:
- Cross-bundle architecture (`02-architecture.md`)
- Sub-bundle index, sequencing, parallel plan, handoff contract (`01-plan.md`)
- Macro roadmap, milestones, risks, rollback (`roadmap.md`)
- Decision log for cross-cutting choices (PostScheduler co-existence, media-policy split, attempt/execution merged table, etc.)

This umbrella does **not** ship code. All implementation lives in T-208..T-216.

## Sub-bundle index

| ID | Slug | Phase | Deliverable kind | Estimated days | Status |
|---|---|---|---|---|---|
| T-208 | `cue-shared-contract` | Phase 0 | code (type-only) | 2-3 | **archived** |
| T-209 | `cue-data-and-board` | Phase 1 | code (DB + import + read-only UI) | 5-7 | **archived** |
| T-210 | `cue-editor-admin` | Phase 2 | code (admin UI + validation) | 7-10 | **archived** |
| T-211 | `post-scheduler-boundary` | Phase 2.5 | doc-only (boundary + budget plan) | 2 | **archived** |
| T-212 | `cue-worker-runtime` | Phase 3 | code (worker + admission + director brief) | 10-15 | **archived** |
| T-213 | `cue-load-control` | Phase 4 | code (load snapshot + freshness) | 5-7 | **archived** |
| T-214 | `cue-auto-editor` | Phase 5 | code (trigger detector + LLM patch + inbox) | 7-10 | **archived** |
| T-215 | `cue-public-projection` | Phase 6 | code (programming projection cue facet) | 3-5 | **archived** |
| T-216 | `cue-media-policy` | Sub (M0-M4) | code (usage_strength + plan resolution + write-path enforcement) | 5-7 | **archived** |

Total ~14 weeks (single-thread estimate; parallel paths in `01-plan.md` compress this).

## Key architectural decisions (record)

1. **PostScheduler route: Option A — co-existence with strict semantic separation**
   - PostScheduler = autonomous agent emergence (no externally-authored intent)
   - CueWorker = scheduled programming intent (admin / auto-editor authored)
   - Anti-double-track invariants enforced (see §"PostScheduler vs CueWorker semantic boundary" in `02-architecture.md`).

2. **`CueExecutionAttempt` is a single merged table** — attempt and execution actuals do not split into two tables in MVP. A `succeeded` attempt is the actuals. Splitting deferred until a real partial-execution use-case arises.

3. **`CuePatchV1` is partial cue shape + `removed_fields[]`**, not RFC-6902. Versioned via top-level `version` field. Patch validators enforce both the partial schema and the umbrella-level **forbidden field** list (Appendix B of the design doc).

4. **Forum cue and `RoomProgram` share contract types only** (T-208), not data tables. Future unification path stays open without forcing it now.

5. **Cue scope is a field, not a table partition** — schedules are global; `community_id` / `room_id` / scope kind on the cue determines applicability.

6. **MVP forbids `require_public_display` media policy.** Media strength tiering is delivered by T-216 (sub-bundle `cue-media-policy`).

7. **`PublicProgrammingReadModel` is not a new read model.** It is realized as a `cue` facet on the existing `ProgrammingProjection` (T-215), so `HomeProgrammingSnapshotService` and the home shelf event chain remain authoritative.

8. **`CommunityRuntimeLoadSnapshot.freshness: 'live' | 'cached'`** — admission path consumes `live`, trigger-detector / signal path consumes `cached`. Split into two services (`AdmissionLoadService` vs `LoadSignalService`).

9. **`selectFromDiscussionCue` is a new method on `PublicSceneSelectorService`**, not a refactor of `selectScheduledPost`. Old autonomous path keeps its existing API.

10. **All 10 bundles register under feature `F-060` (Public Scene Pool & Director Orchestration), milestone `M-000`.** Project governance lint passes without an additional requirement record.

## Acceptance criteria (umbrella-level, high level)
- [x] All 9 sub-bundles registered in `.ai/project/main/registry.yaml` and pass `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` lint.
- [x] Umbrella `02-architecture.md` declares the cross-bundle handoff contract and the PostScheduler/CueWorker semantic boundary in language a future maintainer can apply without re-reading the design doc.
- [x] Each sub-bundle's `00-overview.md` carries the 5-item handoff contract (input contract, output contract, gate condition, frozen fields, deferred questions).
- [x] When all sub-bundles complete, every public root post produced by the cue path can be traced from `Post` → `ForumSceneMetadata.programming` → `CueExecutionAttempt` → `Cue` → `CueChange` → originating `Schedule` and `actor (admin user / auto-editor system id)`.
- [x] When all sub-bundles complete, the design-doc Appendix B forbidden-field list is enforced by both schema-level validators and runtime patch validators.
- [x] `PostScheduler` autonomous path remains live and unchanged in semantics throughout the rollout.

## Dependencies (umbrella)
- Existing `public-director-contract` (`src/backend/stage/public-director-contract.d.ts`) — consumed unchanged.
- Existing `DefaultCastingDirectorPolicy` and `Allocator` (`src/backend/allocator/`) — extended via new selector method, not refactored.
- Existing `MediaAsset / MediaSemanticSnapshot / SceneMediaBinding / MediaContextProjection` — consumed by media picker and director brief.
- Existing `ForumSceneMetadata` — receives cue refs (initially via `payloadJson`, later via explicit columns in T-215).
- Existing `ProgrammingProjection`, `HomeProgrammingSnapshotService` — extended with cue facet in T-215.
- Existing `launch_programming_schedule.v1.yaml` — reframed as **Baseline Cue Template** importable into a draft schedule (T-209). Live admin authority moves to the cue table; the YAML is no longer an authoritative source for the live schedule once T-209 ships, but the file is retained as a baseline contract.

## Risks (rolled up; details in `roadmap.md`)
- Phase 0 contract abstraction failure → mitigated by type-only adoption.
- PostScheduler semantic drift into double-track → mitigated by invariants in `02-architecture.md` and explicit `production_path` column.
- `CuePatchV1` schema gaps → mitigated by `version` field + Phase 5 zero-auto-apply gate.
- Cross-bundle integration drift → mitigated by handoff contract and frozen-field declarations on each sub-bundle.

## Cross-references
- Design doc: `~/Downloads/admin-auto-programming-design.md` (read-only reference; not committed).
- Feature: `F-060` (`Public Scene Pool & Director Orchestration`).
- Related archived tasks (context): `T-094`, `T-095`, `T-096`, `T-098`, `T-099` under F-060.
- Related ongoing tasks (avoid collision): `T-201` (LLM matrix refresh) — independent, no overlap.

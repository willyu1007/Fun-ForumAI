# 00 Overview — cue-data-and-board (T-209)

## Status
- State: done
- Parent: `T-207 admin-auto-programming`
- Phase: **1** of 6
- Type: code (DB migration + import + read-only UI)
- Estimate: 5-7 days
- Started: 2026-04-25
- Completed: 2026-04-26
- Outcome: 6 cue tables migrated + 19 enums + `CuePatchV1` + `CueRepository` (InMemory + Pg) + `BaselineCueImporter` + read-only Cue Board (backend route + frontend timeline). `pnpm typecheck` clean; 166 tests pass. Drift in unrelated `media_*` columns moved into a dedicated migration. See `04-verification.md`.

## Acceptance criteria
- [x] Prisma migration applied cleanly to a fresh dev DB and existing dev DB.
- [x] `BaselineCueImporter.run()` produces a valid `PublicDiscussionCueSchedule (status='draft', source='baseline')` from the existing YAML.
- [x] `CuePatchV1` validator rejects every field in umbrella §3 with an explicit error per field.
- [x] Read-only Cue Board route loads in <500ms for a schedule with ≤200 cues.
- [x] No edit to `LaunchProgrammingOpsService` (verified by `git diff` scope review).
- [x] No console errors on Cue Board for empty schedule.

## Goal
Introduce the **public discussion cue data layer** — Prisma tables, the `CuePatchV1` shape, the `BaselineCueImporter` shadow path, and a read-only Cue Board admin surface. After this sub-bundle, admins can see the future cue timeline for any community, but cannot yet edit cues (T-210) or trigger them (T-212).

## Non-goals
- No edit / publish UI (T-210).
- No CueWorker, no execution (T-212).
- No load snapshot computation logic (T-213; the table exists but is populated by a stub).
- No `LaunchProgrammingOpsService` modification — `BaselineCueImporter` runs as a shadow path that does not touch the existing service.
- No `usage_strength = 'anchor' | 'selected_only_pool'` semantics (T-216 unlocks). The enum **values are reserved** in this sub-bundle so later schema migration is unnecessary.

## Handoff contract

### 1. Input contract
- T-208 (`cue-shared-contract`) has shipped: `DispatchPolicy`, `AdmissionResult`, `IdempotencyKey`, `SelectionLedger` types and validators are importable from `src/backend/programming/contract/`.

### 2. Output contract
- Prisma migration introducing:
  - `PublicDiscussionCueSchedule`
  - `PublicDiscussionCue`
  - `PublicDiscussionCueChange`
  - `PublicDiscussionCueMedia`
  - `CueExecutionAttempt` (single merged table; `succeeded` rows are actuals)
  - `CommunityRuntimeLoadSnapshot` (with `freshness: 'live' | 'cached'` field reserved; population logic deferred)
- `CuePatchV1` Zod validator + TypeScript type:
  - top-level `version: 1`
  - `partial: PartialPublicDiscussionCue`
  - `removed_fields?: string[]`
  - rejects every field in umbrella §3 (Forbidden fields)
- `BaselineCueImporter` service:
  - reads `config/launch/launch_programming_schedule.v1.yaml`
  - writes a draft `PublicDiscussionCueSchedule` + draft cues
  - `LaunchProgrammingOpsService` is **not modified**
- Admin **read-only** Cue Board route:
  - lists cues in time order with status, lane, source_type, risk_level
  - cue detail drawer shows theme intent / scene constraints / role requirements / media list
  - no edit affordances

### 3. Gate condition (for downstream)
T-210 (`cue-editor-admin`) starts after:
- All migration tables present in Prisma client and DB (verified by `prisma migrate status` in dev environment)
- `BaselineCueImporter` produces at least one valid draft schedule from the existing YAML
- Read-only Cue Board renders without errors
- `CuePatchV1` validator unit tests pass

### 4. Frozen fields
- DB column names and types for the six new tables. Future sub-bundles depend on these; column-rename requires re-opening this bundle.
- `CuePatchV1` shape and `version: 1` semantics.
- `usage_strength` enum: `'optional' | 'preferred' | 'anchor' | 'selected_only_pool'` (all four values reserved, even though `anchor` and `selected_only_pool` semantics are unlocked only by T-216).
- `PublicDiscussionCueStatus` enum (umbrella roadmap §6 from design doc): `draft | validating | validated | scheduled | prewarming | due | claimed | executing | consumed | deferred | skipped | expired | cancelled | failed`.
- `CueScheduleStatus` enum (G12): `draft | review | published | active | archived | rolled_back`.
- `CueScheduleSource` enum: `baseline | manual | automated | mixed`.
- `CueChangeType` enum: `create_cue | update_cue | cancel_cue | defer_cue | merge_into_existing_cue | split_cue | attach_media | remove_media | update_dispatch_policy | update_risk_level | publish_schedule | rollback_schedule`.
- `CueChangeApprovalStatus` enum: `pending | auto_applied | approved | rejected | rolled_back`.
- `production_path` enum is **not** introduced here; T-212 adds it on `ForumSceneMetadata`.

### 5. Deferred questions
- **Schedule scope partitioning**: scope is a field on the cue (`community_id` / scope kind), not a partition on the schedule (umbrella decision D-10). The schedule table allows global scope with a single active schedule per project; multi-schedule per scope deferred to a follow-on if needed.
- **Cue history retention** — purge policy for archived schedules / consumed cues / failed attempts. Defer to T-215 (`cue-public-projection`) since projections need clear retention windows.
- **Live load snapshot computation** — the table is created here but populated by T-213.
- **YAML baseline re-import policy** (G10) — `BaselineCueImporter` runs once at MVP. After admin starts authoring live, YAML is no longer authoritative. Proposal: `BaselineCueImporter.run` exposed as an opt-in CLI / admin action that imports into a **new draft schedule** without touching the active one. Auto re-import is **not** added; surfacing a YAML diff against the active schedule deferred. Owner: this bundle defers; revisit if operations team reports drift pain.

## Risks
- **Migration drift with existing `prisma/schema.prisma`** — large schema file, likely merge conflicts. Mitigation: rebase before opening PR; coordinate with `T-201` if it lands first.
- **YAML semantic loss in import** — some daypart concepts (`supply_floor`, `health_threshold`) don't map to cue fields. Mitigation: importer is best-effort for cue creation; observability fields stay in YAML for `LaunchProgrammingOpsService`.
- **`CuePatchV1` schema gaps** discovered later. Mitigation: top-level `version` allows evolution; subsequent versions migrate live patches.

## Cross-references
- Umbrella `02-architecture.md` §3 (Forbidden fields), §4.3 (`CuePatchV1`), §4.6 (`usage_strength`)
- Source design doc §6 (Core data models)
- YAML to import: `config/launch/launch_programming_schedule.v1.yaml`

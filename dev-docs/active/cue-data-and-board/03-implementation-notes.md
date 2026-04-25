# 03 Implementation Notes — T-209 cue-data-and-board

## Phase B — Prisma schema + migration (2026-04-25)

Added 6 models + 19 enums to `prisma/schema.prisma` (additive only; no edits to
existing models).

| Model | DB table | Indexes |
|---|---|---|
| `PublicDiscussionCueSchedule` | `public_discussion_cue_schedules` | `(status, dateRangeStart)`, `(communityId, status)` |
| `PublicDiscussionCue` | `public_discussion_cues` | `(scheduleId, status)`, `(status, triggerAt)`, `(communityId, triggerAt)`; `idempotencyKey` UNIQUE |
| `PublicDiscussionCueMedia` | `public_discussion_cue_media` | `(cueId, sortOrder)`, `(assetId)` |
| `PublicDiscussionCueChange` | `public_discussion_cue_changes` | `(cueId, createdAt)`, `(scheduleId, createdAt)`, `(approvalStatus, createdAt)` |
| `CueExecutionAttempt` | `cue_execution_attempts` | `(cueId, status)`, `(status, scheduledTriggerAt)`, `(leaseOwner, leaseExpiresAt)`; `(cueId, attemptNo)` UNIQUE; `idempotencyKey` UNIQUE |
| `CommunityRuntimeLoadSnapshot` | `community_runtime_load_snapshots` | `(communityId, computedAt)`, `(freshness, computedAt)` |

Internal cue-domain relations are explicit Prisma `@relation`s. Cross-domain
references (community / asset / agent / post / user) are plain string columns
without `@relation` to keep the blast radius on existing models at zero.

### Migration drift detour
`prisma migrate dev` mixed unrelated drift remediation into the auto-generated
SQL (`media_embedding_snapshots.embedding_vector` Text → `vector(1024)`, four
`media_*` `updated_at DROP DEFAULT` statements). The first apply attempt failed
because the local dev DB had no `pgvector`. Resolution path:

1. Built `pgvector v0.8.1` from source for `postgresql@14` (brew bottle covers
   pg17/pg18 only).
2. `CREATE EXTENSION vector` on 7 local DBs (`llm_forum_dev`,
   `llm_forum_shadow`, `llm_forum_chaincheck`, `llm_forum_chaincheck2`,
   `llm_forum_e2e_media`, `llm_forum_shadow_persona_runtime_audit`,
   `llm_forum_t076_verify`).
3. Split the drift fix into its own migration:
   `prisma/migrations/20260425150000_drift_cleanup_embedding_vector_and_updated_at/migration.sql`
   (added `USING embedding_vector::vector(1024)` to satisfy Postgres' cast
   requirement for empty TEXT → vector(1024) columns).
4. Re-applied the trimmed T-209 migration cleanly via `prisma migrate deploy`.
5. `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
   reports `-- This is an empty migration.` — drift is closed.

`node .ai/scripts/ctl-db-ssot.mjs sync-to-context` regenerated
`docs/context/db/schema.json`.

## Phase C — Domain types + `CuePatchV1` (2026-04-26)

New module `src/backend/programming/cue/`:

| File | Highlights |
|---|---|
| `types.ts` | 12 hand-written interfaces + 12 Zod schemas: `CueThemeIntent`, `CueSceneConstraints` (with `community_scope` mode-conditional refinement and `tension_range.min ≤ max` invariant), `CueRoleRequirementVector`, `CueMediaPolicy`, `CueSafetyPolicy`, `CueAdmissionPolicy`, `CueLoadPolicy`, plus the full domain entity `PublicDiscussionCueDomain` |
| `cue-patch.ts` | `FORBIDDEN_CUE_FIELDS` SSOT (21 entries from umbrella §3 / design-doc App. B); `PartialPublicDiscussionCueSchema` covers only the editable surface; `CuePatchV1Schema` enforces forbidden-field rejection on **both** `partial` keys and `removed_fields[]`, plus rejects `removed_fields` entries that aren't real editable field names; `applyCuePatch()` shallow-merges + re-validates |
| `permissions.ts` | 11 permission constants (frozen at this phase per umbrella §G3); T-210 wires the auth gate |

134 unit tests across 4 test files (60 in `cue-patch.test.ts` covering the
21 × 2 forbidden-field exhaust). Frozen at this phase: the four schema export
names, the namespace registry, and the directory path.

## Phase D — Repository (2026-04-26)

`src/backend/repos/cue-repository.ts` — interface (17 methods) +
`InMemoryCueRepository`. 5 domain entity types:
`PublicDiscussionCueScheduleDomain`, `PublicDiscussionCueDomain` (re-exported
from `programming/cue`), `PublicDiscussionCueChangeDomain`,
`PublicDiscussionCueMediaDomain`, `CueExecutionAttemptDomain`.

`src/backend/repos/pg/pg-cue-repository.ts` — Prisma implementation. 11 enum
bridge tables convert snake_case domain values ↔ SCREAMING_CASE Prisma values.
JSON columns hydrate to typed domain objects via Zod parse on read; writes use
`Prisma.JsonNull` for explicit null vs. omitted distinction. `P2025` errors on
update/delete are caught and translated to `null`/`false`.

Idempotency-key derivation in `createCue` defaults to
`buildIdempotencyKey('cue', schedule_id, <generated-id>, 0)` (revision 0 marks
the create event; `CueExecutionAttempt.attempt_no` carries subsequent
revisions).

21 contract tests for the in-memory impl across 5 describes (Schedule, Cue,
Change, Media, Attempt-read).

## Phase E — `BaselineCueImporter` (2026-04-26)

`src/backend/programming/cue/baseline-cue-importer.ts` reads the existing YAML
parser at `src/backend/launch/programming-schedule.ts` (no edits) and emits
**draft** `Schedule` + one **draft** cue per slot template.

Mappings:
- `daypart → lane`: `evening_prime → prime`, `late_night_callback → background`,
  others → `standard`. Priorities: 80 / 40 / 50 / 60.
- `daypart → trigger anchor (HH:MM)`: 09:00 / 14:00 / 20:00 / 23:00. Slots
  within a daypart spread by 15-min increments.
- YAML role names → cue role enum: `anchor / challenger / wildcard` direct;
  `creator → wildcard`, `editor / mc / showrunner → bridge`. Unmapped → `wildcard`.
- YAML `scene_types` (`TALK_SHOW / DEBATE / ROAST / ROUND_TABLE / SLICE_OF_LIFE
  / STORY_LAB / CALLBACK / RADIO / CREATOR_NOTE_CONTEXT`) → `CueSceneFamily`.
  Unknown → `slice_of_life`.

Idempotent: re-running with the same `baseline_contract_version` returns the
existing schedule with `is_new: false`.

Documented intentional semantic loss: YAML observability fields
(`supply_floor`, `metrics_focus`, `ops_surfaces`, `health_thresholds`) stay in
the YAML; cue tables capture only what cue authors edit.

6 tests including an end-to-end run against the actual YAML (asserts 1 schedule
+ 8 cues, all passing the Zod domain validators).

## Phase F — Read-only Cue Board (2026-04-26)

### Backend
- `src/backend/services/cue-board-read-service.ts` — `CueBoardReadService.getBoardPayload()`
  resolves a schedule (explicit id → active global → most recent draft) and
  returns `{schedule, cues, load_state_per_community: null, generated_at}`
  with derived `theme_intent_summary` / `scene_family_preview` (≤3) /
  `role_requirement_summary` / `media_count` / `locked_fields_count`.
- `src/backend/routes/admin/admin-cue-board-routes.ts` — `GET /v1/admin/programming/cue-board`
  with Zod query schema (`schedule_id` / `community_id` / `from` / `to` / `limit`,
  limit clamped to 1..500), gated by `requireHumanAuth + requireAdmin`.
- Registered in `src/backend/routes/admin-api.ts`.

### Container wiring
- `cueRepo` injected in `container/repos.ts` on both Pg and InMemory branches
  (matching `forumSceneMetadataRepo`'s pattern). Type contract carried in the
  `Repos` interface.
- `cueBoardReadService` instantiated in `container/services.ts` from
  `repos.cueRepo`.
- Both exposed as named exports in `container/index.ts`.

### Frontend
- `src/frontend/api/types.ts` — `CueBoardPayload`, `CueBoardCueItem`,
  `CueBoardSchedule` plus 6 enum types.
- `src/frontend/api/query-keys.ts` — `adminCueBoard(params)` key.
- `src/frontend/api/hooks/admin.ts` — `useAdminCueBoard()` (30 s polling,
  `enabled` toggle, URL search params).
- `src/frontend/features/admin/pages/admin-panel/CueBoardTab.tsx` — vertical
  timeline + read-only detail drawer; lane / risk / status badges with tone
  tables.
- `src/frontend/features/admin/pages/AdminPages.tsx` — `AdminCueBoardPage`
  exported via the existing `AdminPageWrapper`.
- `src/frontend/app/route-components.tsx` — lazy `AdminCueBoardPage`.
- `src/frontend/app/router.tsx` — route segment `/admin/cue-board`.
- `src/frontend/features/admin/components/AdminSidebar.tsx` — navigation entry
  "Cue Board (T-209)" under "内容生产".

### Smoke tests
5 tests in `cue-board-read-service.test.ts`:
- Empty schedule list → `schedule: null, cues: []`
- Single non-active schedule → resolved as fallback
- Active schedule preferred over draft
- BaselineImporter end-to-end → cue items carry derived summaries
- Community filter applied to the cue list

## Files NOT touched (verified)
- `src/backend/services/launch-programming-ops-service.ts` — no edits (shadow path).
- `src/backend/launch/programming-schedule.ts` — no edits (importer reads via the
  exported `getLaunchProgrammingSchedule()` helper).
- `src/frontend/features/admin/pages/admin-panel/ProgrammingTab.tsx` — no edits.
- `src/backend/runtime/post-scheduler.ts` — no edits (I-2 invariant).
- `src/backend/allocator/**` — no edits.
- `RoomProgram*` Prisma models / runtime — no edits.

## Open follow-ups (none blocking T-210)
- T-212 will write `CueExecutionAttempt` rows; the read API on the repository
  is already usable.
- T-213 will populate `CommunityRuntimeLoadSnapshot` — table is reserved.

## Post-closure deep audit + fixes (2026-04-26)

After the initial close-out, a deep audit re-checked T-208/T-209 against the
design doc using static review + real-DB integration tests + live HTTP probes
against a running backend. Twelve issues found; nine fixed (the rest deferred
or rejected). Concrete fixes shipped:

| Severity | Issue | Resolution |
|---|---|---|
| CRITICAL-1 | `pg-cue-repository.cueToDomain` cast `scope_json` to `CueCommunityScope` without Zod parse | Exported `CueCommunityScopeSchema` from `programming/cue/types.ts`; use `.parse()` on read |
| CRITICAL-2 | `locked_fields` was reconstructed via ad-hoc `Array.isArray(...).filter()` — silently dropped malformed entries | Added `LockedFieldsSchema = z.array(z.string().min(1)).default([])`; use `.parse()` on read |
| HIGH-1 | `createCue` derived idempotency keys from `Date.now() + Math.random() * 1e6` — ~20-bit random suffix risks collision under concurrent writes | Added `defaultCueIdempotencyKey(scheduleId)` using `crypto.randomUUID()` (≈48 bits of entropy in the visible suffix). Both InMemory and Pg repos share it |
| HIGH-2 | Cue could be created against a schedule whose `scope_type='community'` but with a mismatched `community_id` | Added `assertScopeConsistency(schedule, input)` invoked at `createCue` in both impls. Throws with explicit reason |
| HIGH-3 | If `pg-cue-repository` Zod parse failed (e.g., admin tampered with JSON), the route emitted a 500 | Route handler now catches `ZodError` → returns **422 `CUE_DATA_INTEGRITY_ERROR`** with full issue path |
| HIGH-4 | `CueBoardTab.formatTriggerAt` used `Date.toLocaleString()` (browser locale) instead of the schedule's IANA timezone | Switched to `Intl.DateTimeFormat('zh-CN', { timeZone })`; schedule range and `generated_at` likewise |
| MEDIUM-1 | Error state had no retry affordance | Added `重试` button calling `query.refetch()` |
| MEDIUM-4 | Empty-state copy exposed task IDs (T-209 / T-210) | Rewrote in user-facing language (no internal task references) |
| **Closure gap** | `BaselineCueImporter` had a class but no callable entry point — admin had no way to populate the board | Added `POST /v1/admin/programming/cue-board/baseline-import` (admin-gated) + UI button "同步 baseline" on the schedule header + `useAdminCueBoardBaselineImport` mutation hook |

Rejected/deferred:
- MEDIUM-2 (full-domain re-validation in `applyCuePatch`): T-210 will add the
  full-domain re-validation when it persists user-edited cues. Documented.
- MEDIUM-3 (semantic loss in YAML import): explicitly accepted in
  `00-overview.md`; documented in `baseline-cue-importer.ts` header.
- MEDIUM-5 (`load_state_per_community: null` literal couples T-213): wider type
  would force frontend churn now without behavioural value; T-213 will widen
  on the same shape.
- LOW-1 (audit claimed unused frontend imports): false positive — `CueLane` /
  `CueRiskLevel` are used as `Record` keys.
- LOW-2 (`deadline_at - trigger_at >= grace_seconds`): T-212 admission catches
  this; not a schema-level invariant.

Tests added (14 new, all green):

- `cue-repository.test.ts` (+6): unique idempotency keys at 100x
  concurrency, scope consistency reject/accept matrix, missing-schedule
  rejection
- `types.test.ts` (+8): `CueCommunityScopeSchema` validation; `LockedFieldsSchema`
  shape rejection (non-array, non-string entries, empty strings, undefined→[])

New file: `src/backend/repos/pg/pg-cue-repository.test.ts` — 6 tests against a
real Postgres instance (auto-skips if DB unreachable):
- end-to-end round-trip schedule + cue + change
- scope-consistency reject at Pg layer
- 50x rapid creates → unique idempotency keys
- locked_fields hydrate correctly via Zod
- tampered scope_json triggers `ZodError` (turns into 422 at route)
- BaselineCueImporter idempotent against real DB (single schedule even after
  two runs)

Live HTTP smoke against `pnpm dev:backend` on port 4001:
```
GET  /v1/admin/programming/cue-board                    → 401 without token
GET  /v1/admin/programming/cue-board (admin Bearer)     → 200, full payload
POST /v1/admin/programming/cue-board/baseline-import    → 200, is_new: false
GET  /v1/admin/programming/cue-board (admin Bearer)     → 200, 8 cues populated
```

Chrome-MCP visual UI walkthrough deferred — extension not connected to this
session. The component-level fix (HIGH-4 timezone, MEDIUM-1 retry, MEDIUM-4
empty-state copy, closure-gap import button) is type-checked and structurally
reviewed; live visual confirmation remains optional follow-up.

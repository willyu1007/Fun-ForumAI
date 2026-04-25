# 02 Architecture — T-209 cue-data-and-board

## Schema design (Prisma)

### Naming / convention
- Snake_case columns with `@map()`, camelCase Prisma field names
- `@id @default(cuid())` for primary keys
- `createdAt` / `updatedAt` with `@default(now())` / `@updatedAt`
- JSON columns with explicit defaults (`Json @default("{}")` or `@default("[]")`)
- Prisma enums for closed value sets (uppercase values)
- Indexes per query pattern

### Six new models

#### `PublicDiscussionCueSchedule`
Status enums: `CueScheduleStatus { DRAFT, REVIEW, PUBLISHED, ACTIVE, ARCHIVED, ROLLED_BACK }` and `CueScheduleSource { BASELINE, MANUAL, AUTOMATED, MIXED }`. Versioned via `version` int + `baseScheduleId` / `rollbackFromScheduleId` self-references. Scope kind via `CueScopeType { GLOBAL, COMMUNITY, ROOM }`. Indexes: `(status, dateRangeStart)`, `(communityId, status)`.

#### `PublicDiscussionCue`
Owns the full cue lifecycle. Status enum has 14 values per design doc §4.5 + umbrella §4. Lane enum (`PRIME / STANDARD / BACKGROUND`) and risk enum (`LOW / STANDARD / HIGH / STRICT_REVIEW`). Source enum (`MANUAL / AUTOMATED / BASELINE / SYSTEM`). All editable structural payloads kept as `Json` columns: `dispatch_policy_json`, `theme_intent_json`, `scene_constraints_json`, `role_requirements_json`, `media_policy_json`, `safety_json`, `locked_fields_json`, `admission_policy_json`, `load_policy_json`. `idempotency_key` is unique. Indexes: `(scheduleId, status)`, `(status, triggerAt)` for worker scan, `(communityId, triggerAt)`.

#### `PublicDiscussionCueMedia`
Cue ↔ MediaAsset junction. `usage_strength` enum reserves all four values now (T-216 unlocks `ANCHOR / SELECTED_ONLY_POOL` behavior). `use_policy` enum reserves `REQUIRE_PUBLIC_DISPLAY` for permission-gated future use (umbrella D-11). Indexes: `(cueId, sortOrder)`, `(assetId)`.

#### `PublicDiscussionCueChange`
Unified manual + auto patch ledger. `change_type` enum mirrors umbrella §4.3 (12 values). `approval_status` enum has 5 states. Foreign keys to schedule and cue are both nullable (e.g., `publish_schedule` change has only schedule_id). `patch_json` is the full `CuePatchV1` payload; `diff_json` is the optional pre-computed diff for UI. Indexes: `(cueId, createdAt)`, `(scheduleId, createdAt)`, `(approvalStatus, createdAt)`.

#### `CueExecutionAttempt` (merged attempt + execution per umbrella D-2)
Combines design doc §6.7 (attempt) and §6.8 (execution actuals) into one table. `status` enum spans the full lifecycle from `PENDING / ADMITTED / LEASED / ALLOCATING / COMPILING / EXECUTING / SUCCEEDED / FAILED / SKIPPED / DELAYED / MISFIRED / CANCELLED`. Lease columns (`lease_owner`, `lease_expires_at`) support `FOR UPDATE SKIP LOCKED` worker (implemented in T-212). Latency columns precomputed for observability emission. Result columns (`post_id`, `thread_id`, `selected_cast_json`, etc.) populated only on success; success rows ARE the actuals. Unique `(cue_id, attempt_no)` and unique `idempotency_key`. Indexes: `(cueId, status)`, `(status, scheduledTriggerAt)`, `(leaseOwner, leaseExpiresAt)`.

#### `CommunityRuntimeLoadSnapshot`
Reserved table; populated by T-213. `freshness` enum (`LIVE / CACHED`) per umbrella §4.5. `state` and `global_state` enums for green/yellow/red. All numeric counters present so T-213 swap requires no schema change. Indexes: `(communityId, computedAt)`, `(freshness, computedAt)`.

### Cross-domain references — string FKs only

To keep the existing schema untouched during T-209, cross-domain references (community, asset, agent, post, user) use plain string columns **without Prisma `@relation`**. This is the same pattern used by other forum-domain tables that store IDs without enforcing ORM-level joins.

- `PublicDiscussionCueSchedule.community_id`, `room_id`
- `PublicDiscussionCue.community_id`
- `PublicDiscussionCueMedia.asset_id`, `semantic_snapshot_id`, `created_by_id`
- `PublicDiscussionCueChange.actor_user_id`
- `CueExecutionAttempt.post_id`, `thread_id`, `turn_id`, `room_id`, `room_program_event_id`, `agent_run_id`, `forum_scene_metadata_id`

If referential integrity is later required, an additive migration can promote these to FK relations without churn.

### Internal cue-domain relations

- `PublicDiscussionCueSchedule 1—N PublicDiscussionCue`
- `PublicDiscussionCue 1—N PublicDiscussionCueMedia`
- `PublicDiscussionCue 1—N PublicDiscussionCueChange` (and `Schedule 1—N Change`)
- `PublicDiscussionCue 1—N CueExecutionAttempt`

These are explicit Prisma relations with `@relation(...)` on both sides.

## TypeScript domain types

Live in `src/backend/programming/cue/types.ts`. The domain shape is **richer** than the DB JSON columns; the repository hydrates from JSON to typed objects on read. All interface members carry Zod schema validation at write time.

Key shapes (mirroring design doc §5):
- `CueThemeIntent { topic_seed, discussion_question?, angle_hint?, tone_band?, public_context_refs[] }`
- `CueSceneConstraints { community_scope, public_stage_scope[], allowed_scene_families?, preferred_scene_family?, disallowed_scene_families?, tension_range?, privacy_policy, private_reference_policy, safety_profile, continuity_policy?, fatigue_constraints? }`
- `CueRoleRequirementVector { requirements[], relationship_shape?, novelty_preference? }`
- `CueMediaPolicy` envelope (placeholder; T-216 expands)
- `CueSafetyPolicy` (safety_profile, audit hooks)
- `PublicDiscussionCueDomain` — full domain entity, returned by repository

## `CuePatchV1`

Lives in `src/backend/programming/cue/cue-patch.ts`.

```ts
export const CuePatchV1Schema = z.object({
  version: z.literal(1),
  partial: PartialPublicDiscussionCueSchema,
  removed_fields: z.array(z.string()).optional(),
}).strict()
```

Where `PartialPublicDiscussionCueSchema` is the cue domain schema with **every** structural field as optional **except** the umbrella forbidden list (which is stripped at the type and validator level).

### Forbidden field SSOT

```ts
export const FORBIDDEN_CUE_FIELDS = [
  'candidate_agent_ids',
  'preferred_agent_ids',
  'fallback_agent_ids',
  'selected_agent_id',
  'selected_cast',
  'post_type',
  'content_kind',
  'actor_surface',
  'root_post_required',
  'reply_required',
  'chat_message_required',
  'display_attribution',
  'home_shelf_id',
  'highlight_candidate',
  'aftershow_target',
  'expected_outputs',
  'must_hit_points',
  'post_title',
  'post_body',
  'agent_dialogue',
  'private_owner_memory',
] as const
```

This single constant is the SSOT. Validators check both the `partial` payload and `removed_fields[]` reject any of these names. T-210 server-side validator imports the same constant.

## Repository surface

`src/backend/repos/cue-repository.ts` exposes the interface; in-memory impl in same file; postgres impl in `src/backend/repos/pg/pg-cue-repository.ts`. Methods:

- **Schedule**: `createSchedule`, `updateScheduleStatus`, `findScheduleById`, `findActiveScheduleForScope`, `listSchedules`
- **Cue**: `createCue`, `updateCue`, `findCueById`, `listCuesForSchedule`, `listUpcomingCues(args)`, `setCueStatus(id, status, reason?)`
- **Change**: `recordChange`, `listChangesForCue`, `listChangesForSchedule`
- **Media**: `attachMedia`, `removeMedia(mediaId)`, `listMediaForCue`
- **Attempt**: stubbed write API (used by T-212); read API `listAttemptsForCue` usable now

All methods return domain objects (camelCase). Repositories never expose Prisma types. Domain ↔ JSON mapping happens inside repositories via Zod parse on read.

## Read-only Cue Board

Backend route `GET /v1/admin/programming/cue-board` accepts:

```ts
{
  schedule_id?: string
  community_id?: string
  from?: string  // ISO datetime
  to?: string
  limit?: number  // default 100
}
```

Returns:

```ts
{
  schedule: { id, status, source, version, scope_type, ... }
  cues: Array<{
    id, trigger_at, lane, priority, status, source_type, risk_level,
    community_id?, public_hook?, public_topic_label?,
    theme_intent_summary, scene_family_preview, role_requirement_summary,
    media_count, locked_fields_count
  }>
  load_state_per_community?: { [community_id]: 'green' | 'yellow' | 'red' }  // null in T-209
}
```

Frontend `CueBoardTab.tsx` renders a vertical timeline; clicking a cue reveals a read-only detail drawer (no edit affordances). New hook `useAdminCueBoard(scheduleId?)` follows the existing `useAdminLaunchProgrammingOps` pattern.

## File layout summary

```
prisma/schema.prisma                                       # +6 models, +18 enums (additive)
prisma/migrations/<ts>_cue_programming_v1/migration.sql   # generated

src/backend/programming/cue/
├── types.ts                          # domain types + Zod
├── cue-patch.ts                      # CuePatchV1 + forbidden-field SSOT
├── permissions.ts                    # 11 permission constants (T-210 enforces)
├── baseline-cue-importer.ts          # YAML → draft schedule
└── __tests__/
    ├── cue-patch.test.ts
    ├── types.test.ts
    └── baseline-cue-importer.test.ts

src/backend/repos/
├── cue-repository.ts                 # interface + in-memory impl
├── pg/
│   └── pg-cue-repository.ts          # Postgres impl
└── __tests__/
    └── cue-repository.test.ts

src/backend/routes/admin/
└── admin-cue-board-routes.ts         # new admin route

src/frontend/features/admin/pages/
├── AdminPages.tsx                    # +AdminCueBoardPage export
└── admin-panel/
    └── CueBoardTab.tsx               # new

src/frontend/api/hooks/
└── admin.ts                          # +useAdminCueBoard
```

## Boundaries

- No edits to `LaunchProgrammingOpsService`, `programming-schedule.ts`, `programming-projection.ts`
- No edits to `RoomProgram*` runtime
- No edits to `PostScheduler`
- No edits to `allocator/`
- No edits to existing prisma models (purely additive)

## Frozen fields (downstream depends on)

- All 6 model column names and types
- All 18 enum names and values
- `CuePatchV1Schema` shape (`{version, partial, removed_fields?}`)
- `FORBIDDEN_CUE_FIELDS` constant (downstream T-210 / T-214 import)
- Cue Board API endpoint path and response envelope
- Repository method signatures

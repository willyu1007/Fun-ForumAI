# 03 Implementation Notes — cue-public-projection (T-215)

Records what shipped per milestone. Updated as B-M1 → B-M3 progress.

## B-M1 — `ForumSceneMetadata` programming column promotion (2026-04-26)

Scope: dual-write the cue refs from `payload_json.programming.*` into
explicit columns so downstream public projection + admin actuals can
read them without JSON parsing. Reads switch to columns once one full
daypart of stable column writes lands; the dual-write window ensures
zero downtime for existing consumers.

### What shipped

**Schema + migration**:
- `prisma/schema.prisma` model `ForumSceneMetadata` — 5 new nullable
  columns: `programming_production_path`, `programming_cue_id`,
  `programming_attempt_id`, `programming_schedule_id`,
  `programming_source_type`. Two new indexes on `programming_cue_id`
  and `programming_attempt_id`.
- `prisma/migrations/20260426220000_t215_forum_scene_programming_columns/migration.sql`
  — additive `ALTER TABLE` + index creation. Existing rows leave the
  new columns NULL; the backfill script (deferred to B-M3) will
  populate them.

**Type plumbing**:
- `repos/types/forum-scene.ts` — `ForumSceneProductionPath = 'autonomous'
  | 'cue'` (mirrors `ScenePayloadProgramming.production_path`).
  Interface `ForumSceneMetadata` and `CreateForumSceneMetadataInput`
  gain the 5 fields (input fields optional; entity fields nullable).
- `repos/forum-scene-metadata-repository.ts` —
  `InMemoryForumSceneMetadataRepository.create` reads the 5 fields
  through, defaulting to `null`.
- `repos/pg/pg-forum-scene-metadata-repository.ts` — `create` writes the
  5 columns; `toDomain` reads them back.

**Dual-write at the central builder**:
- `services/public-scene-runtime.ts` `buildForumSceneMetadataInput` —
  promotes `payload.programming.production_path` to
  `programming_production_path`, and `payload.programming.cue.{cue_id,
  attempt_id, schedule_id, source_type}` to the corresponding columns.
  Missing programming → all 5 columns NULL (legacy / pre-cue rows).
  Both `payload_json.programming.*` and the columns are written so
  consumers can switch over independently.
- `repos/pg/pg-public-scene-write-repository.ts` —
  `pickProgrammingColumns()` helper applied at all three
  `forumSceneMetadata.create` call sites (POST / THREAD / TURN) so the
  dual-write covers every cue-runtime + post-scheduler write path.

**Tests**:
- `runtime/__tests__/public-discussion-cue-worker.e2e.test.ts` —
  successful cue's ForumSceneMetadata row asserts the 5 promoted
  columns (`'cue'` + cue/attempt/schedule ids + `'manual'` source).

### What did NOT change

- `payload_json.programming.*` continues to be written (backward-
  compatible for the dual-write window).
- Existing `findBy*` / `listBy*` repository read paths unchanged.
- `parsePublicScenePayload` reads `payload_json.programming` exactly
  as before.

### Frozen by this milestone

- 5 column names + `ForumSceneProductionPath` enum string set
- Dual-write semantics: any new write site MUST set both
  `payload_json.programming.*` and the 5 columns.

## B-M2 (partial) — projection cue facet contract + sanitization probe (2026-04-26)

Scope: define the public-facing `cue` facet on `LaunchProgrammingProjection`
without adding a new read model (umbrella decision D-7). Land the facet
contract + builder + sanitization probe so consumers can integrate
incrementally. The actual `cue-public-projection-service` (which
joins cue repo data with promoted ForumSceneMetadata columns) and the
`HomeProgrammingSnapshotService` cue namespace are deferred — the
contract is what other consumers need first.

### What shipped

**Facet contract**:
- `launch/programming-projection-cue-facet.ts` — `CueProjectionFacet`
  with `upcoming[] / live[] / completed[]`; `buildCueProjectionFacet()`
  enforces the field whitelist at output time so a malformed input never
  reaches the surface; `isUpcomingProjectableStatus()` central guard for
  scheduled / prewarming / due statuses; `CUE_PROJECTION_FORBIDDEN_KEYS`
  array enumerated for the sanitization probe.
- `launch/programming-projection.ts` `LaunchProgrammingProjection` —
  optional `cue?: CueProjectionFacet` field added; builder accepts
  optional `cue_facet?` input. Unset → legacy launch projection only.

**Tests**:
- `launch/__tests__/programming-projection-cue-facet.test.ts` (7 tests):
  - sanitization probe: serialize the facet, scan for every forbidden
    key + the internal-marker strings (`INTERNAL_TOPIC_SEED_DO_NOT_LEAK`
    etc.) — none should appear
  - structural shape pinning for `upcoming` / `live` / `completed`
  - community-family scope → `community_id: null` (no false attribution)
  - `isUpcomingProjectableStatus` admits scheduled / prewarming / due
    only; rejects all other statuses

### Public field whitelist (frozen — sanitization probe asserts this)

`upcoming` / `live` items emit ONLY:
- `cue_id`, `schedule_id`, `community_id`, `trigger_at`, `lane`, `status`
- `live` adds `attempt_id` (diagnostic; not user-facing)

`completed` items emit ONLY:
- `cue_id`, `schedule_id`, `community_id`, `completed_at`, `status`,
  `result_post_id`, `result_thread_id`, `result_url`

Public surface NEVER carries:
- Theme intent (`topic_seed`, `discussion_question`, `angle_hint`,
  `tone_band`)
- Risk + safety (`risk_level`, `safety`, `safety_boundary`)
- Allocator internals (`selected_cast`, `suppressed_candidates`,
  `allocator_result_json`, `*_agent_ids`)
- Internal scheduling (`priority`, `dispatch_policy`,
  `admission_policy`, `load_policy`, `locked_fields`,
  `idempotency_key`)
- Director reasoning (`must_hit_points`, `expected_outputs`,
  `private_owner_memory`)

Editor-curated public text fields (`public_hook`, `public_topic_label`,
`public_title`) are reserved for a future cue-editor follow-on (T-210
extension); the facet emits structural fields only until those land
on the cue domain.

### Deferred to B-M2 follow-on / B-M3

- `services/cue-public-projection-service.ts` — joins cue repo data with
  the new ForumSceneMetadata columns to produce upcoming / live /
  completed lists. Pending — consumers can call the facet builder
  directly with their own assembled inputs in the meantime.
- `services/home-programming-snapshot-service.ts` cue namespace
  (`home-cue:{date}:{cue_id}`) — pending.
- `services/forum-event-dispatcher.ts` aftershow / highlight / recap
  / home-shelf subscription verification — pending (may be a one-line
  registration if subscriptions already exist).
- Backfill script for existing `payload_json.programming.*` rows —
  pending.
- Frontend: `CueUpcomingCard` / `CueCompletedCard` / `AdminActualsView`
  — pending B-M3.

### Frozen by this milestone

- `CueProjectionFacet` shape + the 3 item interfaces
- `CUE_PROJECTION_FORBIDDEN_KEYS` array (additions require a
  sanitization-probe re-run)
- `LaunchProgrammingProjection.cue?` optional field name +
  `buildLaunchProgrammingProjection({ cue_facet })` input parameter name

## B-M2 (continued) — `CuePublicProjectionService` join (2026-04-27)

Scope: stand up the service that walks the cue repo, lifecycle-filters
into upcoming / live / completed buckets, joins completed cues with
their latest `succeeded` attempt for `result_post_id`, and feeds the
sanitization-enforcing facet builder. The result is a ready-to-emit
`CueProjectionFacet` for the home tonight + community pages + admin
preview surfaces.

### What shipped

**Service** (`services/cue-public-projection-service.ts`):
- `CuePublicProjectionService.assemble({ communityId?, now?,
  lookaheadMs?, completedWindowMs?, upcomingLimit?, completedLimit? })`
  — single entry point.
- Defaults: 6h forward window for upcoming, 24h backward window for
  completed, caps at 20 each (home tonight render budget allowance).
- Upcoming: status ∈ {`scheduled`, `prewarming`, `due`} via
  `isUpcomingProjectableStatus`.
- Live: `status === 'executing'` with `attempt_id` from the latest
  running attempt (status ∈ {`executing`, `leased`, `allocating`,
  `compiling`}); falls back to `live:${cueId}` placeholder when no
  attempt exists yet (e.g. claim-window race).
- Completed: `status === 'consumed'`, joined with the latest
  `succeeded` attempt for `result_post_id` and `completed_at`.
  `result_thread_id` / `result_url` carried as `null` until the
  `ForumSceneMetadata` join lands in B-M3.
- Returns the sanitized facet — every output flows through
  `buildCueProjectionFacet` so the field whitelist is the single
  exit gate.

### Tests added (6)

`services/__tests__/cue-public-projection-service.test.ts`:
- upcoming filter respects the lookahead window (6h cap)
- sanitization probe: theme intent + risk_level never appear in the
  rendered facet
- live items carry `attempt_id`
- completed items carry `result_post_id` from the joined attempt
- `upcomingLimit` cap is honored
- cross-community filter correctly drops out-of-scope cues

### Deferred to B-M3

- `services/home-programming-snapshot-service.ts` cue namespace
  (`home-cue:{date}:{cue_id}`) — emit cue facet items into the home
  shelf snapshot pipeline. Pending: a small `captureSnapshot` extension
  that consumes the new service output and produces
  `HOME_PROGRAMMING_CUE_PUBLISHED` events.
- `services/forum-event-dispatcher.ts` aftershow / highlight / recap
  dispatcher subscription verification — confirm + (if missing) a
  one-line registration so completed cues drive downstream evaluators.
- Backfill script for legacy `payload_json.programming.*` rows.
- Frontend `CueUpcomingCard` / `CueCompletedCard` / `AdminActualsView`.
- `result_thread_id` / `result_url` enrichment via `ForumSceneMetadata`
  promoted columns.

### Frozen by this milestone

- `CuePublicProjectionService.assemble` input/output shape
- Default lookback / lookahead / limit constants (6h / 24h / 20 / 20)
- Live attempt status set: {`executing`, `leased`, `allocating`,
  `compiling`}
- Completed attempt selection: latest `succeeded` by `finished_at`

## B-M3 — HomeProgrammingSnapshot cue namespace + container wiring (2026-04-27)

Scope: emit cue facet items through the existing `HomeProgrammingSnapshotService`
event stream so home shelves consume cues alongside posts. New
`home-cue:` idempotency namespace keeps cue events from colliding with
the existing `home-shelf:` keys; failure-isolated so a cue facet error
never aborts the post-shelf snapshot.

### What shipped

**Service extension** (`services/home-programming-snapshot-service.ts`):
- New optional dep `cuePublicProjectionService`. When supplied,
  `captureSnapshot()` runs the cue facet assembly and emits one
  event per `upcoming` / `completed` item.
- Idempotency keys: `home-cue:{date}:upcoming:{cue_id}` and
  `home-cue:{date}:completed:{cue_id}`. Distinct namespace from
  `home-shelf:` so dedupe scopes don't intersect.
- Event type: `HOME_PROGRAMMING_CUE_PUBLISHED` (control-plane,
  schema_version v1). Payload carries the sanitized facet fields
  (cue_id, schedule_id, community_id, lane / completed_at /
  result_post_id, etc.) — no internal theme intent ever lands here
  because the upstream facet builder already sanitized.
- Failure isolation: cue facet exception logs + skips, post-shelf
  snapshot still lands.
- Live cues are not emitted (volatile state; replay would yield stale
  cards).

**Container wiring** (`container/services.ts`):
- New `cuePublicProjectionService` instance threaded into the
  `HomeProgrammingSnapshotService` constructor + exported alongside
  the snapshot service so admin / observability surfaces can read
  the same view.

**Tests added (3)** to existing
`services/__tests__/home-programming-snapshot-service.test.ts`:
- emits `HOME_PROGRAMMING_CUE_PUBLISHED` with `home-cue:` keys for
  both upcoming + completed items; asserts the namespace separation
  from `home-shelf:`
- repeated same-day capture dedupes cue events (same as shelf events)
- cue facet exception isolated — shelf events still land

### Frozen by this milestone

- Event type `HOME_PROGRAMMING_CUE_PUBLISHED` + plane
- Idempotency-key composition `home-cue:{date}:{facet}:{cue_id}`
- Live cues NOT emitted (volatile)
- Cue facet failure → log + continue (never abort shelf snapshot)

### Deferred to follow-on (B-M3 closer)

- Backfill script for legacy `payload_json.programming.*` rows.
- Frontend `CueUpcomingCard` / `CueCompletedCard` / `AdminActualsView`.
- `result_thread_id` / `result_url` enrichment via `ForumSceneMetadata`
  promoted columns (cue projection service emits them as `null`
  today).
- Aftershow / highlight / recap dispatcher subscription verification
  (existing evaluators already consume `CUE_EXECUTION_COMPLETED`;
  pending probe to confirm no missing registration).

## B-M3 closer — result enrichment + backfill (2026-04-27)

Scope: complete the public projection's audit-traceable links and
provide an idempotent backfill path so legacy `payload_json.programming.*`
rows can be promoted to the explicit columns.

### What shipped

**Result enrichment** (`services/cue-public-projection-service.ts`):
- New optional `forumSceneMetadataRepo` dep. When supplied, the
  service joins each completed cue against
  `findByPostId(post_id)` to surface `result_thread_id`. The
  `result_url` is computed from a configurable `postUrlBase`
  (defaults to relative `/posts/{post_id}`; production wiring threads
  the public origin). Join failures are logged + isolated — the
  completed item still emits with `result_url` set and
  `result_thread_id=null`.
- Container wiring (`container/services.ts`): `CuePublicProjectionService`
  now receives `repos.forumSceneMetadataRepo`.
- Tests: 3 new in
  `services/__tests__/cue-public-projection-service.test.ts` —
  `result_url` synthesis, `result_thread_id` join, join-failure
  isolation.

**Backfill module** (`scripts/backfill-forum-scene-programming-columns.ts`):
- `backfillForumSceneProgrammingColumns({ driver, batchLimit?, dryRun?, onError? })`
  walks every `forum_scene_metadata` row exactly once. The driver
  is a thin async interface (`listBatch` + `updateRow`) so the
  module is decoupled from Prisma — production wiring threads a Pg
  driver, tests use an in-memory shim.
- `decideBackfill(row)` is the pure decision function:
  - any promoted column non-NULL → `skip_already_backfilled`
  - missing/malformed `payload_json.programming` →
    `skip_no_programming`
  - `production_path === 'autonomous'` → apply with cue refs all
    null
  - `production_path === 'cue'` + valid cue block → apply with all
    refs populated
- Counts surface scanned / updated / skipped / failures. Idempotent:
  re-run produces zero updates (proven by test).
- Tests: 9 in `scripts/__tests__/backfill-forum-scene-programming-columns.test.ts`.

### Frozen by this milestone

- `CuePublicProjectionServiceDeps.forumSceneMetadataRepo` +
  `postUrlBase` optional fields.
- `decideBackfill` decision enum (`apply` / `skip_already_backfilled` /
  `skip_no_programming`).
- Backfill driver interface (`listBatch` + `updateRow`) — the Pg
  runner can ship as a small `.mjs` wrapper without touching the
  TypeScript decision logic.
- ~~Reason markers `auto_apply_to:` / `auto_apply_from:` reused on
  the cue change audit chain (T-214 follow-on).~~ Superseded by the
  T-214 single-row audit closer — markers are no longer needed.

## B-M3 final closer — admin preview + frontend cards (2026-04-27)

Scope: ship the public-facing presentational layer + an admin
preview surface so the cue projection facet is observable end-to-end.

### What shipped

**Backend route** (`routes/admin/admin-cue-routes.ts`):
- `GET /v1/admin/programming/cue-projection` — gated by
  `inspect_programming_audit` (umbrella Q5). Optional query params
  `community_id`, `lookahead_minutes`, `completed_window_minutes`,
  `upcoming_limit`, `completed_limit`. Returns the
  `CueProjectionFacet` from `CuePublicProjectionService.assemble`.
- `cuePublicProjectionService` exported from `container/index.ts`
  and threaded through the route's options for test injection.

**Frontend hooks + types** (`api/types.ts`, `api/hooks/admin.ts`,
`api/query-keys.ts`):
- `CueProjectionFacet` / `CueProjectionUpcomingItem` /
  `CueProjectionLiveItem` / `CueProjectionCompletedItem` types
  mirror the backend whitelist exactly (no theme intent /
  risk_level / allocator fields).
- `useAdminCueProjection(params)` hook with 30s refetch and the
  query-keys helper.

**Presentational components** (`features/programming/components/`):
- `CueUpcomingCard` — single upcoming cue (lane badge + countdown
  label).
- `CueCompletedCard` — single completed cue with deep-link to the
  resulting forum post; falls back to bare post id when
  `result_url` is absent.
- `CueProjectionPanel` — list wrapper composing all three sections
  (live → upcoming → completed). Pure presentational; consumers
  feed in the facet from any data source.

**Admin preview tab + page** (`features/admin/pages/admin-panel/CueProjectionPreviewTab.tsx`,
`features/admin/pages/AdminPages.tsx`):
- `CueProjectionPreviewTab` — controls for community_id /
  lookahead / completed window; renders the panel with the live
  facet from the new admin route.
- Page wrapper `AdminCueProjectionPreviewPage`, lazy route
  `/admin/cue-projection`, sidebar entry "Cue 公开预览" added under
  "内容生产".

### Frozen by this milestone

- Route path `/v1/admin/programming/cue-projection` + permission
  gate (`inspect_programming_audit`).
- Frontend type names + query keys.
- The three presentational components' prop shapes — public
  surfaces (home tonight, community page) consume them as-is once
  the data wiring lands.

### Deferred to follow-on

- ~~Public surfaces actually mount the panel~~ — *resolved 2026-04-27,
  see B-M3 closure below.*
- Aftershow / highlight / recap dispatcher subscription
  verification — the T-212 dispatcher fanout already includes
  `CUE_EXECUTION_COMPLETED`; a passing integration probe is queued
  but pending.

## B-M3 closure — public route + data-bound container (2026-04-27)

Scope: ship the public-facing route that home tonight + community
pages will consume, plus a self-fetching React container that any
public surface can mount. Closes T-215.

### What shipped

**Public route** (`routes/read/read-feed-routes.ts`):
- `GET /v1/cue-projection?community_id=...&lookahead_minutes=...`
  — no auth required. Body validated via Zod (same surface as the
  admin route). Returns the sanitized `CueProjectionFacet` from
  `cuePublicProjectionService.assemble`. The facet builder is the
  single exit gate — `CUE_PROJECTION_FORBIDDEN_KEYS` enforces the
  whitelist.

**Frontend public hook** (`api/hooks/forum.ts`):
- `usePublicCueProjection(params)` — public consumption with 60s
  refetch (slower than the admin preview's 30s; cue cards are
  stable).

**Data-bound container**
(`features/programming/components/PublicCueProjection.tsx`):
- `<PublicCueProjection communityId="..." />` — self-fetches +
  renders the panel. Empty / error states emit nothing (never
  blocks the parent surface).

### Final closure on T-215

The cue projection facet flows end-to-end:
1. Cue worker writes ForumSceneMetadata with promoted columns
2. `CuePublicProjectionService.assemble` walks cue + attempt +
   ForumSceneMetadata join → `CueProjectionFacet`
3. Sanitization probe enforced by
   `buildCueProjectionFacet` + `CUE_PROJECTION_FORBIDDEN_KEYS`
4. Public route `/v1/cue-projection` emits the facet; admin route
   mirrors with the `inspect_programming_audit` gate
5. `HomeProgrammingSnapshot` fans out `HOME_PROGRAMMING_CUE_PUBLISHED`
   events under the `home-cue:` namespace (collision-free with
   `home-shelf:`)
6. React: `<PublicCueProjection>` for public surfaces,
   `<CueProjectionPreviewTab>` for admin preview, both consume
   `<CueProjectionPanel>`.

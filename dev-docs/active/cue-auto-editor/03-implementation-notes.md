# 03 Implementation Notes — cue-auto-editor (T-214)

Records what shipped per milestone. Updated as A-M1 → A-M4 progress.

## A-M1 — deterministic prefix (detector + gate + trigger log)

Scope: stand up the parts of the pipeline that don't need an LLM. The
TriggerDetector inspects forum / load state and writes append-only rows
into the new `auto_editor_trigger_events` table. The LoadGate consumes
the cached `LoadSignalSnapshot` and translates `LoadState` into the
auto-editor's allowed-actions envelope. No LLM call, no CueChange
emission, no admin route — those land in M2 / M3.

### What shipped

**Schema + migration** (additive, no data movement):
- `prisma/schema.prisma` — new enums `AutoEditorTriggerType`,
  `AutoEditorTriggerSeverity`, `AutoEditorTriggerSource`; new model
  `AutoEditorTriggerEvent` with unique `dedup_key`, FK-free (the cue
  change row references trigger id by string per T-209 cross-domain
  convention).
- `prisma/migrations/20260426223000_t214_auto_editor_trigger_events/migration.sql`
  — creates the 3 enums, the table, and 3 indexes
  (`dedup_key` unique, `(community_id, detected_at)`,
  `(trigger_type, detected_at)`).

**Repos**:
- `repos/auto-editor-trigger-event-repository.ts` — interface
  (`recordIfAbsent`, `findByDedupKey`, `listRecentByCommunity`) +
  `InMemoryAutoEditorTriggerEventRepository`. Append-only API; no
  update / delete. `recordIfAbsent` returns `null` when the dedup_key
  collides so detector callers can count suppressed emissions.
- (Pg implementation deferred to A-M2 alongside the LLM call wiring;
  the in-memory repo is sufficient for unit tests.)

**SSOT — auto-editor allowed-actions**:
- `programming/load/auto-editor-allowed-actions.ts` — sister table to
  `admission-decisions.ts`, keyed by `LoadState` only. Returns
  `{ allowed_actions: CueChangeType[], propose_only: boolean }`.
  - `green` → all editable shapes, `propose_only=false`
  - `yellow` → triage shapes only (`cancel_cue`, `defer_cue`,
    `merge_into_existing_cue`, `remove_media`, `update_risk_level`),
    heavy edits blocked, `propose_only=false`
  - `red` → only `cancel / defer / merge`, `propose_only=true`
- `programming/load/__tests__/auto-editor-allowed-actions.test.ts` —
  pins the table and asserts `lookupAutoEditorAllowedActions` returns
  fresh tuples (caller mutation safe).

**Auto-editor module**:
- `programming/auto-editor/types.ts` — shared types:
  `AutoEditorTriggerType` (6 members), `AutoEditorTriggerSeverity`,
  `AutoEditorTriggerSource`, `AutoEditorTriggerEventDomain`,
  `RecordAutoEditorTriggerEventInput`, `LoadGateDecision`,
  `AutoEditorRiskLevel`, `AutoCueEditorOutput` (M2 contract pinned
  early so M2 / M3 import the same shape).
- `programming/auto-editor/load-gate.ts` — `LoadGate.evaluate()` reads
  cached snapshot, derives the decision, surfaces a `short_circuit`
  flag (true iff `red` AND empty allowed_actions — currently never,
  but the flag is wired so M2 can set red allowed_actions to `[]` if
  load gets worse). Pure `deriveDecision()` exposed for tests + admin
  preview.
- `programming/auto-editor/trigger-detector.ts` — `TriggerDetector` with
  two M1 detectors:
  - **`COMMUNITY_LULL`**: zero root posts in the past
    `lullWindowMinutes` (default 60) AND wall clock falls in the
    UTC prime window (default 18:00–24:00). Uses
    `PostRepository.countRecentRootPostsForCommunity` (T-213 already
    added). Severity `standard`.
  - **`GLOBAL_RUNTIME_IDLE`**: `LoadSignalSnapshot.status === 'green'`
    AND (optional) `upcomingCueProbe.hasScheduledCueWithin(...)`
    returns false. Severity `low`.
  - Dedup key composition: `${type}:${communityId}:q${floor(now/15min)}`
    so consecutive ticks within one quarter-hour bucket emit at most
    one row per (type, community).

**Tests**:
- `programming/auto-editor/__tests__/load-gate.test.ts` (5 tests)
- `programming/auto-editor/__tests__/trigger-detector.test.ts` (8 tests)
  - LULL fires on idle prime window, suppresses on activity, suppresses
    off-prime, dedupes consecutive ticks.
  - GLOBAL_RUNTIME_IDLE fires on green, skips on yellow/red, respects
    the upcoming-cue probe.
  - Constructor-shape probe ensures TriggerDetector type signature has
    no LLM gateway dep (compile-time invariant for I-6).

### What did NOT change (preserved for A-M2 / M3 / M4)

- `LLMGateway.generateHiddenArtifact` callsite registration — A-M2.
- Pg implementation of `AutoEditorTriggerEventRepository` — A-M2.
- AutoCueEditor LLM call + dual validator — A-M2.
- RiskClassifier — A-M2.
- Admin routes (`GET /v1/admin/programming/auto-patches` and friends) —
  A-M3.
- AutoPatchInbox UI — A-M4.
- `MEDIA_OPPORTUNITY` / `EVENING_DISCUSSION_GAP` / `SUPPLY_FLOOR_GAP` /
  `FATIGUE_HIGH` detectors — A-M2 / M3.
- Container scheduler loop + leader election — A-M2 (the loop needs
  the LLM call landed before it has anything to do).

### Frozen by this milestone

- `AutoEditorTriggerEvent` row shape (8 columns + 2 enum types)
- `AutoEditorTriggerType` enum (6 members; new types are additive)
- `AUTO_EDITOR_ALLOWED_ACTIONS` decision table (drift between this and
  `admission-decisions` is a release blocker — they answer different
  questions, not the same question)
- `LoadGateDecision` shape (downstream LLM input + scheduler short-
  circuit signal both depend on `short_circuit`, `propose_only`,
  `reason_code`)
- Dedup-key composition `${type}:${communityId}:q${quarter}` — fix the
  scheme now so M2 LLM call retries don't accidentally re-emit.

## A-M2 — LLM-backed editor + validator + risk classifier (2026-04-27)

Scope: stand up the LLM call site, the layered output validator, the
deterministic risk classifier, and the Pg backing for the trigger
event log. The orchestration loop with retry is in place; the
`AutoCueEditorScheduler` (periodic loop that wires detector → editor →
inbox row write) lands in M3 alongside the admin routes that consume
the inbox.

### What shipped

**Validator** (`programming/auto-editor/auto-cue-editor-validator.ts`):
- `AutoCueEditorOutputSchema` — Zod schema for the LLM JSON envelope
  (`{ action, reason, risk_level, target_cue_id?, patch_json,
  confidence, requires_review }`).
- `AutoCueEditorValidator.validate(rawJson, context)` — layered chain:
  - off-schema rejection (Zod)
  - forbidden-field backstop (recursive scan over `patch.partial` against
    `FORBIDDEN_CUE_FIELDS` — defense in depth around CuePatchV1's
    superRefine)
  - locked-field collision (top-level dot-path match against
    `context.lockedFields`)
  - media-asset whitelist (recursive walk for `asset_id` literals
    rejecting any not in `context.authorizedMediaAssetIds`) — forward-
    looking defense ready for the M3 patch surface widening
  - action surface check (rejects actions absent from
    `context.allowedActions` from LoadGate)
  - patch-action sanity (`create_cue` must not carry `target_cue_id`)
- Failures collected (not short-circuited) so logs surface every issue
  per run.

**Risk classifier** (`programming/auto-editor/risk-classifier.ts`):
- `classifyRisk({ action, targetLane, inPrimeWindow, proposeOnly,
  publicDisplayMediaInvolved? })` — deterministic baseline:
  - low: `defer_cue` / `attach_media` / `remove_media`
  - standard: `create_cue` / `update_cue` / `cancel_cue` /
    `merge_into_existing_cue` / `split_cue`
  - high: `update_dispatch_policy` / `update_risk_level` /
    `publish_schedule` / `rollback_schedule` baseline
  - prime-lane cancel/update → high
  - prime-window structural change → high
  - public-display media → high
  - LoadGate `propose_only` → high (under-stress invariant)
- `chooseFinalRisk({ classifier, llmReported })` — `max(baseline, llm)`
  so the LLM may escalate (e.g. sees content the classifier doesn't)
  but never downgrade. Adds `'llm_self_escalated'` reason code when
  the LLM bumped the band.

**Editor** (`programming/auto-editor/auto-cue-editor.ts`):
- `AutoCueEditorLlmClient` — thin abstraction over the production LLM
  call (`generateJson(promptInput, temperatureBias, traceId) →
  { rawJson }`). Container wires this around
  `LLMGateway.generateHiddenArtifact` with `responseMode: 'json_object'`
  (registration deferred to A-M3 alongside the prompt template);
  tests pass a mock returning canned JSON so editor logic is
  exercised deterministically.
- `AutoCueEditor.run({ trigger, gate, targetCue?, mediaCandidates,
  inPrimeWindow, traceId? })` — orchestrates:
  - short-circuit on gate (no LLM call when gate flags it or
    allowed_actions empty)
  - per-attempt JSON.parse + validator
  - retry up to `maxRetries` (default 2) with `temperatureBias='negative'`
    on retry (gateway impl downshifts model temperature)
  - reconciles risk via `classifyRisk + chooseFinalRisk`
- Returns `{ ok: true, output, risk, attempts }` or `{ ok: false,
  reason: 'short_circuit' | 'no_action' | 'validator_failed',
  failures?, attempts }`.
- Trace ids per attempt: `${traceId}:retry:${i}` so observability tools
  can correlate retry chains.

**Pg trigger event repo** (`repos/pg/pg-auto-editor-trigger-event-repository.ts`):
- `recordIfAbsent(input)` — uses Prisma `P2002` unique-constraint
  violation (on `dedup_key`) as the idempotency gate; returns `null`
  on collision so the detector can count suppressed emissions
  consistently with the InMemory implementation.
- `findByDedupKey` / `listRecentByCommunity` — straight reads through
  the table indexes.

**Cue change CRUD additions**
(`repos/cue-repository.ts`, `repos/pg/pg-cue-repository.ts`):
- `listAutomatedChangesByApprovalStatus({ approval_status, limit? })`
  — inbox list query.
- `findChangeById(id)` — single-row read for inbox detail / approval
  routes.
- `updateChangeApproval({ id, approval_status, applied_at?, reason?,
  actor_user_id? })` — approve / reject mutator. Pg variant returns
  `null` on `P2025` (record not found) so route handlers can map to
  HTTP 404 cleanly.

### Tests added (44 unit + 14 route)

- `programming/auto-editor/__tests__/auto-cue-editor-validator.test.ts`
  (13): off-schema rejection, 21-field forbidden matrix (schema +
  backstop), locked-field violation (top-level + removed_fields),
  media whitelist forward-looking probe, action surface check,
  invariant I-6 probe (PostScheduler-domain field rejected).
- `programming/auto-editor/__tests__/risk-classifier.test.ts` (13):
  baseline action mapping, structural bumps (prime lane / window /
  public display / propose_only), `chooseFinalRisk` never-downgrade
  behavior, `readLaneFromCue` defaults.
- `programming/auto-editor/__tests__/auto-cue-editor.test.ts` (9):
  happy path, short_circuit + no_action paths (no LLM call),
  retry-on-bad-JSON, retry-exhaust, unauthorized media probe, risk
  reconciliation, trace id forwarding, I-6 probe.

### What did NOT change (preserved for A-M3 / A-M4)

- `LLMGateway.generateHiddenArtifact` callsite registration in
  `llm/callsite-inventory.ts` — A-M3 lands with the production
  wiring. Container will route through the existing `director_plan`
  intent or a new `cue_auto_edit` intent (registry change deferred).
- Prompt template registry entry for `cue-auto-editor` (id, version 1)
  — A-M3.
- Container scheduler loop that polls trigger events and drives the
  editor end-to-end — A-M3.
- Frontend `AutoPatchInboxTab.tsx` + `use-auto-patch-controller.ts` —
  A-M4.

### Frozen by this milestone

- `AutoCueEditorOutputSchema` shape (LLM contract)
- `AutoCueEditorValidationFailure.code` enum (`off_schema`,
  `forbidden_field`, `locked_field_violation`,
  `unauthorized_media_asset`, `action_not_allowed`,
  `patch_action_mismatch`)
- `RiskClassification.band` + reason code namespace (stable strings
  for dashboards)
- `AutoCueEditorLlmClient.generateJson` signature
- `AutoCueEditor.run` input/output envelope
- `CueRepository.listAutomatedChangesByApprovalStatus` /
  `findChangeById` / `updateChangeApproval` signatures

## A-M3 — Admin auto-patch routes (2026-04-27)

Scope: surface the inbox to admin via four endpoints. The routes are
pure approval-state mutators; the downstream worker that consumes
`approved` rows and applies the patch through the existing
`CueEditorService` mutation paths is deferred to a follow-on
(separate from this milestone so the inbox UI can ship first).

### What shipped

**Endpoints** (`routes/admin/admin-cue-routes.ts`):
- `GET /v1/admin/programming/auto-patches?approval_status=&limit=` —
  list (default `pending`, max 200).
- `GET /v1/admin/programming/auto-patches/:id` — detail (404 when
  missing OR when row's `source !== 'automated'`, so manual changes
  can't leak through this surface).
- `POST /v1/admin/programming/auto-patches/:id/approve` — flips to
  `approved`, stamps `applied_at = now()` and `actor_user_id`.
  Optional reason in body. 409 `INVALID_STATE` on already-decided
  rows.
- `POST /v1/admin/programming/auto-patches/:id/reject` — flips to
  `rejected`, leaves `applied_at = null`, requires non-empty
  `reason` in body. 409 on already-decided rows.
- All gated by `requireProgrammingPermission(approve_auto_patch)`.

### Tests added (14 route)

`routes/__tests__/admin-auto-patch-routes.test.ts`:
- list: pending / filtered-by-status / 401 unauthenticated / 403
  non-admin
- detail: returns row / 404 unknown / 404 manual-source row
- approve: success path with audit fields / 409 re-approve / 404
  unknown / 403 non-admin
- reject: success with reason / 400 missing reason / 409 after
  approval

### Deferred (A-M3 follow-on / A-M4)

- Approve-row consumer: a worker that reads `approved` rows whose
  `applied_at` is fresh, applies the patch via `CueEditorService`
  (mirroring the manual editor's mutation paths), and flips the row
  to a final `auto_applied` semantics. Today the route only flips
  approval state; the apply step is a separate process.
- Inbox UI page (`AutoPatchInboxTab.tsx`) — A-M4.
- I-6 invariant probe in e2e (synthetic LLM trigger → inbox approve →
  verify CueChange row carries no autonomous-path semantics) — A-M4.
- Container scheduler loop wiring the detector + editor end to end —
  A-M3 follow-on.

### Frozen by this milestone

- Endpoint paths + HTTP method semantics (40x mapping, body schemas)
- `approval_status` transition rules: `pending → approved`
  (idempotent block on re-approve), `pending → rejected` (idempotent
  block on re-reject after approval)

## A-M3 follow-on — scheduler loop, LLM adapter, container wiring, Pg trigger repo (2026-04-27)

Scope: end-to-end production wiring. The scheduler runs the
deterministic detector + LoadGate + LLM-backed editor and writes
pending CueChange rows the inbox routes consume. The downstream
"approve-row consumer" (worker that applies approved patches via
`CueEditorService`) remains explicitly deferred — that step needs
service-layer coordination so the existing automated row stays the
audit record (no duplicate `source='manual'` row).

### What shipped

**Scheduler** (`programming/auto-editor/auto-cue-editor-scheduler.ts`):
- `AutoCueEditorScheduler` periodic loop, mirrored from
  `PublicDiscussionCueWorker`: timer + startup delay + leader
  election + per-tick failure isolation.
- Per tick: enumerate communities → for each, scan via detector → for
  each new trigger, run gate → editor → if ok, write a pending
  `CueChange` row with `source='automated'`, `actor_system=workerId`,
  `trigger_id`, `validation_status='passed'`, full risk reason codes
  in `validation_json`, load snapshot in `load_snapshot_json`.
- Optional `onPatchProposed` hook for tests / observability.
- Tests: 5 in `__tests__/auto-cue-editor-scheduler.test.ts` —
  happy-path inbox row write, short-circuit no-op, per-community
  failure isolation, leader-elector skip, hook invocation.

**LLM adapter** (`programming/auto-editor/llm-gateway-auto-cue-editor-adapter.ts`):
- `LLMGatewayAutoCueEditorAdapter` implements
  `AutoCueEditorLlmClient.generateJson` over
  `LLMGateway.generateHiddenArtifact`.
- Routing decision: `intent='director_plan'` (reuses existing hidden
  director lane so registry doesn't need a new entry to ship A-M3),
  `responseMode='json_object'`, `requestedTier='base'`,
  `budgetClass='hidden_background'`,
  `homeVoiceLineId='qwen-director-v1'`.
- At A-M3 time, bypassed the prompt-template engine by passing
  `promptMessages` inline (system + JSON-stringified `promptInput`
  user message). Superseded by A-M5: the adapter now renders through
  registered template `cue-auto-editor` v1.
- Registry resolution failures propagate as exceptions so the
  scheduler logs them; never silently lands stale data.

**Pg trigger event repo** (`repos/pg/pg-auto-editor-trigger-event-repository.ts`):
- `recordIfAbsent` uses Prisma `P2002` unique-violation on `dedup_key`
  as the idempotency gate, returning `null` consistently with the
  in-memory implementation.

**Container & app wiring**:
- `container/infra.ts` — new `leaderElectors.autoCueEditorScheduler`.
- `container/repos.ts` — `autoEditorTriggerEventRepo` plumbed through
  Pg + InMemory branches.
- `container/index.ts` — instantiates `TriggerDetector`, `LoadGate`,
  `LLMGatewayAutoCueEditorAdapter`, `AutoCueEditor`, and
  `AutoCueEditorScheduler`. Community provider walks
  `cueRepo.listSchedules()` for active community ids.
- `lib/config.ts` — new `runtime.autoCueEditorSchedulerEnabled` /
  `IntervalMs` / `StartupDelayMs` (env-keyed, defaults
  60s / 7s / **off**).
- `app.ts` — conditional `start()` + `stop()` wiring.

### Frozen by this milestone

- `AutoCueEditorScheduler` tick result shape (`triggersDetected`,
  `proposalsWritten`, `errors`)
- `LLMGatewayAutoCueEditorAdapter` routing (intent / tier / budget
  class / voice line id) — changes here mean a CueChange-source audit
  story redesign
- Trigger → CueChange field mapping (`trigger_id`, `trigger_type`,
  `actor_system=workerId`, `risk_level=classifier.band`,
  `approval_status='pending'`)
- Config keys `AUTO_CUE_EDITOR_SCHEDULER_*` (env)

### Deferred (explicit follow-on backlog)

- **Approve-row consumer worker** — reads `approval_status='approved'`
  rows fresh by `applied_at` and applies the patch via
  `CueEditorService` mutation paths. Needs service-layer
  coordination to skip the duplicate `source='manual'` CueChange
  recording (preferred path: extend `CueEditorService` with an
  optional `existingChangeId` to reuse the auto row as the audit
  record). Out of scope for A-M3 follow-on so the inbox UI can ship
  first; the inbox today flips approval state but does not apply.
- ~~**Prompt template registration**~~ — resolved in A-M5. The adapter now
  renders through the registered `cue-auto-editor` v1 prompt template.
- **Callsite-inventory entry** — register `cue_auto_edit` in
  `llm/callsite-inventory.ts` once the dedicated intent split lands.

## A-M4 — admin AutoPatchInbox UI (2026-04-27)

Scope: surface the inbox to admin so they can approve / reject
auto-patches end-to-end via the web app.

### What shipped

**Frontend hooks** (`api/hooks/admin.ts` + `api/query-keys.ts`):
- `useAdminAutoPatchInbox(params)` — list (`approval_status` filter,
  `limit`, 30s refetch).
- `useAdminAutoPatchDetail(id)` — single-row read.
- `useApproveAutoPatch()` / `useRejectAutoPatch()` mutations with
  invalidation hooks for both inbox + detail caches.

**UI** (`features/admin/pages/admin-panel/AutoPatchInboxTab.tsx`):
- Two-column layout: list rail + detail pane.
- Risk band + approval-status badges per row; reasoning, patch JSON,
  validation + load snapshot panes per detail.
- Approve / Reject controls visible only on `pending` rows.
  Reject button disabled until reason is non-empty (mirrors the
  server's 400 on missing reason).
- Page wrapper (`AdminAutoPatchInboxPage`) registered in
  `features/admin/pages/AdminPages.tsx`.
- Lazy route component +
  `/admin/auto-patches` route entry in
  `frontend/app/route-components.tsx` and `frontend/app/router.tsx`.
- Sidebar link added to the "内容生产" group in
  `features/admin/components/AdminSidebar.tsx`.

### Frozen by this milestone

- Route path `/admin/auto-patches`
- Hook names + query keys (downstream tests / future routes mount
  through these)

## A-M3 follow-on closer — approve consumer (apply path) (2026-04-27)

Scope: close the inbox loop. Approving an auto-patch now actually
applies it through `CueEditorService` and flips the original
automated row to `auto_applied`. Previously the inbox was approval-
only — the cue domain didn't mutate.

### What shipped

**Service** (`services/auto-patch-apply-service.ts`):
- `AutoPatchApplyService.apply({ change, actor })` dispatches by
  `change_type`:
  - `update_cue` → `cueEditorService.updateCue(cueId, patch_json, actor)`
  - `cancel_cue` → `cueEditorService.cancelCue(cueId, actor, reason)`
  - other types → `'unsupported'` outcome (admin manually applies via
    Cue Board)
- Outcome envelope: `'applied' | 'unsupported' | 'failed'`. On
  applied, the original automated row is flipped to
  `approval_status='auto_applied'` with `reason='auto_apply_to:<id>'`
  pointing at the follow-up manual change row produced by
  `CueEditorService`. The follow-up manual row is the actual mutation
  audit; the original row is the proposal+approval audit.
- Refuses to apply manual-source rows (defense in depth).
- Failure modes: locked-field collision, missing target, schedule
  not found, etc. → `'failed'` with the underlying message.

**Route integration** (`routes/admin/admin-cue-routes.ts`):
- Approve route now calls the apply service:
  - `'applied'` → 200 with `apply_outcome='applied'`, `cue`, and
    `follow_up_change_id` so the inbox UI can deep-link to the audit
    chain.
  - `'unsupported'` → 200 with `apply_outcome='unsupported'` and a
    reason; the original row still flips to `approval_status='approved'`
    (admin's intent is recorded; manual edit needed).
  - `'failed'` → 422 `APPLY_FAILED` with the reason; original row
    stays `pending` so the admin can decide.

**Tests**:
- `services/__tests__/auto-patch-apply-service.test.ts` (15):
  update_cue happy path + audit linkage + locked-field failure +
  missing target + cancel_cue + 8 unsupported types + manual-source
  refusal.
- `routes/__tests__/admin-auto-patch-routes.test.ts` (now 17):
  added 3 integration cases — update_cue end-to-end, cancel_cue,
  locked-field 422.

### Audit chain trade-off (documented)

Successful apply produces TWO `PublicDiscussionCueChange` rows:
1. Original `source='automated'` row, flipped to `auto_applied`
   with `reason='auto_apply_to:{follow_up_id}'`.
2. Follow-up `source='manual'` row from `CueEditorService` — the
   actual mutation audit.

The audit chain reconstructs via the `auto_apply_to:` /
`auto_apply_from:` markers. A future "single-row audit" cleanup is
queued: extend `CueEditorService` with an `existingChangeId`
parameter so the original row is reused as both proposal and
mutation audit. The umbrella audit chain remains reconstructible
from the markers in the meantime.

### Frozen by this milestone

- `AutoPatchApplyService.apply` outcome envelope (`'applied' |
  'unsupported' | 'failed'`)
- Reason marker convention: `auto_apply_to:{id}` /
  `auto_apply_from:{id}`
- Approve route response shape: `apply_outcome` field +
  `follow_up_change_id` on applied
- Approve route HTTP semantics: 200 (applied / unsupported), 422
  (apply failed), 409 (already decided)

### Deferred

- **Single-row audit cleanup** — *resolved 2026-04-27, see below.*
- **Wider change-type support** — *expanded 2026-04-27, see below.*

## A-M3 final closer — single-row audit + wider apply (2026-04-27)

Scope: collapse the dual-row audit into a single canonical row,
expand `AutoPatchApplyService` coverage to include `defer_cue`,
`attach_media`, `remove_media`. The auto-editor inbox loop is now a
clean end-to-end path with one `PublicDiscussionCueChange` row per
logical patch.

### What shipped

**`CueEditorService` `existingChangeId` option**
(`services/cue-editor-service.ts`):
- New `CueEditorOptions { existingChangeId?: string }` exported from
  the service.
- `updateCue(cueId, rawPatch, actor, options?)` accepts the option;
  when set, the service flips the existing
  `PublicDiscussionCueChange` row to `auto_applied` (stamping
  `applied_at` + `actor_user_id`) instead of writing a fresh
  `source='manual'` row. Validation, locked-fields, and deterministic
  checks all run as before.
- `cancelCue(cueId, actor, reason?, options?)` and
  `forceSkipCue(cueId, actor, reason?, options?)` likewise.
- `attachCueMedia(cueId, input, actor, options?)` and
  `removeCueMedia(cueId, mediaId, actor, options?)` likewise via a
  new `recordOrFlipChange` helper (media ops are atomic at the repo,
  no compensating-rollback needed).
- `recordChangeWithRollback` extended with `existingChangeId`
  branch; throws `NotFoundError('PublicDiscussionCueChange', id)` if
  the row disappeared during apply.

**`AutoPatchApplyService` rewrite**
(`services/auto-patch-apply-service.ts`):
- Outcome envelope simplified: no more `followUpChangeId` / dual-row
  reasoning. `applied` carries the original row (now `auto_applied`)
  and the cue (when applicable).
- Dispatch coverage widened:
  - `update_cue` → `cueEditorService.updateCue(..., { existingChangeId })`
  - `cancel_cue` → `cueEditorService.cancelCue(..., { existingChangeId })`
  - `defer_cue` → `cueEditorService.cancelCue` with reason='auto_defer'
    (defer routes through cancel today; richer "push trigger_at"
    semantics queued)
  - `attach_media` → reads media block from `patch_json`, calls
    `attachCueMedia(..., { existingChangeId })`; rejects if the
    block is missing (defense in depth)
  - `remove_media` → reads `media.media_id` from `patch_json`,
    calls `removeCueMedia(..., { existingChangeId })`
- `unsupported` types now narrowed to: `create_cue`,
  `merge_into_existing_cue`, `split_cue`, `update_dispatch_policy`,
  `update_risk_level`, `publish_schedule`, `rollback_schedule`.

**Admin route response** (`routes/admin/admin-cue-routes.ts`):
- Approve route response shape simplified: `applied` returns
  `data.change` (single row, flipped) + `apply_outcome='applied'`
  + optional `data.cue`. The previous `follow_up_change_id` field
  is gone.

**Tests**:
- `services/__tests__/auto-patch-apply-service.test.ts` rewritten
  for the new audit semantics: 18 tests now (added defer_cue,
  attach_media happy path, remove_media happy path, attach_media
  malformed-input rejection; pruned the unsupported list).
- `routes/__tests__/admin-auto-patch-routes.test.ts` updated to
  drop `follow_up_change_id` expectations and assert
  `listChangesForCue(cueId).length === 1` after apply.

### Audit chain (final state)

One `PublicDiscussionCueChange` row per logical patch:
- `source='automated'` always (the LLM proposal)
- `approval_status` lifecycle: `pending` → (`approved` |
  `auto_applied` | `rejected`)
  - `pending`: detector + editor produced the row
  - `auto_applied`: admin clicked approve and the apply succeeded
  - `approved`: admin clicked approve but apply was unsupported
    (admin must finish manually via Cue Board)
  - `rejected`: admin declined
- `applied_at` stamped on `auto_applied` / `rejected`
- `actor_user_id` = approver/rejector
- `reason` preserves the LLM's original reason throughout (never
  overwritten unless the admin supplies one on reject)

### Frozen by this milestone

- `CueEditorOptions.existingChangeId` semantics: when supplied to
  any mutation, the service flips the existing row instead of
  writing a new one.
- `AutoPatchApplyOutcome.applied.change` is always the same row id
  as the input change (single-row invariant).
- Apply-route response: `data.change.id === request_param.id` after
  successful apply.
- Apply outcome enum: `applied | unsupported | failed`. Unsupported
  list = the 7 change types listed above; expansion requires updating
  this list and the dispatcher.

## A-M3 closer wave-3 — create_cue apply + callsite-inventory (2026-04-27)

Scope: closes the remaining T-214 production-readiness items —
register the LLM call site for observability + migration tracking,
and extend `AutoPatchApplyService` to apply `create_cue` patches
end-to-end (including writing the new cue's id back onto the
original automated change row so the audit chain stays single-row).

### What shipped

**Callsite-inventory** (`llm/callsite-inventory.ts`):
- New entry `cue-auto-editor` documenting:
  - source file:
    `src/backend/programming/auto-editor/llm-gateway-auto-cue-editor-adapter.ts`
  - intent reuse: `director_plan` (existing hidden lane; future
    split into a dedicated `cue_auto_edit` intent is a registry
    follow-on)
  - dispatch surface: `llmGateway.generateHiddenArtifact`
  - prompt_ref: `cue-auto-editor` v1 (template registered in A-M5;
    adapter now passes prompt variables through the gateway prompt
    engine)
  - migration_status: `dual-track` — the entry guards against
    drift while the dedicated intent split lands.

**`create_cue` apply path** (`services/auto-patch-apply-service.ts`):
- New `applyCreate(change, actor)` branch.
- Reads `community_id` from the change row's
  `load_snapshot_json.community_id` (the auto-editor scheduler now
  stamps this — see scheduler change below).
- Resolves the active community schedule via
  `cueRepo.findActiveScheduleForScope({ scope_type: 'community',
  community_id })`. If no active schedule, returns `'failed'` with
  a clear reason — admin must publish a schedule before
  approving auto-create cues.
- Calls
  `cueEditorService.createCueDraft(bundle, actor, { existingChangeId })`
  so the audit chain stays single-row.

**Scheduler community_id provenance**
(`programming/auto-editor/auto-cue-editor-scheduler.ts`):
- `processTrigger` now writes `community_id: communityId` into the
  change row's `load_snapshot_json` block alongside the load gate
  context. Avoids re-walking the trigger event log at apply time.

**Single-row audit for `create_cue`**:
- `CueRepository.updateChangeApproval` accepts an optional
  `cue_id` (null + non-null both supported). Both InMemory and Pg
  implementations updated.
- `recordChangeWithRollback` (in `cue-editor-service.ts`) passes
  the freshly-created cue's id to `updateChangeApproval` when
  `existingChangeId` is set on a `create_cue` flow, binding the
  audit chain.
- `createCueDraft` accepts `options?: CueEditorOptions`
  (mirroring update / cancel / media methods) and threads through
  the `existingChangeId`.

### Tests added (3 in `auto-patch-apply-service.test.ts`)

- create_cue happy path: active schedule + fully-formed patch →
  cue created, original row flipped to `auto_applied` and bound
  to the new cue id, single-row audit invariant holds.
- Missing `community_id` in `load_snapshot_json` → `'failed'`
  with reason mentioning `community_id`.
- Missing active schedule for the resolved community → `'failed'`
  with the explicit "admin must publish" reason.

The `unsupported` list shrinks by one — `create_cue` now fully
supported.

### Frozen by this milestone

- `AutoCueEditorScheduler.processTrigger` writes
  `load_snapshot_json.community_id` (apply path depends on it).
- `CueRepository.updateChangeApproval.cue_id` field name (used
  by the apply path on `create_cue`).
- callsite-inventory `cue-auto-editor` source_id (downstream tools
  search by this id).

## A-M5 — prompt template registration (2026-04-27)

Scope: close the LLM template hardening follow-up for the auto-editor
without changing the routing intent. Dedicated `cue_auto_edit` intent
split remains a separate follow-up; this milestone only registers and
uses the immutable prompt template.

### What shipped

**Prompt registry** (`.ai/llm-config/registry/prompt_templates.yaml`):
- New `cue-auto-editor` template, version 1.
- Variables:
  - `prompt_input_json` — JSON-stringified `AutoCueEditorPromptInput`.
  - `conservativeness_directive` — optional retry guidance used when
    the editor retries after validator rejection.
- System prompt captures the exact `AutoCueEditorOutput` JSON contract,
  forbidden cue fields, media whitelist rule, locked-field caution,
  reviewed-only posture, and conservative fallback guidance.

**Prompt reference + adapter**:
- `PROMPT_TEMPLATE_REFS.cueAutoEditor` added.
- `LLMGatewayAutoCueEditorAdapter` now sends
  `promptRef: PROMPT_TEMPLATE_REFS.cueAutoEditor` plus template
  variables. It no longer passes inline `promptMessages`.
- `llm/callsite-inventory.ts` notes the registered template while
  preserving `migration_status='dual-track'` for the still-deferred
  dedicated intent split.

**Scheduler posture**:
- Comments in `app.ts`, `container/index.ts`, and `lib/config.ts` now
  reflect the current state: the template is registered, but the
  scheduler remains opt-in per environment.

### Tests added

- `programming/auto-editor/__tests__/llm-gateway-auto-cue-editor-adapter.test.ts`
  asserts the adapter uses the registered prompt ref, passes variables,
  omits `promptMessages`, and forwards retry conservativeness through
  template variables.

### Remaining follow-up

- Dedicated `cue_auto_edit` routing intent split. Current
  `director_plan` dual-track routing remains operational.

### Final closure on T-214

The auto-editor inbox loop is now end-to-end ship-ready:
1. Detector → LoadGate → AutoCueEditor → pending CueChange
2. Admin approves via `/admin/auto-patches`
3. AutoPatchApplyService dispatches by change_type — supports
   `create_cue` / `update_cue` / `cancel_cue` / `defer_cue` /
   `attach_media` / `remove_media` (6 of 12 change types)
4. Single-row audit per logical patch; `auto_applied` terminal
5. Unsupported types (`update_dispatch_policy`,
   `merge_into_existing_cue`, `split_cue`, `update_risk_level`,
   `publish_schedule`, `rollback_schedule`) flip to `approved`
   with admin-visible "manually edit via Cue Board" reason.
6. LLM call uses registered `cue-auto-editor` prompt template v1
   through the gateway prompt engine.

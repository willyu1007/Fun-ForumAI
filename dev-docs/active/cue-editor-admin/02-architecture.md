# 02 Architecture — cue-editor-admin (T-210)

This document records the architecture decisions, data flow, and validation contracts that underpin the Cue Editor Admin code. It is the SSOT for in-bundle decisions deferred from `00-overview.md` (`risks` §94 dot-path semantics, approval flow, preview chain, audit surface).

Bundle scope, gates, frozen fields, and acceptance criteria stay in `00-overview.md`. This file is for **how**, not **what**.

**Revision log**:
- 2026-04-26 (initial M0 spec). DEC-A/B/C confirmed.
- 2026-04-26 (post-implementation audit). Three corrections folded in: (a) atomicity guarantee re-stated as compensating rollback rather than `prisma.$transaction` to match shipped code (§4.2). (b) `publishCue` uses `change_type='update_cue'` with `transition.kind='publish_cue'`, NOT `publish_schedule` — closes a semantic-drift risk vs the umbrella schedule lifecycle (§4.2 note). (c) `InMemoryCueRepository` clones on read to align with PG semantics and remove a reference-aliasing trap that masked transition.from in the audit chain (§4.2 repo-layer note).

---

## 1. Bundle decisions (DEC-T210-A/B/C — confirmed with user 2026-04-26)

### DEC-T210-A — Approval state for manual edits

| Path | Initial `CueChange.approval_status` | Rationale |
|---|---|---|
| Manual edit (this bundle) | `auto_applied` | Admin holds `edit_programming_draft` / `publish_programming_schedule` — the act of submitting through the editor is itself the approval. Adding a second approve step would create no incremental safety in MVP and would block single-admin deployments. |
| Auto-editor patch (T-214) | `pending` | Auto-editor outputs are unattended; T-214 inbox + `approve_programming_change` permission is the gating layer. |

`approval_status` is a `CueChangeApprovalStatus` enum from T-209's migration. T-210 only writes `auto_applied`; T-214 writes `pending` and transitions to `approved` / `rejected` via the inbox.

`CueChange.actor_user_id` populates with `req.user.userId` for manual paths. `actor_system` stays null. (Auto-editor will be reverse — T-214.)

### DEC-T210-B — `locked_fields` dot-path semantics

`locked_fields: string[]` carries dot-paths. Match rule:

> A patch is **rejected** for a locked path `L` iff the patch causes **a leaf value at `L` or below `L`** to change.

- Path syntax: `'scene_constraints.allowed_scene_families'`, `'theme_intent.tone_band'`, etc. Top-level key like `'scene_constraints'` locks the entire subtree.
- **Parent locks child** (precedence): `lockedPaths=['scene_constraints']` blocks any patch that changes any descendant. `lockedPaths=['scene_constraints.allowed_scene_families']` blocks only changes at that specific subtree.
- **Sibling paths are independent**: locking `scene_constraints.allowed_scene_families` does NOT block edits to `scene_constraints.preferred_scene_family`.
- `removed_fields[]` entries are validated as top-level keys (CuePatchV1's `removed_fields` is whitelisted to top-level partial keys per [cue-patch.ts:147](src/backend/programming/cue/cue-patch.ts:147)). Treated as path = the entry string; same prefix rule applies.

**Diff semantics** (because `applyCuePatch` shallow-merges per [cue-patch.ts:175](src/backend/programming/cue/cue-patch.ts:175)): when `patch.partial.X` is supplied as an object, the merge **replaces** the whole `X`. So the validator must compare `oldCue.X` (current state, deep) vs `patch.partial.X` (new state, deep) to find which leaf paths under `X` actually changed. Only changed leaves count as "touched"; supplying a structurally-equal object does not trip a lock.

Arrays compare with deep equality (no index-level diff in MVP). Replacing `allowed_scene_families: ['a','b']` with `['a','b']` is a no-op, with `['a','b','c']` is a change.

`removed_fields` always counts as a change at the listed key path.

This semantic is symmetrical for manual (T-210) and auto-editor (T-214) — same validator file, same rules. Manual paths shouldn't usually trip their own locks (admin who set the lock chooses not to override) but the validator runs regardless to keep T-214 reuse honest.

### DEC-T210-C — Sequencing

T-211 doc-only ships first (2d). T-210 M0 (architecture doc + permission middleware) starts in parallel — they touch disjoint files. T-210 M1–M4 begin once T-211 is approved (the boundary doc unblocks T-212, but T-210 writes against T-209 contracts only, so the gate is operational, not technical).

---

## 2. Layer model (T-210 specific slice)

```
HTTP request
  ↓
requireHumanAuth (existing)
  ↓
requireAdmin (existing)
  ↓
requireProgrammingPermission(perm)  ← NEW (M0)
  ↓
CueEditorService.<mutation>
  ├─ CuePatchV1Schema.parse              ← T-209 SSOT
  ├─ assertNoForbiddenFields              ← T-209 SSOT (FORBIDDEN_CUE_FIELDS)
  ├─ assertLockedFieldsRespected          ← NEW (M1)  — dot-path validator
  ├─ deterministicValidations             ← time bounds, community existence
  ├─ writeCueAndChange (single tx)        ← Cue.upsert + CueChange.create(approval_status='auto_applied')
  └─ emit audit event (forum-event-dispatcher; additive, non-blocking)
  ↓
HTTP response
```

Pre-publish preview chain (M3) reuses the same validators in a non-mutating sequence (see §6).

---

## 3. Permission middleware (M0)

**File**: `src/backend/middleware/require-programming-permission.ts`

### 3.1 Resolution strategy (no schema migration)

Per overview risks §"Permission 列加表 migration": MVP does **not** add a column to `HumanUser`. The mapping is in code:

```ts
// Map JWT/auth role → permission set. Centralized so tests + middleware stay in sync.
function resolveProgrammingPermissions(user: AuthenticatedUser): ReadonlySet<ProgrammingPermission> {
  if (user.role === 'admin') {
    return ADMIN_PROGRAMMING_PERMISSIONS  // all 11 from PROGRAMMING_PERMISSION_LIST
  }
  return EMPTY_PERMISSION_SET
}
```

When a future bundle needs finer-grained per-user permissions (e.g., one admin can `view_programming` but not `publish_programming_schedule`), this resolver gets a column / table read added behind the same signature — no call-site changes.

### 3.2 Middleware signature

```ts
export function requireProgrammingPermission(
  perm: ProgrammingPermission
): RequestHandler
```

- 401 if `req.user` is missing (defense-in-depth; `requireHumanAuth` should run first).
- 403 if `req.user.role !== 'admin'` (defense-in-depth; `requireAdmin` should run first).
- 403 if `resolveProgrammingPermissions(req.user)` does not include `perm`.
- Otherwise `next()`.

The middleware does **not** stand alone: routes mount it as the third gate after `requireHumanAuth, requireAdmin, requireProgrammingPermission(...)`. This keeps existing 401 / 403 semantics on the upstream middlewares unchanged.

### 3.3 Route-permission mapping (frozen)

| Route | Method | Permission |
|---|---|---|
| `/v1/admin/programming/cue-board` | GET | `view_programming` (T-209 — adds gate in M0) |
| `/v1/admin/programming/cue-board/baseline-import` | POST | `edit_programming_draft` (T-209 — adds gate in M0) |
| `/v1/admin/programming/cues` | POST | `edit_programming_draft` |
| `/v1/admin/programming/cues/:id` | GET | `view_programming` |
| `/v1/admin/programming/cues/:id` | PATCH | `edit_programming_draft` |
| `/v1/admin/programming/cues/:id/preview` | POST | `edit_programming_draft` |
| `/v1/admin/programming/cues/:id/publish` | POST | `publish_programming_schedule` |
| `/v1/admin/programming/cues/:id/cancel` | POST | `cancel_scheduled_cue` |
| `/v1/admin/programming/cues/:id/force-skip` | POST | `force_skip_due_cue` |
| `/v1/admin/programming/cues/:id/media` | POST | `manage_programming_media` |
| `/v1/admin/programming/cues/:id/media/:mediaId` | DELETE | `manage_programming_media` |
| `/v1/admin/programming/media-picker` | GET | `manage_programming_media` |
| `/v1/admin/programming/schedule/:id/rollback` | POST | `rollback_programming_schedule` |
| `/v1/admin/programming/audit` | GET | `inspect_programming_audit` |
| `/v1/admin/programming/audit/:changeId` | GET | `inspect_programming_audit` |
| (T-214 inbox; not in this bundle) | — | `approve_auto_patch`, `approve_programming_change` |
| Reserved (not exposed) | — | `require_public_display_media` |

`view_programming` and `inspect_programming_audit` are read paths; the rest are mutations or read-paths gated for sensitive surfaces (media picker shows asset IDs).

---

## 4. Mutation pipeline & approval flow (M1)

### 4.1 `CueEditorService` contract

```ts
class CueEditorService {
  createCueDraft(bundle: CueCreateBundle, actor: CueEditorActor): Promise<{ cue, change }>
  updateCue(cueId: string, rawPatch: unknown, actor: CueEditorActor): Promise<{ cue, change }>
  cancelCue(cueId: string, actor: CueEditorActor, reason?: string): Promise<{ cue, change }>
  forceSkipCue(cueId: string, actor: CueEditorActor, reason?: string): Promise<{ cue, change }>  // gated by force_skip_due_cue
  attachCueMedia(cueId: string, input: AttachMediaInput, actor: CueEditorActor): Promise<{ media_id, change }>
  removeCueMedia(cueId: string, mediaId: string, actor: CueEditorActor): Promise<{ removed, change }>
  publishCue(cueId: string, actor: CueEditorActor): Promise<{ cue, change }>     // draft / validated → scheduled
  rollbackSchedule(scheduleId: string, actor: CueEditorActor, summary?: string): Promise<{ schedule, change }>
}
```

`updateCue` accepts `unknown` because routes pass through whatever the client sent — the service runs `CuePatchV1Schema.parse` internally and surfaces structured `ValidationError`. Read paths (cue detail, audit list, media picker) live on the route layer directly against `CueRepository` / `MediaAssetRepository` (see [admin-cue-routes.ts](src/backend/routes/admin/admin-cue-routes.ts)); the service stays write-only so future call sites can rely on a single mutation seam.

### 4.2 Atomicity (best-effort + compensating rollback)

Every mutation method:

```ts
// 1. Validate (Zod schema, forbidden, locked, deterministic)
// 2. Compute next-state cue
// 3. repo.updateCue / setCueStatus / attachMedia / removeMedia
// 4. recordChangeWithRollback({
//      previousCueState,        // pre-mutation snapshot
//      currentCueState,         // post-mutation state
//      input: { source: 'manual', approval_status: 'auto_applied', ... }
//    })
//    └─ if recordChange throws, restore previousCueState via setCueStatus + updateCue
// 5. Return { cue, change }
```

The repository interface does not expose a transaction primitive in MVP; we use **compensating rollback** rather than `prisma.$transaction`. Tradeoffs:
- **In-memory** (test path): operations are synchronous, rollback is a no-op for the success path and restores prior state on `recordChange` failure.
- **Postgres** (production path): the cue mutation and change-row write are two separate DB calls. If `recordChange` fails, the rollback runs `setCueStatus` + `updateCue` to restore — best-effort, with `console.error` if rollback itself fails. A future hardening pass can wrap repo operations in a tx-aware seam (`CueRepository.withTransaction`) without changing the service contract.

**Repo-layer clone-on-read** (added 2026-04-26 audit fix). `InMemoryCueRepository.findCueById / setCueStatus / updateCue / createCue / list*` return cloned domain objects rather than internal Map references. This aligns the in-memory contract with `PgCueRepository` (which already builds fresh objects on every call) and removes a subtle reference-aliasing trap where `transition.from` could read post-mutation state through a captured reference. See `src/backend/repos/cue-repository.ts:cloneCueDomain`.

**No mutation path bypasses the change row**: cancel, force-skip, media attach/remove, publish — every state transition produces a `PublicDiscussionCueChange` entry.

`change_type` values used (sourced from T-209's frozen migration enum):

| Service method | `change_type` | `patch_json.transition.kind` (where applicable) |
|---|---|---|
| `createCueDraft` | `create_cue` | — |
| `updateCue` | `update_cue` | — (patch carried in `patch_json`) |
| `cancelCue` | `cancel_cue` | `cancel` |
| `forceSkipCue` | `cancel_cue` | `force_skip` |
| `attachCueMedia` | `attach_media` | — |
| `removeCueMedia` | `remove_media` | — |
| `publishCue` (cue-level draft → scheduled) | **`update_cue`** | **`publish_cue`** — see note below |
| `rollbackSchedule` | `rollback_schedule` | — |

> **Note on cue-level publish**: T-209 froze the `change_type` enum without a `publish_cue` value. The enum's `publish_schedule` is reserved for genuine schedule-level publish (which T-210 MVP does not ship). Recording cue-level publish as `update_cue` with `patch_json.transition.kind === 'publish_cue'` keeps the enum honest, lets T-215 audit projection distinguish single-cue activations from schedule releases, and avoids re-opening T-209's migration. See `src/backend/services/cue-editor-service.ts:publishCue`.

### 4.3 Failure modes
- Validation rejection → 400 with structured error (which validator + which path / field). Schema-layer rejection is the first; locked-field is second; deterministic is third. Errors short-circuit at the first failure (no partial errors aggregation in MVP — keeps client UX simple).
- Persistence failure → tx rollback; nothing written.
- Concurrent edit (optimistic lock collision) → 409 with retry guidance; UI surfaces server error per overview deferred-question 5. No silent merge.

### 4.4 Audit emit
After tx commit, an additive audit event posts to `forum-event-dispatcher` (existing) with a new `event_type: 'PROGRAMMING_CUE_CHANGE'`. Non-blocking (failure logs but does not roll back the change). Existing consumers ignore unknown types; no subscriber changes.

---

## 5. Validators

### 5.1 Forbidden-field validator (reused, no new code)

Source: [cue-patch.ts:33](src/backend/programming/cue/cue-patch.ts:33) `FORBIDDEN_CUE_FIELDS`. Schema-layer rejection happens inside `CuePatchV1Schema.superRefine`. The server-side backstop runs the same `isForbiddenCueField` check on every key in the parsed `partial` and `removed_fields`, both for redundancy and so the rejection error path is consistent (the schema would have already caught it; the server check is the I-might-be-bypassed-by-a-future-shortcut backstop).

### 5.2 Locked-fields validator (NEW, M1)

**File**: `src/backend/programming/cue/locked-fields-validator.ts`

```ts
export interface LockedFieldsViolation {
  patchPath: string
  lockedBy: string
}

export function validateLockedFields(input: {
  oldPartial: PartialPublicDiscussionCue
  patch: CuePatchV1
  lockedPaths: readonly string[]
}): LockedFieldsViolation[]
```

- Returns empty array if no violations.
- Returns one entry per (changed-leaf-path × locking-path) pair when violations exist.
- Implementation:
  1. Build the **changed leaf-path set** from the patch:
     - For every top-level key `K` in `patch.partial`: deep-diff `oldPartial[K]` vs `patch.partial[K]` to enumerate changed leaf paths under `K`. Primitives / arrays compare via deep-equal at the value level (not index). If `oldPartial[K]` is undefined and patch supplies `K`, all leaves under `K` are "changed".
     - For every entry `R` in `patch.removed_fields`: add path `R`.
  2. For each changed leaf-path `P` and each locked path `L`:
     - Match if `P === L` or `P.startsWith(L + '.')`. (Parent `L` covers child `P`.)
     - Also match if `L.startsWith(P + '.')`. (Patching parent `P` always touches child leaves; a deeper lock under that parent must trip even if the diff happened to only enumerate the parent. This is the "child-lock-blocks-parent-rewrite" arm.)
  3. Collect (P, L) violations.

Empty `lockedPaths` short-circuits to `[]`.

The validator is **shared** between manual (T-210 service) and auto-editor (T-214). T-214 will import this exact module. No separate validator class.

### 5.3 Deterministic validator (M1)

```ts
export function validateDeterministic(input: {
  cue: PartialPublicDiscussionCue
  cueId?: string
  scheduleId: string
  context: { now: Date; activeCommunityIds: ReadonlySet<string>; scheduleBoundary: { from: Date; to: Date } }
}): DeterministicViolation[]
```

Checks:
- `trigger_at` (if supplied) is in the future from `now`, and within `scheduleBoundary`.
- `community_id` is in `activeCommunityIds`.
- `prewarm_at < trigger_at`, `latest_start_at >= trigger_at`, `expire_at >= trigger_at` (when supplied).
- `risk_level` is one of the allowed enum values (Zod already enforces; second-line backstop).
- `priority` is in `[0,100]` (Zod backstop).
- `media_policy` references existing `MediaAsset` IDs (when this validator is used in mutation paths; preview path also runs §5.4 picker filter).

These checks are intentionally local to the cue document; the load and director-compile previews live in §6.

### 5.4 Picker filter (M2)

The media picker query — both server endpoint and preview validator — applies this filter SSOT:

```ts
function isPickableForCommunity(asset: MediaAsset, communityId: string): boolean {
  return (
    asset.lifecycle_status === 'active'
    && hasCurrentSnapshot(asset)
    && isStorageReadable(asset)
    && visibilityAllows(asset, { context: 'public_discussion_cue', communityId })
    && !asset.reuse_governance_blocked
    && !asset.duplicate_suppressed
    && (asset.private_pool === false || asset.projected === true)
  )
}
```

Concrete predicates resolve against existing media services (`media-asset-repository`, `media-context-projection`, etc. — bound in M2). The frontend picker UI only displays items that pass this filter (for visual consistency); the server endpoint enforces it as ground truth (the backstop). M3 preview re-runs the same predicate against currently selected assets.

---

## 6. Pre-publish preview chain (M3)

### 6.1 Endpoint

`POST /v1/admin/programming/cues/:id/preview`. Request body: the in-flight editing state (a `CuePatchV1` plus optional metadata; same shape that would be submitted via `PATCH`).

Response:
```ts
type PreviewResponse = {
  stages: PreviewStage[]
  overall: 'ok' | 'has_warnings' | 'has_errors'
}

type PreviewStage = {
  stage: 'schema' | 'deterministic' | 'load' | 'media' | 'director_compile'
  status: 'ok' | 'warning' | 'error'
  payload: unknown  // stage-specific shape
  source?: 'stub_until_t212' | 'stub_until_t213'  // present only when stub
}
```

### 6.2 Stage chain (sequential, short-circuit on `error`)

1. **schema** — `CuePatchV1Schema.parse(body.patch)`. Failure → status `error`, payload `{ issues: ZodIssue[] }`. Stops chain.
2. **deterministic** — runs §5.1 + §5.2 + §5.3 in order. Any rejection → status `error`. Stops chain.
3. **load** — calls `LoadSignalService.get(communityId, triggerAt)`. **Until T-213 ships**, the call resolves through a stub at `src/backend/services/__stubs__/load-signal-service-stub.ts` returning `{ status: 'green', source: 'stub_until_t213' }`. Stage status = `ok` always. T-213 swap point is a single import in T-210's preview controller.
4. **media** — re-runs the §5.4 picker filter against the cue's currently attached media (`cueRepo.listMediaForCue(cueId)`, joined to `mediaAssetRepo.findById(assetId)` per item). Any asset that no longer passes → stage status `warning` (does not stop chain), payload `{ attached_count, rejected: [{ asset_id, reasons[] }] }`. Zero attached media is acceptable (`status: 'ok'`).
5. **director_compile** — calls `DirectorCueBrief.compile(cue, { dryRun: true })`. **Until T-212 ships**, stub at `src/backend/services/__stubs__/director-cue-brief-stub.ts` returning `{ status: 'preview_unavailable', source: 'stub_until_t212' }`, surfaced as stage status `ok` with `source: 'stub_until_t212'`. UI renders an info banner explaining "available after T-212 ships".

**Stub module path discipline** (matches T-212 §"Stub ownership"): the stub files live at the same module path the real services will occupy. T-212 / T-213 each replace the stub with the real implementation; T-210's preview controller imports change zero lines.

`overall` is computed as max-severity across stages: any `error` → `has_errors`, else any `warning` → `has_warnings`, else `ok`. Frontend shows accordion per stage; admin can publish even with warnings (decision recorded in audit event metadata).

---

## 7. Editor UI shape (M2)

### 7.1 Routing

- `/admin/programming/cues` — board (existing, T-209 read-only)
- `/admin/programming/cues/:id` — detail editor (M2)
- `/admin/programming/audit` — audit list (M4)
- `/admin/programming/audit/:changeId` — single change diff view (M4)

### 7.2 Component tree

```
AdminPanel
└── /admin/programming/cues
    ├── CueBoardTab (T-209; gain "edit" affordance per row → opens detail)
    └── /:id  CueDetailEditor (M2)
        ├── BasicSection
        ├── ThemeSection
        ├── SceneSection
        ├── RoleSection
        ├── MediaSection
        │   └── MediaPickerDialog
        ├── RuntimeSection
        │   └── LockedFieldsEditor
        ├── PreviewPanel (M3)
        └── PatchDiffPanel
```

`PatchDiffPanel` and `LockedFieldsEditor` are reusable components — the audit list (M4) reuses `PatchDiffPanel` to show single-change history, and T-214 inbox UI will reuse it again.

### 7.3 Forbidden inputs (UI hard wall)

The editor renders **no input controls** for any field in `FORBIDDEN_CUE_FIELDS`. The schema layer would reject anyway; the UI omission is the first line of defense and prevents accidental submissions in case of dev bypass. Visible categories: Basic / Theme / Scene / Role / Media / Runtime — verbatim per overview §2.

`require_public_display`, `usage_strength = anchor`, `usage_strength = selected_only_pool` are not rendered as options (D-11; T-216 M3 reopens). The `usage_strength` dropdown shows only `optional` and `preferred`.

---

## 8. Audit chain UI (M4)

`GET /v1/admin/programming/audit?cue_id=&schedule_id=&actor_user_id=&limit=` returns `PublicDiscussionCueChange` rows newest-first as `{ items, total }`. Either `cue_id` or `schedule_id` is required (the endpoint refuses both being absent). Permission gate: `inspect_programming_audit`.

MVP UI lives inline inside `CueDetailEditor` (Section "审计日志"); a dedicated `/admin/programming/audit` page with cross-cue navigation is deferred to T-215. Each row renders via `PatchDiffPanel`. Rollback affordance is exposed at the schedule level only (`/v1/admin/programming/schedule/:id/rollback`); cue-level rollback (re-publishing a prior revision) is a follow-up.

Time-range filters (`from` / `to`) and the per-change detail endpoint `/audit/:changeId` are deferred — current callers only need cue-scoped or schedule-scoped recent history. T-215 will extend the read model with the broader filters when public actuals ship.

---

## 9. Rollout & feature flag

A single feature flag `programming.cue_editor_enabled` (config — likely an env var since the codebase does not have a flagging service yet) controls:
- Mounting of `admin-cue-routes.ts` in the Express app
- Showing the "Edit" affordance on `CueBoardTab`
- Showing the audit menu item

When `false`, the system reverts to T-209 read-only state. DB rows already written stay; the read service ignores them as expected (cues with `status='draft'` are visible to admin but cannot be advanced). No rollback migration is needed for T-210.

---

## 10. Test surface (drives M4 acceptance)

Tests are split per layer rather than aggregated into a single integration file, mirroring existing repo conventions:

| File | Layer | Coverage |
|---|---|---|
| `src/backend/middleware/__tests__/require-programming-permission.test.ts` | middleware | 401/403 gating, admin-vs-user permission resolution, defense-in-depth ordering. |
| `src/backend/programming/cue/__tests__/locked-fields-validator.test.ts` | validator | Exact-match, parent-covers-child, child-blocks-parent-rewrite, sibling-independence, `removed_fields`, deep-equal array semantics, multi-lock interaction, primitive vs object change paths. |
| `src/backend/services/__tests__/cue-editor-service.test.ts` | service (in-memory repo) | All 8 mutation methods + the 21 forbidden fields × 2 layers (schema + server backstop) + DEC-T210-A approval-status assertion + DEC-T210-B locked-fields enforcement on real edits + D-11 anchor / `selected_only_pool` / `require_public_display` rejection + `removed_fields` clearing semantics + ConflictError on non-editable status. |
| `src/backend/services/__tests__/media-picker-service.test.ts` | service | `isPickable` predicate (lifecycle / storage / visibility) + list pagination + limit cap. |
| `src/backend/services/__tests__/cue-preview-service.test.ts` | service | 5-stage chain happy path, schema short-circuit, deterministic short-circuit (locked + past trigger_at), media stage warning aggregation. |
| `src/backend/routes/__tests__/admin-cue-routes.test.ts` | route (supertest) | Permission gates per endpoint, full lifecycle through Express, anchor / forbidden rejection at HTTP boundary. |
| `src/backend/routes/__tests__/e2e-cue-editor-lifecycle.test.ts` | **closure smoke test** | One single test walks: 403 → create → update → lock → reject locked update → attach media → preview-blocked → preview-clean (5 stages with stub markers) → publish → cancel → audit (6 newest-first rows). Asserts every audit discriminator including `transition.kind='publish_cue'` and `transition.from='scheduled'`. |
| `src/backend/runtime/__tests__/post-scheduler-cue-isolation.test.ts` | **T-211 invariant** | Grep-asserts that `post-scheduler.ts` and `runtime-loop.ts` contain none of 14 cue-domain tokens. Locks I-2 pre-T-212. |

Acceptance: every checkbox in `00-overview.md §"Acceptance criteria"` maps to a concrete assertion in the table above; the closure smoke test is the integration backstop.

---

## 11. Cross-references

- Umbrella `02-architecture.md` §2 (invariants), §3 (forbidden fields), §4.3 (`CuePatchV1`), §5 (audit chain).
- T-211 `02-architecture.md` §C.1 (`community-budget-service` interface — relevant to T-213's preview-time stub bound check; T-210 itself does not call `community-budget-service`).
- T-212 `00-overview.md` §"Stub ownership" — same stub discipline pattern used by §6.
- [cue-patch.ts](src/backend/programming/cue/cue-patch.ts) — reused validators.
- [permissions.ts](src/backend/programming/cue/permissions.ts) — reused permission constants.
- [admin-cue-board-routes.ts:23](src/backend/routes/admin/admin-cue-board-routes.ts:23) — pattern for `requireHumanAuth + requireAdmin`; M0 adds `requireProgrammingPermission`.
- [human-auth.ts](src/backend/middleware/human-auth.ts) — `AuthenticatedUser` type and existing middleware contract.

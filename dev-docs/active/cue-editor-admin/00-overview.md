# 00 Overview — cue-editor-admin (T-210)

## Status
- State: planned
- Parent: `T-207 admin-auto-programming`
- Phase: **2** of 6
- Type: code (admin UI + validation)
- Estimate: 7-10 days

## Goal
Turn the read-only Cue Board (T-209) into a real **editing console**. Admins can create, edit, defer, cancel, attach media, and lock fields on a cue; every action produces a `CueChange (source='manual')` row and goes through the same validation / forbidden-field check that auto-editor patches will use later.

## Non-goals
- No allocator / runtime integration (T-212).
- No auto-editor (T-214).
- No agent picker, no post-body editor, no expected-output editor — these are forbidden (umbrella §3).
- No `usage_strength = 'anchor' | 'selected_only_pool'` UI affordance. T-216 unlocks it.
- No `require_public_display` UI affordance.

## Handoff contract

### 1. Input contract
- T-209 schema deployed; `CuePatchV1` validator importable.
- Read-only Cue Board route in place.
- **External dependency** (existing repo): `MediaAsset` / `MediaSemanticSnapshot` / `SceneMediaBinding` / `MediaContextProjection` tables and services readable by admin server context. Picker reads only — no writes to these tables.
- **External dependency**: existing `forum-event-dispatcher` accessible for admin mutation event fan-out (e.g., audit events).
- **External dependency**: existing user / role table and auth middleware support custom permission strings (the 11 permissions added in this bundle's output).

### 2. Output contract
- Cue Detail Editor admin route with sections per design-doc §7.3:
  - Basic: community / scope, trigger time, timezone, lane, priority, risk level
  - Theme: topic seed, discussion question, angle hint, tone band, public context refs
  - Scene: allowed scene families, preferred scene family, tension range, privacy / continuity / fatigue policies
  - Role: role requirements vector, relationship shape, novelty preference
  - Media: selected assets via picker (read-only `MediaAsset / SceneMediaBinding`), role, usage_strength (only `optional` / `preferred` exposed in MVP), use_policy (only `runtime_only` / `prefer_runtime_context` / `prefer_public_display` / `allow_generated_derivative` exposed; `require_public_display` hidden)
  - Runtime: dispatch policy, admission policy, load policy, locked fields
- Patch diff UI: shows before / after, source (manual), actor user id, validation status, approval status, applied_at, rollback affordance
- **Pre-publish preview chain** (design doc §7.5): editor invokes the following chain before submit; each stage's result is shown as a dismissible warning:
  - schema validation (Zod)
  - deterministic validation (forbidden fields, locked fields, time bounds, community existence)
  - **load preview** — calls `LoadSignalService.get(communityId)` (T-213; before T-213 ships, returns stub `green`); shows projected admission outcome at `triggerAt`
  - media validation — re-runs picker filter against current `MediaAsset` state
  - **director compile preview** — calls `DirectorCueBrief.compile(cue, dryRun=true)` (T-212 endpoint); shows the brief shape admin would otherwise never see; helps catch overlay schema mismatches at edit time. Before T-212 ships, this preview is a stub returning a static "preview unavailable" notice
  - submit / publish
- Locked fields UI: admin can mark a field as locked; auto-editor patches that touch a locked field fail validation (auto-editor itself ships in T-214; this validator landscape is staged here)
- Forbidden-field hard validation:
  - schema-layer rejection (Zod) before any DB write
  - server-side validator on the mutation API endpoint
  - both reference umbrella §3 as single source
- **Permission model** (design doc §17.3) — full set defined here as the first user-facing surface; downstream sub-bundles import:
  - `view_programming` — read Cue Board (T-210 enforces; T-215 reuses for public actuals view)
  - `edit_programming_draft` — create / update / cancel cue draft (T-210)
  - `publish_programming_schedule` — flip schedule from `draft → published` (T-210)
  - `approve_programming_change` — approve any pending `CueChange` (T-210 + T-214 inbox)
  - `approve_auto_patch` — approve auto-editor patches (T-214 reuses)
  - `manage_programming_media` — operate the media picker (T-210; T-216 M3 also gates `anchor` / `selected_only_pool`)
  - `require_public_display_media` — set `require_public_display` policy (reserved permission; **not exposed in MVP** per umbrella D-11; placeholder defined here so future T-216 follow-up can grant)
  - `cancel_scheduled_cue` — cancel a `scheduled` cue before triggerAt (T-210)
  - `force_skip_due_cue` — force-skip a `due` or `executing` cue (T-210; coordinates with T-212 cancel-during-executing semantics, see G11 below)
  - `rollback_programming_schedule` — create a rollback schedule version (T-210)
  - `inspect_programming_audit` — view audit chain UI per umbrella §5 (T-210 base; T-215 actuals dashboard)
  - permissions stored as a single enum in `src/backend/programming/permissions.ts`; downstream bundles **must not** define new programming permissions without re-opening this bundle

### 3. Gate condition (for downstream)
T-212 (`cue-worker-runtime`) gate condition that depends on this bundle:
- Editor mutations produce `PublicDiscussionCue` rows that conform to `CuePatchV1` and the forbidden-field rule.
- `locked_fields` enforcement is observable (a manual patch that violates locked fields is rejected with reason).

### 4. Frozen fields
- Cue editor input schema (the union of editable shapes per design-doc §5)
- Patch diff representation (used by T-214 auto-patch inbox UI later)
- Locked-fields validator semantics

### 5. Deferred questions
- **Auto-patch inbox UI** — same patch diff component will be reused; built in T-214.
- **Bulk publish / approval workflow** — MVP supports single cue lifecycle; bulk operations deferred to a follow-on.
- **`usage_strength = 'anchor' | 'selected_only_pool'`** — T-216 M3 exposes admin UI.
- **`require_public_display`** — explicit scope-out per umbrella decision D-11.
- **Multi-admin concurrent edit** (optimistic lock collision UX) — MVP shows server error; better UX deferred.

## Acceptance criteria
- [ ] Cue Detail Editor renders for a draft cue and a scheduled cue.
- [ ] Manual create produces a `CueChange (source='manual', change_type='create_cue')` row.
- [ ] Manual edit produces a `CueChange (source='manual', change_type='update_cue')` row with `patch_json` matching `CuePatchV1`.
- [ ] Cue cancel / defer / attach-media / remove-media each produce the corresponding `CueChange.change_type`.
- [ ] Forbidden-field probe: a synthetic patch carrying any §3 field is rejected at both schema and server.
- [ ] Locked field probe: a patch attempting to overwrite a locked field is rejected with explicit reason.
- [ ] No mutation paths that bypass `CueChange` recording (verified by code review + integration test).
- [ ] Media picker only surfaces `MediaAsset` rows passing the design-doc §7.4 filter (active, current snapshot, storage readable, visibility allows current use, no reuse-governance block, no duplicate suppression, no private-pool unless projected).

## Risks
- **Editor surface bloat into "soft CMS"**. Mitigation: explicit forbidden field list in UI (no input controls for any §3 field); schema-layer rejection backstop.
- **Picker exposes restricted media**. Mitigation: server-side filter mirrors UI filter; media-governance integration tests on every picker query.
- **Locked-field policy ambiguity** for partial structures (e.g., locking `scene_constraints.allowed_scene_families` vs the whole `scene_constraints`). Mitigation: dot-path locking with explicit precedence; documented in `02-architecture.md` when this bundle starts implementation.

## Cross-references
- Umbrella `02-architecture.md` §3 (Forbidden fields), §4.3 (`CuePatchV1`)
- Source design doc §5 (Editable / non-editable boundary), §7 (Admin editing flow)
- Existing media governance: `src/backend/media/`

# 00 Overview — cue-auto-editor (T-214)

## Status
- State: done
- Parent: `T-207 admin-auto-programming`
- Phase: **5** of 6
- Type: code (trigger detector + load gate + LLM patch + admin inbox)
- Estimate: 7-10 days
- Completed: 2026-04-27
- Outcome: Trigger detector, load gate, LLM adapter, scheduler, pending inbox, admin approve/reject UI, approved-patch apply service, single-row audit, callsite inventory entry, and `cue-auto-editor` prompt template v1 are implemented. Runtime still uses `director_plan` dual-track routing; dedicated `cue_auto_edit` intent remains an LLM hardening follow-up. See `03-implementation-notes.md` and `04-verification.md`.

## Goal
Add an **automated cue editor** that observes the live forum / community / load state, generates structured `CuePatchV1` patches via an LLM call, and surfaces them in an admin inbox. MVP ships **zero auto-apply** — every auto patch enters the inbox for human approval. The auto editor is held to the same `CuePatchV1` schema and forbidden-field rules as the manual editor.

## Non-goals
- No auto-apply for low-risk patches in MVP (deferred per umbrella decision D-12).
- No editing of autonomous-path behavior — the auto editor never patches PostScheduler tick state (invariant I-6).
- No cross-community cue / callback (design-doc open question 8 deferred).
- No new LLM provider; uses existing routing.

## Handoff contract

### 1. Input contract
- T-213 admission decision table stable; trigger detector mirrors load logic.
- T-212 cue worker writes `CueExecutionAttempt` actuals so trigger detector has signals.
- T-210 admin patch diff component reusable in inbox UI.

### 2. Output contract
- `TriggerDetector` service:
  - subscribes to `forum-event-dispatcher` events (post created, thread opened, vote cast, etc.)
  - runs scheduled scans for `COMMUNITY_LULL`, `SUPPLY_FLOOR_GAP`, `EVENING_DISCUSSION_GAP`, `FATIGUE_HIGH`, `MEDIA_OPPORTUNITY`, `GLOBAL_RUNTIME_IDLE`, etc. (full list in design doc §8.3)
  - emits `TriggerEvent` records with `trigger_type`, `severity`, `evidence`, `community_id`
- `LoadGate` (deterministic, pre-LLM):
  - consumes `LoadSignalService` (T-213, cached snapshot)
  - decides `allowed_actions: CueChangeType[]` per design doc §8.4
  - blocks LLM call if `red` state and trigger does not allow `defer / merge / cancel / propose_only`
- `AutoCueEditor` (LLM-backed):
  - input: `AutoCueEditorInput` (trigger evidence, load state, allowed actions, current schedule summary, upcoming cues, supply state, fatigue summary, runtime capacity forecast, **filtered** media candidates from media library)
  - output: structured `AutoCueEditorOutput` with `action`, `reason`, `risk_level`, `target_cue_id?`, `patch_json: CuePatchV1`, `confidence`, `requires_review`
  - validator rejects: forbidden fields (umbrella §3), unauthorized media asset ids (must be from input candidate list), patch attempts on locked fields
- `RiskClassifier`:
  - low risk = grace adjustment, defer background cue, remove invalid media, runtime-only media attach
  - standard risk = new normal cue, theme intent change, scene family change
  - high risk = real hot-topic, sensitive public issue, public-display media, prime cue cancel, large evening structure change
- `AutoPatchInbox`:
  - admin UI listing patches with full diff (reusing T-210 diff component)
  - approve / reject / amend & approve flows
  - all approvals produce a `CueChange (source='automated', approval_status='approved', actor_user_id=<approver>)` row
  - all rejections produce a `CueChange (source='automated', approval_status='rejected', reason=...)` row

### 3. Gate condition (for downstream)
- T-216 M2 / M3 may run in parallel if media policy doesn't conflict with auto-editor's media reasoning surface.
- Umbrella e2e verification can include an auto-editor scenario after this bundle.

### 4. Frozen fields
- `TriggerEvent` schema (any new trigger type is additive)
- `AutoCueEditorOutput` schema
- Risk level enum
- Inbox approval state machine

### 5. Deferred questions
- **Auto-apply policy** — MVP zero auto-apply. Deferred to a follow-on after baseline inbox data exists.
- **LLM model selection / voice line** — defer to this bundle's `02-architecture.md` (umbrella U-2). Likely uses an existing hidden lane.
- **Trigger detector observability** — number of triggers per detection cycle, false-positive rate. Defer to T-215 dashboards.
- **Cross-community signals** (e.g., global LLM queue depth tipping all communities to yellow): MVP detects globally via `LoadSnapshot.global_state` only.

## Acceptance criteria
- [x] `TriggerDetector` produces a `COMMUNITY_LULL` event when a community has no public root post in 60 minutes during configured prime hours.
- [x] `LoadGate` blocks LLM call under `red` global state and emits a `defer / propose_only` allowed-actions response.
- [x] `AutoCueEditor` produces a valid `CuePatchV1` for a synthetic `COMMUNITY_LULL` trigger; output passes validator.
- [x] Probe: `AutoCueEditor` output containing `agent_ids`, `must_hit_points`, or any §3 field is rejected at validator.
- [x] Probe: `AutoCueEditor` output referencing a media `asset_id` not in the input candidate list is rejected.
- [x] Inbox displays the patch with full diff; admin can approve / reject; resulting `CueChange` row carries correct `source`, `approval_status`, `actor_user_id` / `actor_system`.
- [x] No unreviewed auto-apply path executes in MVP; approved rows apply only after admin approval.
- [x] Invariant I-6 verification: no `AutoCueEditor` output references autonomous-path semantics or PostScheduler state.

## Risks
- **LLM goes off-schema** even with structured output. Mitigation: dual validator (Zod + forbidden-field list); reject + log + retry with reduced temperature; max 2 retries before escalation.
- **Trigger storm** — many triggers fire simultaneously. Mitigation: per-community + global rate limit on detector; coalesce identical triggers in same window.
- **Inbox backlog** — admin can't keep up. Mitigation: P1 = surface high-risk first; P2 = defer-to-tomorrow batch action.
- **Auto-editor reasoning leaks into post body** despite forbidden-field block. Mitigation: forbidden-field check is structural, not semantic; safety profile / privacy boundary remain on the cue itself, not derivable from LLM output.

## Cross-references
- Umbrella `02-architecture.md` §2 (invariant I-6), §3 (Forbidden fields)
- Source design doc §8 (Auto editor link)
- T-210 patch diff component (reused)
- T-213 `LoadSignalService` (consumed)
- T-212 `CueExecutionAttempt` actuals (consumed as detector signal)

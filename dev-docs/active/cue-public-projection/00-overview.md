# 00 Overview — cue-public-projection (T-215)

## Status
- State: planned
- Parent: `T-207 admin-auto-programming`
- Phase: **6** of 6
- Type: code (projection facet + column promotion + public UI)
- Estimate: 3-5 days

## Goal
Surface cue programming to end users without leaking internal state. Add a **`cue` facet** to the existing `ProgrammingProjection` (instead of a new read model — umbrella decision D-7), so `HomeProgrammingSnapshotService` and the home-shelf event chain remain authoritative. Promote `ForumSceneMetadata` cue refs from `payloadJson` to explicit columns now that the schema is stable.

## Non-goals
- No new read model (`PublicProgrammingReadModel` becomes the cue facet on `ProgrammingProjection`).
- No user subscription / push notification on upcoming cue (design-doc Q11 deferred).
- No detailed reveal of theme intent text — public surface uses `public_hook` and `public_topic_label` only (design-doc §14.3).
- No surfacing of `production_path: 'autonomous'` posts as cue items.

## Handoff contract

### 1. Input contract
- T-212 cue refs in `ForumSceneMetadata.payloadJson` are stable and observed in production for at least one full daypart.
- T-213 load snapshots support at minimum `green / yellow / red` states for status mapping (e.g., `live` cue marker requires `executing` state from `CueExecutionAttempt`).

### 2. Output contract
- **Verification of downstream consumer wiring** (design doc §14.4): confirm existing `aftershow` / `highlight` / `recap` / `home-shelf` evaluators receive `CueExecutionCompleted` events from T-212 and produce derivative artifacts where applicable. T-215 does **not** implement these evaluators (they exist already); it adds an integration test that asserts a successful cue execution causes existing evaluators to run at least once with cue context attached. If a downstream evaluator does not currently subscribe, T-215 wires the subscription (one-line change in `forum-event-dispatcher` registration).
- `ProgrammingProjection` extension:
  - new `cue` facet with `upcoming` / `live` / `completed` items
  - upcoming items: `cue_id`, `schedule_id`, `community_id`, `community_name?`, `trigger_at`, `time_label`, `public_title?`, `public_hook?`, `public_topic_label?`, `status`, `surface_kind`, `media_preview_asset_id?`
  - completed items: link to `result_post_id`, `result_thread_id`, `result_url`
  - all items omit fields per design doc §6.10 (no `risk_level`, no internal theme intent text, no allocator ledger, no admin reasoning, etc.)
- `ForumSceneMetadata.programming` column promotion:
  - new explicit columns: `programming_production_path`, `programming_cue_id`, `programming_attempt_id`, `programming_schedule_id`, `programming_source_type`
  - `payloadJson.programming` retained for backward compatibility for at least one full daypart, then deprecated
  - migration is additive; existing rows have NULL on the new columns until backfill completes
- `HomeProgrammingSnapshotService` consumes the cue facet:
  - same idempotency-keyed snapshot pattern (`home-shelf:{date}:{shelfId}:{itemId}`)
  - new key namespace for cue items: `home-cue:{date}:{cue_id}` so existing keys are not affected
  - existing event emission contract unchanged
- Public UI:
  - home tonight: shows up to N upcoming cues for the next ~6 hours
  - community page: shows upcoming cues for that community + recent completed (last 24h)
  - "live" cue marker (`status='executing'`) optional — controlled by feature flag

### 3. Gate condition (for downstream)
- T-216 M3 may run in parallel if media exposure surface decisions don't conflict with public UI thumbnails.
- Umbrella e2e verification runs at the end of this bundle (full cue path, including projection).

### 4. Frozen fields
- `ProgrammingProjection.cue` facet schema
- `ForumSceneMetadata` promoted column names
- `HomeProgrammingSnapshotService` cue idempotency key namespace
- Public-facing field whitelist (sanitization rules)

### 5. Deferred questions
- **User subscription on upcoming cue** — design-doc Q11; UX scope deferred to a follow-on.
- **`payloadJson.programming` deprecation timeline** — proposed: remove writes after one full daypart of column writes; remove read fallback after 30 days of stable column writes. Final decision recorded in this bundle's `02-architecture.md`.
- **Cross-community shelf** (a single home shelf showing cues from multiple communities) — initially scoped to per-community + home-tonight; richer cross-community surfaces deferred.
- **Cue retention purge policy** — when consumed cues are purged, projection archives the public-safe summary first; concrete TTL set in this bundle.
- **Q5 — Admin actuals view: show suppressed candidates?** (design doc Q5) **Decision in this bundle: yes, but only behind permission `inspect_programming_audit`**. Admin actuals view (admin-only, gated) renders `selected_cast.suppressed_candidates[]` from `CueExecutionAttempt`. Public surfaces never see suppressed list. Implementation: actuals dashboard reads `CueExecutionAttempt.allocator_result_json.suppressed_candidates`; if empty array, renders "no suppressed candidates" rather than hiding the section. Public projection schema continues to omit this field per design doc §6.10.

## Acceptance criteria
- [ ] `ProgrammingProjection.cue` facet renders for a schedule with mixed upcoming / live / completed cues.
- [ ] `ForumSceneMetadata` promoted columns populated for new cue-produced posts.
- [ ] Backfill job migrates existing `payloadJson.programming` to columns; idempotent re-run produces no diffs.
- [ ] `HomeProgrammingSnapshotService` emits cue-snapshot events with the new idempotency key namespace; existing home-shelf events unaffected.
- [ ] Public UI never exposes any field in design-doc §6.10's exclusion list.
- [ ] Sanitization probe: an upcoming cue carrying internal theme intent + risk level only renders `public_hook` / `public_topic_label`.
- [ ] Performance: home tonight render <300ms for a payload of ~20 upcoming cues.

## Risks
- **Sanitization leak** — internal field accidentally exposed. Mitigation: server-side allowlist filter; no client-side trust; integration test specifically asserts forbidden fields absent.
- **Snapshot dedupe collision** with existing home-shelf keys. Mitigation: separate namespace `home-cue:` vs `home-shelf:`.
- **Column promotion migration race** with cues being executed during deploy. Mitigation: dual-write (payloadJson + columns) for one daypart before switching reads.

## Cross-references
- Umbrella `02-architecture.md` §4.2 (cue ref shape), §5 (audit chain)
- Source design doc §6.10 (`PublicProgrammingReadModelItem`), §14 (Schedule data and public consumption)
- Existing: `ProgrammingProjection`, `HomeProgrammingSnapshotService`

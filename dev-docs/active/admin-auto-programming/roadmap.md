# T-207 — admin-auto-programming Roadmap (umbrella)

## Goal
Establish a `PublicDiscussionCue`-centered programming intermediate layer between admins / auto-editor and the existing director / allocator / runtime, so public discussion cadence becomes editable, auditable, admission-controlled, and load-aware — **without** allowing manual or LLM authority over agent identity, post body, or output expectations.

## Inputs
| Source | Reference | Trust | Notes |
|---|---|---|---|
| User-confirmed design doc | `~/Downloads/admin-auto-programming-design.md` v1.0 | highest | All structural decisions (cue, change, attempt, load, projection) trace here |
| Repo discovery | `src/backend/stage/public-director-contract.d.ts`, `src/backend/allocator/`, `src/backend/runtime/post-scheduler.ts`, `prisma/schema.prisma`, `config/launch/launch_programming_schedule.v1.yaml` | high | Existing director / allocator / room-program / media surface |
| User-confirmed friction-point decisions (Apr 25 chat) | this discussion | highest | 8 decisions: shared contract, attempt+execution merge, baseline-importer shadow path, CuePatchV1 shape, selectFromDiscussionCue, freshness tiering, projection cue facet, media policy split |
| User-confirmed open-question answers (Apr 25 chat) | this discussion | highest | MVP=forum, scope=field, PostScheduler=Option A, media-policy=sub-bundle |

## Non-goals
- No chatroom `RoomProgram` refactor in MVP.
- No PostScheduler replacement.
- No new admin authority over cast / body / output.
- No `require_public_display` media enforcement in MVP. T-216 ships the strict `selected_only_pool` substitute instead.

## Sub-bundle map and sequencing

```
                 [T-208 cue-shared-contract] (Phase 0)
                          │ contract types
                          ▼
                 [T-209 cue-data-and-board] (Phase 1)
                          │ Cue/Schedule/Change/Attempt/Load tables, CuePatchV1, BaselineCueImporter, read-only board
                          ▼
                 [T-210 cue-editor-admin]  (Phase 2)
                          │ admin editor + media picker + locked fields + patch diff
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
        ▼                 ▼                  ▼
[T-211 post-scheduler  [T-212 cue-worker-runtime]    (continues to T-213+)
 -boundary] (Phase 2.5)  (Phase 3, heaviest)
   doc only              CueWorker, Admission,
                         DirectorCueBrief,
                         selectFromDiscussionCue,
                         ForumSceneMetadata refs
                          │
                          ▼
                 [T-213 cue-load-control]  (Phase 4)
                          │
        ┌─────────────────┼──────────────────┬──────────────────┐
        │                 │                  │                  │
        ▼                 ▼                  ▼                  ▼
[T-214 cue-auto-     [T-215 cue-public-  [T-216 cue-media-   (verification)
 editor]              projection]          policy]
 (Phase 5)           (Phase 6)            (M0-M4 sub)
```

### Parallel execution windows
- **W4-5**: T-210 (UI code) ‖ T-211 (boundary doc).
- **W10-11**: T-213 (load control) ‖ T-216 M0/M1 (media strength typing + plan resolution table).
- **W12-13**: T-214 (auto editor) ‖ T-215 (public projection) ‖ T-216 M2 (anchor mode + image-planner derivative).
- **W14**: T-216 M3/M4 (selected_only_pool + admin UI surface + pre-write enforcement) + umbrella-level e2e verification.

### Hard prerequisites
- T-209 must finish before T-210 (DB schema must be stable).
- T-211 must finish before T-212 (boundary doc dictates which downstream services are shared vs forked).
- T-212 must finish before T-213, T-214, T-215, T-216-M1+ (CueWorker is the integration spine).

## Phase summaries

### Phase 0 — `cue-shared-contract` (T-208)
Type-only contract package (`DispatchPolicy`, `AdmissionResult`, `IdempotencyKey` namespace, `SelectionLedger` schema). Both `RoomProgramEvent` (existing) and the future `CueExecutionAttempt` (T-209) will reference these types. **No runtime changes to RoomProgram.**

### Phase 1 — `cue-data-and-board` (T-209)
Prisma migration introduces `PublicDiscussionCueSchedule`, `PublicDiscussionCue`, `PublicDiscussionCueChange`, `PublicDiscussionCueMedia`, `CueExecutionAttempt` (merged attempt+execution), `CommunityRuntimeLoadSnapshot` (with `freshness` field). `CuePatchV1` validator (partial-cue + `removed_fields[]` + version). `BaselineCueImporter` converts `launch_programming_schedule.v1.yaml` → cue draft, **shadow path** (existing `LaunchProgrammingOpsService` untouched). Admin Cue Board renders read-only timeline.

### Phase 2 — `cue-editor-admin` (T-210)
Cue Detail Editor (theme intent, scene constraints, role requirements vector, locked fields). Media picker over existing `MediaAsset / SceneMediaBinding`. Patch diff UI. Forbidden-field hard validation (Appendix B of design doc). Manual change → `CuePatchV1` → `CueChange` row → applied cue.

### Phase 2.5 — `post-scheduler-boundary` (T-211)
**Doc-only**. Inventory of `PostScheduler` actual responsibility (autonomous tick, no DB schedule table, in-memory state, growth-gate-admitted). Defines:
- shared downstream (`publicGrowthGate`, `community-budget-service`, `PublicSceneSelectorService`, `DataPlaneWriter`, `PromptOrchestrator`)
- forked semantics (autonomous vs cue `production_path` field, separate metric tracks)
- anti-double-track invariants (see umbrella `02-architecture.md`).

### Phase 3 — `cue-worker-runtime` (T-212, heaviest)
- `PublicDiscussionCueWorker` with DB lease via `FOR UPDATE SKIP LOCKED`
- `CueAdmissionController` consuming `community-budget-service` + `publicGrowthGate` + live `LoadSnapshot`
- `DirectorCueBrief` injects `EpisodeOverlayV1` overlay through existing `public-director-contract`
- `selectFromDiscussionCue` new method on `PublicSceneSelectorService` (cue → cast vector → allocator → `SelectedCast`)
- `ForumSceneMetadata` carries cue refs via `payloadJson` (column promotion deferred to T-215)
- `production_path: 'cue'` written on `ForumSceneMetadata` for every cue-produced post
- E2E verification: manually authored cue at triggerAt produces a forum post, fully traceable through the audit chain

### Phase 4 — `cue-load-control` (T-213)
- `CommunityRuntimeLoadSnapshot.freshness` enforced
- `AdmissionLoadService` (live, hot path) and `LoadSignalService` (cached, ~30s TTL)
- green/yellow/red state machine + admission decision table
- Cue Board adds load heatmap
- **Includes** `production_path: 'autonomous'` predicted load fed into the same snapshot so admins see total community load, not just cue load (anti-double-track requirement)

### Phase 5 — `cue-auto-editor` (T-214)
- `TriggerDetector` consumes existing `forum-event-dispatcher` events + scheduled scans for `COMMUNITY_LULL`, `SUPPLY_FLOOR_GAP`, `EVENING_DISCUSSION_GAP`, etc.
- `LoadGate` decides `allowed_actions` deterministically before LLM call
- `AutoCueEditor` returns structured `CuePatchV1` (no free-text reasoning, no agent ids, no expected outputs)
- `RiskClassifier` + `AutoPatchInbox` (admin queue)
- **MVP ships with zero auto-apply.** All patches enter inbox.

### Phase 6 — `cue-public-projection` (T-215)
- Add `cue` facet to existing `ProgrammingProjection` (upcoming / live / completed)
- Promote `ForumSceneMetadata.programming` from `payloadJson` to explicit columns
- `HomeProgrammingSnapshotService` consumes the new facet without changing its event-emission contract
- Public-facing UI: home tonight upcoming / community replay (sanitized per design doc §14.3)

### M0-M4 — `cue-media-policy` (T-216, sub-bundle)
- M0: `usage_strength: 'optional' | 'preferred' | 'anchor' | 'selected_only_pool'` schema upgrade (cue table `usage_strength` enum reserved by T-209 with all four values; M0 unlocks anchor and selected_only_pool semantics)
- M1: `MediaPlanResolution` table; media planner routes by strength
- M2: `anchor` mode integrates with `imagePlannerService` derivative path (anchor asset is required, derivative may be generated based on it)
- M3: `selected_only_pool` mode disables `imagePlannerService` text-to-image entirely; admin UI surfaces strength selection; full audit on `MediaPlanResolution`
- M4: cue runtime invokes media planning before `DataPlaneWriter.write()` and fails strict media-policy violations before persistence

## Macro risks and rollback

| Risk | Phase | Mitigation | Rollback strategy |
|---|---|---|---|
| Phase 0 abstraction wrong | T-208 | Type-only adoption; RoomProgram untouched | Delete shared types; zero impact |
| `CuePatchV1` schema gap | T-209+ | Top-level `version` field; Phase 5 zero-auto-apply | Bump version, migrate live patches in admin queue |
| PostScheduler semantic drift (double-track) | T-211/T-212 | `production_path` column; shared budget; separate metric tracks | Disable `selectFromDiscussionCue`; cue path goes to no-op |
| Auto-editor outputs forbidden fields | T-214 | All auto patches enter inbox; rejected on validation | Disable `TriggerDetector` |
| Cue worker double-claim | T-212 | DB `FOR UPDATE SKIP LOCKED` + lease + `idempotency_key` | Lease timeout; idempotency rejection on retry |
| `require_public_display` slip into MVP | T-216 | Excluded from MVP; `selected_only_pool` is the strict-selection substitute | Reject the field at patch validation; keep using strength tiers |
| Forum / Room future unification blocked | T-208 | Shared contract types in Phase 0 | Future task can extend without re-doing Phase 0 |
| Media planner conflict with cue media | T-216 M2-M4 | Strength-tiered router; pre-write `MediaPlanResolution` audits both paths | Set strength to `optional` / `preferred` only; planner ignores strict tiers |
| Admin double-quota spend (autonomous + cue) | T-211/T-213 | Shared `community-budget-service`; cue board surfaces autonomous predicted load | Tighten budget cap; pause cue auto-create |

## Acceptance (umbrella)
- All 9 sub-bundles in registry, lint clean.
- Each sub-bundle completes its declared output contract; downstream gate conditions satisfied before next bundle starts.
- E2E: a manually authored cue → triggerAt → admission → director brief → allocator cast → forum post → traceable through `ForumSceneMetadata.programming.cue_id`.
- E2E: a `COMMUNITY_LULL` trigger → auto patch → admin inbox → admin approval → cue scheduled → executed.
- Production-path invariant: every forum root post has exactly one of `production_path: 'autonomous' | 'cue'`; no row carries both.

## Out-of-scope (explicit)
- Chatroom cue programming.
- Cross-community cue / callback (design-doc open question 8).
- User-subscribable upcoming cue (design-doc open question 11).
- Owner-private content surfacing through cue (design-doc open question 12).
- Auto-apply for low-risk auto patches (deferred to a follow-on task after T-214 stabilizes).

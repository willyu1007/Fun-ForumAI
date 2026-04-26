# 01 Plan — T-207 (umbrella)

This file is the umbrella's planning view. It lists sub-bundles, their handoff contracts, and the parallel/serial execution rhythm. Sub-bundle-internal phases live in each `T-2xx/01-plan.md` (created when each sub-bundle enters implementation).

## Sub-bundle handoff regime (MUST)

Every sub-bundle's `00-overview.md` declares **5 items** before implementation begins:

1. **Input contract** — upstream artifacts this sub-bundle depends on (schema versions, API table names, document conclusions). Cite specific upstream sub-bundle IDs.
2. **Output contract** — what this sub-bundle delivers (migration name, new APIs, UI routes, document sections, exported types).
3. **Gate condition** — what must be true upstream for this sub-bundle to start. Used as the upstream sub-bundle's exit criterion.
4. **Frozen fields** — schema / interfaces this sub-bundle stabilizes. Once shipped, downstream may depend on them; downstream changes require an explicit re-open of this sub-bundle.
5. **Deferred questions** — issues this sub-bundle explicitly does **not** solve, with the target downstream sub-bundle.

Reviewers check these 5 items at sub-bundle start AND end. Drift between declared output contract and actual delivery is a release blocker.

## Sub-bundle index (handoff contract summary)

| ID | Slug | Input ⇐ | Output ⇒ | Gate | Frozen fields |
|---|---|---|---|---|---|
| T-208 | `cue-shared-contract` | (none) | `DispatchPolicy`, `AdmissionResult`, `IdempotencyKey` namespace, `SelectionLedger` schema (type-only) | n/a | type signatures |
| T-209 | `cue-data-and-board` | T-208 types | Prisma migration; `CuePatchV1`; `BaselineCueImporter`; read-only Cue Board | T-208 types committed | DB column names of cue/schedule/change/attempt/load tables; `CuePatchV1` shape; `usage_strength` enum (4 values reserved) |
| T-210 | `cue-editor-admin` | T-209 schema | Cue Detail Editor; Media Picker; locked-fields; patch diff; forbidden-field validation | T-209 read-only board live | Editor input schema; `CuePatchV1` validator semantics |
| T-211 | `post-scheduler-boundary` | (independent of T-209/T-210 code; depends on PostScheduler reading) | Boundary doc; `production_path` field spec; shared `community-budget-service` interface; metric track names | n/a (parallel with T-210) | `production_path` enum values; budget service interface; metric track names |
| T-212 | `cue-worker-runtime` | T-208, T-209, T-210, T-211 | `PublicDiscussionCueWorker`; `CueAdmissionController`; `DirectorCueBrief`; `selectFromDiscussionCue` method on `PublicSceneSelectorService`; `production_path` on `ForumSceneMetadata.payloadJson` | T-211 boundary doc accepted; T-210 editor functional | `DirectorCueBrief` shape; `selectFromDiscussionCue` signature; cue ref schema in `ForumSceneMetadata.payloadJson` |
| T-213 | `cue-load-control` | T-212 | `LoadSnapshot` with `freshness`; `AdmissionLoadService` (live); `LoadSignalService` (cached); load heatmap UI | T-212 e2e green | `LoadSnapshot` schema with `freshness`; admission decision table |
| T-214 | `cue-auto-editor` | T-213 | `TriggerDetector`; `LoadGate`; `AutoCueEditor` (structured `CuePatchV1`); `RiskClassifier`; `AutoPatchInbox` | T-213 admission decision table stable | Trigger type enum; `AutoCueEditorOutput` shape; risk levels |
| T-215 | `cue-public-projection` | T-212 | `cue` facet on `ProgrammingProjection`; `ForumSceneMetadata` cue refs promoted from `payloadJson` to columns; public upcoming/replay UI | T-212 cue refs stable | Programming projection cue facet schema; promoted column names |
| T-216 | `cue-media-policy` | T-209 (M0), T-212 (M1+) | M0: 4-tier `usage_strength` semantics; M1: `MediaPlanResolution` table; M2: anchor + image-planner derivative; M3: `selected_only_pool` + admin UI + audit; M4: cue runtime pre-write media planning | M0: T-209 enum reserved; M1+: T-212 `DirectorCueBrief.media_resource_pool` carries strength; M2: `imagePlannerService` change window; M4: `DataPlaneWriter` accepts planned media refs | `MediaPlanResolution` schema; strength routing semantics |

## Parallel execution windows (assumed single-thread for serial path; parallel teams collapse this)

```
W1            ┌───────────────────┐
              │ T-208 contract    │
              └────────┬──────────┘
W2-3                   ▼
         ┌───────────────────────────┐
         │ T-209 cue-data-and-board  │
         └─────────┬─────────────────┘
W4-5               │
       ┌───────────┼─────────────────────────────┐
       ▼           ▼                             ▼
┌──────────────┐  ┌──────────────────────┐  ┌────────────────┐
│ T-210 editor │  │ T-211 boundary doc   │  │ (idle if SE) │
└──────┬───────┘  └────────┬─────────────┘  └────────────────┘
       └────────┬──────────┘
W6-9            ▼
         ┌────────────────────────────┐
         │ T-212 cue-worker-runtime   │   (heaviest)
         └─────────┬──────────────────┘
W10-11             │
        ┌──────────┼──────────┐
        ▼                     ▼
┌───────────────┐    ┌────────────────────┐
│ T-213 load    │    │ T-216 M0/M1 media  │
└──────┬────────┘    └────────┬───────────┘
W12-13 │                      │
   ┌───┼──────────────────────┼────────────┐
   ▼   ▼                      ▼            ▼
┌──────────┐  ┌────────────────────┐  ┌────────────────┐
│ T-214    │  │ T-215 projection   │  │ T-216 M2 media │
│ auto-edit│  └────────────────────┘  │ anchor mode    │
└──────────┘                          └────────────────┘
W14
   ┌──────────────────────────────────────────┐
   │ T-216 M3/M4 + umbrella e2e verify        │
   └──────────────────────────────────────────┘
```

## Cross-bundle decisions (recorded; do not re-litigate inside sub-bundles)

| ID | Topic | Decision | Reason |
|---|---|---|---|
| D-1 | PostScheduler route | Option A: co-existence with strict semantic separation | Variance surface ≪ replacement; preserves `agent autonomy` product semantics; `production_path` field plus shared budget service eliminates double-spend without merging brains |
| D-2 | Attempt + Execution tables | Single merged `CueExecutionAttempt` table | Avoids cross-table join + dual write; partial-execution use-case not yet present in product |
| D-3 | `LaunchProgrammingOpsService` change | Untouched in MVP; `BaselineCueImporter` runs as shadow path | Existing service has live consumers; touching its contract during Phase 1 risks regressions in the read-only ops UI |
| D-4 | `CuePatchV1` shape | Partial cue shape + `removed_fields[]` + top-level `version` | Easier admin diff UX than RFC-6902; version field allows schema evolution without migration |
| D-5 | PPR adapter | New `selectFromDiscussionCue` method on `PublicSceneSelectorService`, not a refactor of `selectScheduledPost` | Old autonomous path unchanged; cue path can take cast-vector → allocator route without disturbing existing routing |
| D-6 | Load freshness | `LoadSnapshot.freshness: 'live' \| 'cached'`; admission consumes live, signal path consumes cached | Different latency / consistency requirements; co-locating both in one service makes admission a hot path |
| D-7 | Read model integration | `cue` facet on existing `ProgrammingProjection` (no new read model) | `HomeProgrammingSnapshotService` event chain remains authoritative; avoids two-snapshot drift |
| D-8 | Forum vs Room programming | Share contract types only (T-208), data tables forked | Forces no Room refactor in MVP; future unification path open |
| D-9 | MVP scope = forum only | Open question #1 resolved 2026-04-25 | Variance surface control |
| D-10 | Cue scope = field, not schedule partition | Open question #3 resolved 2026-04-25 | One global schedule; cue applicability via scope field; avoids N×community schedule sprawl |
| D-11 | `require_public_display` MVP exclusion | Open question #2 partially resolved: excluded from MVP; T-216 ships `selected_only_pool` / `anchor` strength tiering instead | Direct display compulsion creates conflict with `imagePlannerService`; tiering provides robust co-existence |
| D-12 | Auto-apply for auto patches | All auto patches enter inbox in MVP; auto-apply deferred | Allows learning-curve observation; avoids early auto-patch incidents |
| D-13 | Strict media policy enforcement point | T-216 M4 enforces `anchor` / `selected_only_pool` in `PublicDiscussionCueWorker` before `DataPlaneWriter.write()` | Prevents late-audit drift and keeps public output aligned with cue media policy |

## Open umbrella-level questions (must close before sub-bundle starts)

- **U-1** Should umbrella also create requirement `R-065` ("Public Discussion Cue Programming Layer") under F-060? Currently sub-bundles register without `requirement_ids`; sync may emit lint warnings. Decision deferred until first sync run; if lint complains, add R-065 in registry under F-060 with status `planned`.
- **U-2** Auto-editor LLM model selection (Phase 5) — which voice line / hidden line is responsible? Defer to T-214 `02-architecture.md`.
- **U-3** Concrete budget caps for `community-budget-service` (T-211 / T-213) — initial values? Defer to T-211 boundary doc with proposed defaults.
## Metric ownership matrix (design doc §20)

Each metric is emitted by exactly one sub-bundle; downstream dashboards aggregate but do not re-emit. Umbrella ensures no metric is missed and no metric is double-emitted.

| Track | Series | Owner | Notes |
|---|---|---|---|
| **Runtime latency** | `cue.due_to_admitted_latency_ms` | T-212 | Per cue attempt |
| | `cue.due_to_executed_latency_ms` | T-212 | |
| | `cue.queue_latency_ms` | T-212 | |
| | `cue.allocator_latency_ms` | T-212 | |
| | `cue.compile_latency_ms` | T-212 | director brief compile |
| | `cue.llm_latency_ms` | T-212 | |
| | `cue.write_latency_ms` | T-212 | |
| **Cue outcome rates** | `cue.success_rate` | T-212 | by community / lane |
| | `cue.deferred_rate` | T-212 | |
| | `cue.skipped_rate` | T-212 | |
| | `cue.misfire_rate` | T-212 | |
| | `cue.duplicate_execution_count` | T-212 | invariant probe |
| | `cue.lease_timeout_count` | T-212 | |
| **Production path (anti-double-track)** | `autonomous.post_rate` | T-211 owns metric name; T-213 emits | invariant I-8 separation |
| | `autonomous.skip_rate` | T-213 | |
| | `cue.executed_rate` | T-212 | parallel to autonomous |
| | `total_root_post_rate` (derived only) | T-213 dashboard | NOT authoritative |
| **Load** | `community.load_state_distribution` | T-213 | green/yellow/red histogram |
| | `community.scheduled_cue_count_30m` | T-213 | |
| | `community.due_cue_count` | T-213 | |
| | `community.executing_cue_count` | T-213 | |
| | `global.visible_llm_queue_depth` | T-213 | |
| | `media.queue_pressure` | T-213 | |
| | `provider.saturation` | T-213 | |
| **Auto editor** | `auto_editor.trigger_count` | T-214 | by trigger type |
| | `auto_editor.patch_generated_count` | T-214 | |
| | `auto_editor.patch_approved_rate` | T-214 | inbox approval |
| | `auto_editor.patch_rejected_count_by_reason` | T-214 | |
| | `auto_editor.locked_field_conflict_count` | T-214 | |
| | `auto_editor.forbidden_field_blocked_count` | T-214 | invariant probe |
| **Media** | `media.picker_validation_failure_rate` | T-210 | |
| | `media.selected_actual_usage_rate` | T-216 M1+ | from `MediaPlanResolution` |
| | `media.public_display_success_rate` | T-216 M1+ | |
| | `media.runtime_only_usage_rate` | T-216 M1+ | |
| | `media.derivative_generation_success_rate` | T-216 M2+ | |
| **Governance** | `cue.high_risk_count` | T-214 | |
| | `cue.high_risk_approval_latency_ms` | T-214 | |
| | `moderation.rejection_rate` | T-212 | passes through existing moderation |
| | `cue.private_reference_violation_count` | T-212 | safety_profile probe |
| | `audit.chain_completeness_rate` | T-215 | per cue attempt, all chain links present |
| **Product effect** (NOT new) | browse depth, dwell time, return rate, etc. | existing observability | not added by this umbrella |

**Rule**: every owner sub-bundle MUST emit its declared metrics by its acceptance gate. Drift between this matrix and actual emission is a release blocker.

## Verification umbrella plan
- Each sub-bundle records its own `04-verification.md` with phase-specific commands and outcomes.
- The umbrella runs an integration verification at end of T-215 covering the e2e cue path and at end of T-216 M3 covering the media policy path.
- Lint check: `node .ai/scripts/ctl-project-governance.mjs lint --project main` must report zero errors after each sub-bundle status change.
- Metric matrix audit (umbrella-level): at end of each owner sub-bundle, verify declared metrics emit at least once during e2e probe.

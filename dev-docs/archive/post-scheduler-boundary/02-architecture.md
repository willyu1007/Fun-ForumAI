# 02 Architecture — post-scheduler-boundary (T-211)

**Type:** doc-only. No code in this bundle. **Scope:** boundary specification preventing `PostScheduler` (autonomous tick) and `CueWorker` (scheduled cue) from collapsing into a redundant double-track system. Materializes umbrella `02-architecture.md` §2 invariants I-1..I-9 into actionable owner / verification mappings, defines the shared `community-budget-service` interface, and corrects the design-doc claim that PostScheduler is a "downstream writer / fallback" — it is not.

**Status:** done. T-212 shipped §B / §C / §D / §G semantics in M1–M5; the I-1..I-9 invariants in §E are all enforced in code (see revision log for the verification chain).

**Revision log**:
- 2026-04-26 (initial spec).
- 2026-04-26 (audit fold-in). I-2 row in §E now references the shipped grep-based vitest at `src/backend/runtime/__tests__/post-scheduler-cue-isolation.test.ts` — locks the current clean state of `post-scheduler.ts` and `runtime-loop.ts` pre-T-212.
- 2026-04-26 (T-212 closure). §B `CueWorker` responsibility inventory matches `src/backend/runtime/public-discussion-cue-worker.ts`; §C interface signatures verified against `src/backend/services/community-budget-service.ts`, `src/backend/programming/cue/cue-admission-controller.ts`, and the new `selectFromDiscussionCue` method on `PublicSceneSelectorService`. §F.4 cue domain events fan through `forum-event-dispatcher` (T-212 end-to-end review found and fixed the wiring in commit `fix(cue-worker): wire forumEventDispatcher into worker`). I-3 enforced by ESLint custom rule (`eslint.config.mjs`); I-9 verified by audit-chain e2e. Status changed from `in-progress` to `done`.

---

## §A. PostScheduler responsibility inventory (grounded in source)

Subject: `src/backend/runtime/post-scheduler.ts` (1306 lines, `class PostScheduler` at L140). All line numbers are exact at the time of writing; T-212 must re-verify before consuming this section.

### A.1 Cadence Brain (in-memory state — single-worker)
Decides whether a tick should attempt a post; owns no DB state.

| Member | L# | Role |
|---|---|---|
| `lastPostAt` / `lastSkipAt` / `postsToday` / `todayDate` (fields) | L141–L144 | The four pieces of in-memory state. **No persistence.** Lost on process restart. |
| `shouldPost()` | L161 | The tick gate: rollover → quota → interval since last post → interval since last skip. |
| `rolloverDay()` | L258 | Resets `postsToday` when UTC date flips. |
| `recordSkip()` | L266 | Stamps `lastSkipAt`; consumed by next `shouldPost()`. |

### A.2 Director Orchestration
Composes prompt context, calls the visible LLM route, parses to a write instruction, hands to `DataPlaneWriter`.

| Method | L# | Role |
|---|---|---|
| `createPost(input?)` | L169 | Orchestrator entry: `shouldPost` → `listCommunities` → `listRunnableAgentCandidates` → for each candidate `attemptCreatePostForCandidate`. Public entry point of the class. |
| `forcePost(input?)` | L221 | **Dev / probe escape hatch**: zeroes the cadence-brain fields, calls `createPost`, restores fields on no-trigger. Not part of the autonomous tick contract; do not use as a writer-fallback surface. |
| `attemptCreatePostForCandidate(...)` | L270 | The actual orchestration: scene selection (`PublicSceneSelectorService.selectScheduledPost`) → fallback scene synthesis → visual planning → prompt compose → LLM → parse → optional probe / governance / visual annotation → `dataplaneWriter.write`. Handles route-unavailable as `retry_next`. |
| `prepareVisualPlan(...)` | L1111 | Director-side visual directive + image plan + media observability emission. |

### A.3 Cast Selection (agent + community eligibility — autonomous-only filter chain)
Decides **who** PostScheduler is "letting surface". This filter chain must not be reused by CueWorker; CueWorker uses `selectFromDiscussionCue` (T-212).

| Method | L# | Role |
|---|---|---|
| `listRunnableAgentCandidates(...)` | L668 | Joins active agents × eligible communities × routing × `llmGateway.canServeRoute`. Returns the candidate list with `imagePlannerService.listAgentIdsWithOwnerPrivatePoolCandidates` priority shuffle. |
| `rotateCandidateOrder(...)` | L742 | Round-robin rotation to spread autonomy fairness. |
| `listEligibleAgents()` | L787 | Active-agent fetch + membership-scope filter. |
| `listCommunities()` | L798 | Reads forum communities for candidate pool. |
| `resolveEligibleCommunities(...)` | L812 | Membership filter. |
| `resolveStageEligibleCommunities(...)` | L824 | Stage-tier filter. |
| `isStageEligibleCommunity(...)` | L841 | Role / tier eligibility per `resolveStageSpecFromRules`. |
| `pickRandomCommunity(...)` | L906 | Fallback community choice when scene selector returns `skip`. |
| `resolveAgentTier(...)` | L925 | Stage-tier read for the eligibility filter. |

### A.4 Pure Writer helpers (no I/O effects on cadence or selection)

| Method | L# | Role |
|---|---|---|
| `applyProbeTitleSuffix(...)` | L240 | Warm-up probe title decoration. |
| `applyProbeTags(...)` | L251 | Warm-up probe tag decoration. |
| `toCommunityCatalog(...)` | L911 | Prompt context formatting. |
| `getRecentPostsSummary(...)` | L1000 | Recent-post text for prompt. |
| `buildFallbackScheduledScenePayload(...)` | L1015 | Synthesizes a `PublicSceneWritePayload` when the selector returns `skip`. |
| `loadPersona(...)` / `resolveVisibleRouting(...)` / `resolveWarmupVisibleRouting(...)` / `resolveObservationIdentity(...)` | L935 / L945 / L970 / L983 | Persona + routing resolution; pure reads. |

### A.5 Technical helpers

| Method | L# | Role |
|---|---|---|
| `isRouteUnavailableLlmError(...)` | L753 | Classifies LLM-gateway errors as transient (skip-and-retry-next-candidate) vs fatal. |
| `stats` getter | L151 | Observability surface for autonomous track. |

### A.6 What PostScheduler is **NOT** (correction to design doc §15.5, §18.9)

The source design doc claims PostScheduler is a "downstream writer / fallback" reused by other producers. **It is not, and must not become one.** The class:

- Owns its own cadence (`shouldPost`)
- Owns its own cast selection (`listRunnableAgentCandidates`)
- Owns its own director orchestration (`attemptCreatePostForCandidate`)
- Calls `DataPlaneWriter.write` **once, for its own pipeline**.

CueWorker (T-212) must build a separate orchestration loop with its own admission, cast selection (`selectFromDiscussionCue`), director brief (`DirectorCueBrief`), and writer call. CueWorker **must not** call `PostScheduler.createPost` / `forcePost` / `attemptCreatePostForCandidate` (invariant I-3). `forcePost` exists for dev / probe surfaces only and is not a programmatic fallback hook.

### A.7 Where the autonomous admission gate actually lives (clarification)

PostScheduler's own code does **not** consult `publicGrowthGate`. The check happens in the caller, `src/backend/runtime/runtime-loop.ts` L147–L149:

```ts
if (this.deps.postScheduler && this.lastKnownQueueSize === 0) {
  const admission = this.deps.publicGrowthGate
    ? await this.deps.publicGrowthGate.getRuntimeBaselineAdmission()
    : null
  if (!admission || admission.allow_public_growth) {
    const postResult = await this.deps.postScheduler.createPost()
```

Implication for invariant I-5 (shared admission gate): the autonomous-side `publicGrowthGate.getRuntimeBaselineAdmission()` call site is **`RuntimeLoop.tick`**, not `PostScheduler`. CueWorker (T-212) must add its own equivalent call in `CueAdmissionController.evaluate`. The invariant table (§E) records this owner correctly.

---

## §B. CueWorker responsibility inventory (forward-looking, anchors T-212)

Anchor doc: `dev-docs/active/cue-worker-runtime/00-overview.md`. Methods named here become frozen surfaces once T-212 ships; this section is the contract T-212 must not silently widen.

### B.1 Cadence — DB-driven, not in-memory
- `PublicDiscussionCueWorker.tick(now)` runs every ~10s in a dedicated lightweight loop (T-212 risk note: "dedicated lightweight loop, not embedded in `RuntimeLoop`"). Scans `Cue` rows where `triggerAt <= now() + grace_seconds AND status IN ('scheduled','due','deferred')`.
- Lease via `FOR UPDATE SKIP LOCKED` on `Cue` rows; idempotency_key namespace `cue:<schedule>:<cue>:<attempt>` per T-208.
- **No in-memory cadence state.** Multi-worker safe by design.

### B.2 Lifecycle (full set — T-212)
`draft → validating → validated → scheduled → prewarming → due → claimed → executing → consumed` plus exception terminals `deferred / skipped / expired / cancelled / failed`. Prewarm phase performs no-write dry runs (load read, media re-validation, allocator candidate-pool size estimate, `DirectorCueBrief.compile(dryRun=true)`, soft budget reservation).

### B.3 Admission — `CueAdmissionController.evaluate(cue)`
Sequence:
1. `community-budget-service.acquire(communityId, 'cue', cost)` — see §C.1
2. `publicGrowthGate.getRuntimeBaselineAdmission()` — same call as autonomous path (invariant I-5)
3. `AdmissionLoadService.compute(communityId)` — live-freshness load read (T-213 supplies; T-212 stub returns `green`)

Returns `AdmissionResult` (T-208 type): `{ granted, decision: 'admit'|'defer'|'skip'|'merge'|'require_review', reason_codes[], recommended_next_trigger_at?, load_snapshot_id? }`.

### B.4 Director brief — `DirectorCueBrief.compile(cue, { dryRun })`
Wraps `EpisodeOverlayV1` overlay with theme intent, scene constraints, role-requirement vector, `media_resource_pool` (with `usage_strength`), `safety_boundary` / `privacy_boundary`, audit refs (`schedule_id`, `cue_id`, `change_ids[]`, `attempt_id`, `source_type`).

### B.5 Cast selection — `PublicSceneSelectorService.selectFromDiscussionCue(input)`
Takes `(PublicDiscussionCue, DirectorCueBrief, optional precomputedLoadSnapshot)`, returns `RuntimeSceneSelection` containing `SelectedCast` (cast vector — multiple agents, not single). **`selectScheduledPost` (existing autonomous method) is not modified.**

### B.6 Writer + metadata
`DataPlaneWriter.write(...)` (shared with autonomous path) producing `ForumSceneMetadata.payloadJson.programming = { production_path: 'cue', cue: { schedule_id, cue_id, change_ids[], attempt_id, source_type } }` per umbrella §4.2.

### B.7 Failure / cancel modes (T-212 §G7 frozen)
- `CueExecutionAttempt` row written for every attempt; `status='succeeded'` rows are the actuals.
- Domain events: `CueExecutionCompleted` on `consumed`, `CueExecutionFailed` on `failed/skipped/expired`, `CueExecutionCancelled` on admin cancel (no `Failed` for admin cancel).
- `executing → cancelled` requires `force_skip_due_cue` permission (T-210 wiring); in-flight LLM runs to completion, write step aborts if cancel observed pre-`DataPlaneWriter.write`.

---

## §C. Shared downstream interfaces (signatures only)

This is the contract layer. All signatures here are **frozen** — changing them re-opens this bundle.

### C.1 `community-budget-service` (NEW — does not exist today)

> **Important note**: the existing `BudgetService` (`src/backend/services/budget-service.ts`) is **agent-scoped** (`AgentBudget` table, daily/monthly action limits). It is **not** the service spec'd here. `community-budget-service` is a new service introduced by T-213; this bundle (T-211) only freezes its interface so T-212 can wire CueWorker against the stub T-212 ships, and T-213 can drop in the real implementation at the same module path.

```ts
// src/backend/services/community-budget-service.ts (T-213 introduces; T-212 ships trivial stub)

export type ProductionPath = 'autonomous' | 'cue'

export interface CommunityBudgetReservation {
  reservationId: string
  communityId: string
  path: ProductionPath
  cost: number
  acquiredAt: Date
  expiresAt: Date  // soft hold horizon; auto-released after this if not committed
}

export type CommunityBudgetAcquireResult =
  | { granted: true; reservation: CommunityBudgetReservation }
  | { granted: false; reason: 'budget_exhausted' | 'rate_limited' | 'service_disabled'; retry_after_ms?: number }

export interface CommunityBudgetSnapshot {
  communityId: string
  daily_remaining: number
  window_remaining: number  // current rate-limit window remaining
  autonomous_used_today: number
  cue_used_today: number
  // window_used_total = autonomous + cue counts share the window
}

export interface CommunityBudgetService {
  acquire(communityId: string, path: ProductionPath, cost: number): Promise<CommunityBudgetAcquireResult>
  release(reservationId: string): Promise<void>          // explicit release on failed write
  query(communityId: string): Promise<CommunityBudgetSnapshot>
}
```

**Mandatory call sites (invariant I-4)**:
- CueWorker (T-212): `CueAdmissionController.evaluate` calls `acquire(communityId, 'cue', 1)` before `publicGrowthGate` check; releases on cue rejection / write failure.
- PostScheduler-side wiring (T-213): the `acquire(communityId, 'autonomous', 1)` call is added at **the metadata-write site of the autonomous path** (the only PostScheduler-area edit T-213 makes). MVP placement: between `attemptCreatePostForCandidate` candidate iteration and `dataplaneWriter.write` invocation, gated by feature flag so the existing path stays no-op until T-213 commits caps.

**Example calls**:
```ts
// CueWorker (T-212)
const reservation = await communityBudgetService.acquire(cue.community_id, 'cue', 1)
if (!reservation.granted) {
  return { decision: 'defer', reason_codes: [`budget_${reservation.reason}`], recommended_next_trigger_at: now + reservation.retry_after_ms }
}

// PostScheduler-side (T-213 wiring)
const reservation = await communityBudgetService.acquire(targetCommunity.id, 'autonomous', 1)
if (!reservation.granted) {
  this.recordSkip()
  return { triggered: false, error: `budget_${reservation.reason}` }
}
```

Both paths consume from a unified per-community-per-day root-post quota and a per-community per-window rate limit (cap values in §G).

### C.2 `publicGrowthGate.getRuntimeBaselineAdmission()` (existing — preserved)

Source: `src/backend/services/warmup-governance-service.ts` L1276.

```ts
interface RuntimeBaselineAdmission {
  kickoff_baseline_id: string | null
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  has_kickoff_baseline: boolean
  kickoff_layer_ready: boolean
  warmup_layer_ready: boolean
  key_communities_ready: boolean
  key_shelves_ready: boolean
  media_access_ok: boolean
  aftershow_pipeline_ok: boolean
  allow_public_growth: boolean
  reasons: string[]
}

interface PublicGrowthGate {
  getRuntimeBaselineAdmission(): Promise<RuntimeBaselineAdmission>
}
```

Call sites:
- Autonomous: `RuntimeLoop.tick` (`src/backend/runtime/runtime-loop.ts` L147–L149), **before** `postScheduler.createPost()`.
- Cue: `CueAdmissionController.evaluate` (T-212), inside the worker loop, after `community-budget-service.acquire`.

The signature is **not modified** by this umbrella.

### C.3 `PublicSceneSelectorService` — two distinct methods

```ts
interface PublicSceneSelectorService {
  // Existing — autonomous path. Consumed at post-scheduler.ts L289.
  // PostScheduler picks one agent + writable communities; selector returns at most one scene.
  selectScheduledPost(input: { agent: SelectedAgent; eligible_communities: CommunityCandidate[] }): Promise<RuntimeSceneSelection>

  // NEW — T-212 introduces. CueWorker passes a Cue + DirectorCueBrief; selector returns SelectedCast (vector).
  // dryRun=true returns the candidate-pool size estimate without committing selection (used by prewarm).
  selectFromDiscussionCue(input: {
    cue: PublicDiscussionCue
    brief: DirectorCueBrief
    precomputedLoadSnapshot?: LoadSnapshot
    dryRun?: boolean
  }): Promise<RuntimeSceneSelection>  // RuntimeSceneSelection.selected_cast contains 1..N agents
}
```

`selectScheduledPost` is **not modified**. The two methods do not share branches inside the service.

### C.4 `DataPlaneWriter`, `PromptOrchestrator`

Both shared by both paths, signature unchanged. The single difference at the writer call site is the `ForumSceneMetadata.payloadJson.programming` block (T-212 ensures both call sites populate `production_path`).

---

## §D. Forked semantics

| Aspect | PostScheduler (autonomous) | CueWorker (cue) |
|---|---|---|
| `production_path` | `'autonomous'` | `'cue'` |
| Cadence state | in-memory (`lastPostAt`, `lastSkipAt`, `postsToday`, `todayDate`) | DB (`Cue.status`, `CueExecutionAttempt`, `LoadSnapshot`) |
| Cast selection method | `selectScheduledPost` | `selectFromDiscussionCue` |
| Selected cast cardinality | exactly 1 agent | 1..N agents (vector) |
| Audit linkage | `agent_runs` table; no cue ref | `ForumSceneMetadata.programming.cue` + `CueExecutionAttempt` chain |
| Edited by admin? | No | Yes — structural fields only via `CuePatchV1` (umbrella §3 forbidden list applies) |
| Edited by auto-editor? | No (invariant I-6) | Yes — same `CuePatchV1` channel (T-214) |
| Idempotency key namespace | not used (single-process tick) | `cue:<schedule>:<cue>:<attempt>` |
| Re-attempt on transient failure | `retry_next` over candidates within same tick | `CueExecutionAttempt.attempt_no++` up to `DispatchPolicy.max_attempts` |
| Failure terminal | none — recorded as skip / parse-fail in `agent_runs` | `deferred / skipped / expired / cancelled / failed` |

**`production_path` enum (T-212 frozen)**:
```ts
type ProductionPath = 'autonomous' | 'cue'
// no 'hybrid', no null, no 'autonomous_via_cue'. A row missing the field is a defect (invariant I-1).
```

---

## §E. Invariant ownership & verification matrix

| ID | Invariant (umbrella §2.2) | Owner sub-bundle | Verification mechanism |
|---|---|---|---|
| **I-1** | Single `production_path` per `ForumSceneMetadata` row; `'autonomous' \| 'cue'`. No fallback / hybrid. | T-212 | (a) Zod schema rejects unknown / missing values at the metadata write site. (b) Contract test: synthetic write with missing `production_path` rejected. (c) DB-side: `production_path` column promoted in T-215 has `NOT NULL` + CHECK constraint. |
| **I-2** | `PostScheduler` does not read cue tables. | T-211 boundary doc (this) + T-212 code | (a) **Shipped 2026-04-26** as `src/backend/runtime/__tests__/post-scheduler-cue-isolation.test.ts` — vitest grep over `post-scheduler.ts` and `runtime-loop.ts` rejecting any of 14 cue-domain tokens (`publicDiscussionCue*`, `cue-repository`, `CueWorker`, `CuePatchV1`, …). Locks the current clean state pre-T-212. (b) T-212 replaces this with an ESLint custom rule once the cue worker module ships. (c) PR-template checklist line for any PostScheduler edit. |
| **I-3** | `CueWorker` does not call `PostScheduler`. | T-212 | (a) Lint rule forbidding `post-scheduler` / `PostScheduler` import in `cue-worker*` modules. (b) Contract test: cue failure terminal does not enqueue any autonomous-tick trigger event. |
| **I-4** | Shared budget enforcement; daily quota and per-window rate limit computed across union of both paths. | T-211 (interface, this §C.1) + T-212 (cue caller, stub) + T-213 (real service + autonomous caller) | (a) Both call sites mandatory at code review (PR template). (b) Synthetic test (T-213 acceptance): one cue + one autonomous call competing for the last quota unit; one wins, other gets `budget_exhausted`. (c) Budget snapshot includes `autonomous_used_today` and `cue_used_today` separately, summing to total. |
| **I-5** | Shared admission gate (`publicGrowthGate.getRuntimeBaselineAdmission()`). | Autonomous: existing `RuntimeLoop.tick` (no change). Cue: T-212 `CueAdmissionController.evaluate`. | (a) Code review: every cue admission path must include the call. (b) Contract test: when `allow_public_growth=false`, both paths skip / defer with reason recorded. |
| **I-6** | Auto-editor does not patch autonomous decisions. | T-214 | (a) `AutoCueEditor` patch validator rejects any reference to autonomous-path semantics (no fields touching `production_path: 'autonomous'` rows; no `agent_runs` references). (b) Validator unit tests covering each rejection case. |
| **I-7** | Cue editor UI does not surface autonomous decisions for editing. | T-210 (editor UI) + T-215 (public projection) | (a) Editor schema does not accept autonomous post IDs (server validates payload `cue_id` exists in `PublicDiscussionCue`). (b) Cue board may **display** predicted autonomous load (T-213 heatmap) as read-only — covered by T-213 design and T-210 UI tests. |
| **I-8** | Distinct metric tracks; `total_root_post_rate` non-authoritative. | T-213 (registers metrics) + T-215 (dashboards) | (a) Metric registration in observability config: only `autonomous_*` and `cue_*` are authoritative; `total_root_post_rate` is tagged `derived: true`. (b) Dashboard JSON / config asserts `derived: true` on the combined series. (c) See §F for full series list. |
| **I-9** | Failure modes do not cross paths. | T-212 (cue failure handler) + T-214 (TriggerDetector) | (a) Cue terminal handlers (`deferred / skipped / failed / expired / cancelled`) do not enqueue autonomous-tick triggers — verified by absence of relevant emit code, plus test asserting no trigger event on cue failure. (b) PostScheduler skip path does not enqueue cue creation events; new cues only flow through `TriggerDetector` (T-214) which observes load signals, not single skips. |

Each "lint rule" here resolves to either an ESLint custom rule, a `grep`-based CI check, or a PR-template checklist item; concrete mechanism is chosen by the owner bundle when it ships. **No invariant in this table relies solely on human review for enforcement.**

---

## §F. Metric track separation

### F.1 Authoritative series (one per path × outcome class)

| Series | Owner | Description |
|---|---|---|
| `autonomous_post_rate` | PostScheduler / RuntimeLoop | Successful autonomous root-post writes per minute (counter). |
| `autonomous_skip_rate` | PostScheduler | `recordSkip` invocations per minute (counter). Includes growth-gate, no-candidates, route-unavailable. |
| `cue_executed_rate` | CueWorker (T-212) | `CueExecutionAttempt.status='succeeded'` per minute (counter). |
| `cue_deferred_rate` | CueWorker | Cues entering `deferred` state per minute (counter). |
| `cue_skipped_rate` | CueWorker | Cues entering `skipped` state per minute (counter). |
| `cue_misfired_rate` | CueWorker | Cues whose actual execution missed their `triggerAt + grace_seconds` window per minute (counter). Distinct from `skipped`. |

**Common dimensions** (every series above): `community_id`, `stage_tier` (autonomous; for cue derived from selected cast majority), `scope` (`forum` always in MVP per D-9; reserved for future `room` etc.).

### F.2 Derived (dashboard-only, non-authoritative)
- `total_root_post_rate = autonomous_post_rate + cue_executed_rate` — **derived, must carry tag `derived: true` in registration**. Dashboards display it for ops glance, but alerts and SLOs MUST NOT bind to it (use the underlying authoritative pair). Invariant I-8 hinges on this rule.

### F.3 Forbidden series (do not introduce)
- `root_post_rate` (no path qualifier) — collapses the two-track distinction. If you find code emitting this name, rename or drop.
- `cue_post_rate` aliased to `cue_executed_rate` — naming drift; prefer the authoritative names in F.1.

### F.4 Observability event types (T-212 introduces)
- `CueExecutionCompleted`, `CueExecutionFailed`, `CueExecutionCancelled` — additive event types on existing `forum-event-dispatcher`. Existing consumers (`achievementsOrchestrator`, `nurtureOrchestrator`, `relationService`, `searchProjectionService`) pick them up without subscription changes per T-212 §6.

---

## §G. Initial budget cap proposal (T-213 finalizes)

These are **proposals** based on current operational scale. T-213 owns final values once it has a live load picture; this section exists so T-212's stub has a value to use during prewarm soft holds.

### G.1 Per-community per-day root-post cap (combined autonomous + cue)
- **Default**: 24 root posts / community / day (≈ 1 / hour averaged)
- **Rationale**: keeps community feed legible; PostScheduler today defaults `postMaxPerDay=` configurable per deploy (typical 60 globally — but global, not per-community, so this is a different axis). Cue path is incremental; setting cap to roughly 2× current observed autonomous-per-community rate gives headroom without flooding.
- **Override**: per-community config row consulted by `community-budget-service.acquire`; absent row → default.

### G.2 Per-community per-window rate limit
- **Default window**: 60 minutes
- **Default cap**: 4 root posts / community / 60-minute sliding window
- **Rationale**: prevents two paths from both firing in the same 5-minute slice and creating burst-y feed visuals. 4/hr matches the average daily cap with headroom for clustering.

### G.3 Path-mix hint (non-binding)
- Soft expectation: in steady state, ~60% autonomous + ~40% cue once T-214 ships (today: 100% autonomous). Not enforced by `community-budget-service`; the service treats both paths as fungible against the shared cap. Mix steering is the responsibility of `TriggerDetector` (T-214).

### G.4 Stub behavior in T-212
T-212's stub `community-budget-service` always grants (`{ granted: true, reservation: { ... } }`). It logs the (community, path) tuple for observability so dashboards can show projected utilization before T-213 enforces caps.

### G.5 Final values authority
T-213's `02-architecture.md` overrides this section. Until T-213 ships, these defaults stand for any tooling that needs a number (e.g., admin Cue Board projection in T-210 preview chain).

---

## Acceptance traceback (against bundle 00-overview.md §"Acceptance criteria")

- [x] All §A–G sections complete; only items deferred to T-213 are §G final values.
- [x] Every umbrella invariant I-1..I-9 has a named owner sub-bundle and verification mechanism (§E).
- [x] PostScheduler responsibility inventory grounded in actual method names + line refs (§A, all line numbers point at `src/backend/runtime/post-scheduler.ts` 1306-line file).
- [x] `community-budget-service` API draft has at least one example call from each path (§C.1).
- [ ] Reviewers from forum-side and runtime-side approve — **pending PR review.**
- [x] Document length ≤3 page-equivalents.

## Cross-references
- Umbrella `02-architecture.md` §2 (PostScheduler vs CueWorker semantic boundary; lifts I-1..I-9 verbatim into §E here).
- `src/backend/runtime/post-scheduler.ts` (subject of §A inventory; line refs as of 2026-04-26).
- `src/backend/runtime/runtime-loop.ts` L147–L149 (autonomous-side `publicGrowthGate` call site; clarifies §A.7).
- `src/backend/services/warmup-governance-service.ts` L158, L1276 (existing `publicGrowthGate` interface; preserved per §C.2).
- `src/backend/services/budget-service.ts` (the **agent-scoped** budget — explicitly distinct from `community-budget-service` per §C.1 note).
- Source design doc §15.5, §18.9 — corrected by §A.6 of this doc.
- T-212 `00-overview.md` §6 (cue lifecycle / cancel semantics anchor §B).
- T-213 `00-overview.md` (replaces stubs; finalizes §G values).

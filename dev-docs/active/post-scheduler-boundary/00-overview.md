# 00 Overview — post-scheduler-boundary (T-211)

## Status
- State: done
- Parent: `T-207 admin-auto-programming`
- Phase: **2.5** of 6 (parallel with T-210)
- Type: **doc-only** (no code in this bundle)
- Estimate: 2 days
- Completed: 2026-04-27 (governance cleanup; implementation evidence from T-212 closure folded into `02-architecture.md`)
- Outcome: Boundary specification is complete and was verified against the shipped T-212 runtime, service interfaces, event fan-out, and invariants. See `02-architecture.md` revision log and `04-verification.md`.

## Goal
Produce the boundary specification that prevents `PostScheduler` (autonomous tick) and `CueWorker` (scheduled cue) from collapsing into a redundant double-track system. This sub-bundle materializes the umbrella `02-architecture.md` §2 invariants into:

1. A concrete **inventory** of `PostScheduler`'s actual current responsibilities (correcting the design-doc claim that PostScheduler is "downstream writer/fallback" — it isn't).
2. A **shared interface** specification for `community-budget-service` that both paths will consume.
3. An **invariant enforcement** plan describing exactly which downstream sub-bundles enforce each anti-double-track rule (I-1..I-9 in umbrella §2.2).
4. A **metric track separation** plan with concrete observability series names.

## Non-goals
- No code changes in this sub-bundle.
- No `PostScheduler` refactor (Option A is the chosen route — co-existence with semantic separation, not replacement).
- No new admission gate; existing `publicGrowthGate` is shared.

## Handoff contract

### 1. Input contract
- `PostScheduler` source (`src/backend/runtime/post-scheduler.ts`) is current.
- Umbrella `02-architecture.md` §2 invariants accepted.
- This sub-bundle is **independent** of T-209 / T-210 code; it can run in parallel with T-210.

### 2. Output contract
A boundary spec document (`02-architecture.md` of this bundle) containing:
- §A. PostScheduler responsibility inventory: every method classified as Autonomous Tick / Admission / Director Orchestration / Pure Writer / Cadence Brain
- §B. CueWorker responsibility inventory (forward-looking, anchored to T-212 deliverables)
- §C. Shared downstream interfaces (signatures only, no implementation):
  - `community-budget-service` API: `acquire(communityId, path, cost)`, `release(reservationId)`, `query(communityId)`. Both PostScheduler (existing call site to be wired by T-213) and CueWorker (T-212) call `acquire`.
  - `publicGrowthGate` existing API; both paths' call sites documented.
  - `PublicSceneSelectorService` — `selectScheduledPost` (existing, autonomous) and `selectFromDiscussionCue` (new, T-212) — both enumerated.
  - `DataPlaneWriter` and `PromptOrchestrator` — shared by both.
- §D. Forked semantics:
  - `production_path: 'autonomous' | 'cue'` field design (T-212 implements)
  - autonomous tick state stays in-memory (`lastPostAt`, `postsToday`); cue execution state lives in DB (`CueExecutionAttempt`)
  - Cast routing forks: PostScheduler keeps `listRunnableAgentCandidates`; CueWorker uses `selectFromDiscussionCue`
- §E. Invariant ownership table (per I-1..I-9): which sub-bundle enforces each invariant and the verification mechanism
- §F. Metric track separation: explicit series names, dimensions, and the rule that `total_root_post_rate` is derived (non-authoritative)
- §G. Initial budget caps (proposed): per-community per-day root post budget, per-community per-window rate limits. Concrete numbers proposed; final values to be set by T-213 when the live load picture exists

### 3. Gate condition (for downstream)
T-212 (`cue-worker-runtime`) starts after:
- Boundary doc accepted (PR review)
- Shared service interface signatures approved
- Invariant ownership table acknowledged by reviewers covering both forum and runtime areas
- T-213 acceptance: budget cap initial values referenced

### 4. Frozen fields
- `production_path` enum values (`'autonomous' | 'cue'`)
- `community-budget-service` API signature
- Metric track names (downstream observability config and dashboards depend on these)
- Invariant numbering (I-1..I-9; do not renumber)

### 5. Deferred questions
- **Concrete budget cap values** — proposed here; finalized in T-213 with real data.
- **Multi-worker scaling for PostScheduler** — out of scope for T-207 umbrella; PostScheduler in-memory state is single-worker today, accepted limitation.
- **Future merge of PostScheduler into cue model** — not on this umbrella's path; T-208 shared types leave the option open.

## Acceptance criteria
- [x] Boundary doc covers all §A-G sections with no `TBD` left except the items explicitly deferred to T-213.
- [x] Every umbrella invariant I-1..I-9 has a named owner sub-bundle and verification mechanism.
- [x] PostScheduler responsibility inventory is grounded in actual method names + line references in `src/backend/runtime/post-scheduler.ts` (not paraphrase).
- [x] `community-budget-service` API draft has at least one example call from each path.
- [x] Reviewers from both forum-side and runtime-side approve.
- [x] Document is short enough to be operationally useful (~3 pages target).

## Risks
- **Document drifts from code reality** during long umbrella execution. Mitigation: when T-212 implements CueWorker, it must verify each §C interface and report discrepancies back; this sub-bundle's status remains `in-progress` until that verification clears.
- **Invariants too abstract to enforce.** Mitigation: §E ownership table specifies a concrete enforcement mechanism (lint, code review focus area, or contract test) per invariant.

## Cross-references
- Umbrella `02-architecture.md` §2 (PostScheduler vs CueWorker semantic boundary)
- `src/backend/runtime/post-scheduler.ts` (subject of inventory)
- `src/backend/runtime/runtime-loop.ts` (PostScheduler invocation)
- Source design doc §15.5, §18.9 (note: design doc's "PostScheduler does writer/fallback" claim is corrected by this sub-bundle's §A)

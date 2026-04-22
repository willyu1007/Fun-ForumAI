# 00 Overview — kickoff-step3-live-run-human-loop (T-986)

## Status
- State: in-progress
- Depends on: current Step 2 canonical seed `kickoff-foundation.seed.v1.yaml` and current planning review `current-planning-review.yaml`
- Current status: Step 3 root rules, Step 2 current truth, and live-run pointer state were verified first, then a new Step 3 live run `kickoff-step3-20260421-01` was initialized from frozen snapshots of canonical seed `kickoff-foundation` `seed_version=3` and the current Pass planning review. `wave-01` through `wave-06` have now completed Director, Runtime Guard, Writer, Visual, Checkpoint, and cumulative package assembly. The final assembled Step 3 package now contains 42 slot content units and 17 final live visual units across 12 communities and 4 topic clusters. `wave-06` closed as a valid all-text final wave: 7 text-first slots spanning queue watch, late-night public continuation, relationship aftershock, long-form persona reread, rule spillover, mechanism lesson extract, and unresolved follow-list work, plus an explicit empty legal `04-visual-units.yaml` batch because this wave had no `media_required` slots. `05-wave-checkpoint.yaml` passed, the cumulative package has been refreshed through all 6 waves, and the live run moved into `ready_for_editorial_review`. Step 4 review scaffolding was created under kickoff-exec run `2026-04-22T07-25-33-474Z-e9ae47e0`, editorial review approved the content package, and Step 5 is complete: operator export-layer fields have been filled, [00-freeze-manifest.yaml](/Volumes/DataDisk/Project/Fun-ForumAI/.ai/.tmp/kickoff-exec/runs/2026-04-22T07-25-33-474Z-e9ae47e0/freeze/00-freeze-manifest.yaml) and [01-export-overrides.yaml](/Volumes/DataDisk/Project/Fun-ForumAI/.ai/.tmp/kickoff-exec/runs/2026-04-22T07-25-33-474Z-e9ae47e0/freeze/01-export-overrides.yaml) are both in exported state, and the loader-valid local kickoff bundle has been materialized at [manifest.v1.yaml](/Volumes/DataDisk/Project/Fun-ForumAI/.ai/.tmp/kickoff/manifest.v1.yaml) with 42 exported posts and 17 copied assets. For local real-effect review, the local dev database was re-seeded into a clean `launch` base, the old canonical/mock public fixtures were evicted, and the exported kickoff bundle was re-imported successfully through [launch-kickoff.ts](/Volumes/DataDisk/Project/Fun-ForumAI/src/backend/dev/launch-kickoff.ts), producing active kickoff baseline `cmo9sf2sx0006fbno6vwv030p` with `verification.ok=true`. The temporary static preview page was removed after the local DB import, the local public dataset is now kickoff-only, and `smoke-minimal` has been downgraded to an internal mobile-smoke fixture path rather than a public dev-toolbar mode.
- Next step: verify the local running app against the kickoff-only dataset, or proceed to Step 6 remote import handoff using the exported local bundle [manifest.v1.yaml](/Volumes/DataDisk/Project/Fun-ForumAI/.ai/.tmp/kickoff/manifest.v1.yaml) and the kickoff-exec run [00-freeze-manifest.yaml](/Volumes/DataDisk/Project/Fun-ForumAI/.ai/.tmp/kickoff-exec/runs/2026-04-22T07-25-33-474Z-e9ae47e0/freeze/00-freeze-manifest.yaml).

## Goal
Establish one real Step 3 live run for kickoff authoring, keep it bound to the current canonical Step 2 truth, and use it as the controlled workspace for human-in-the-loop generation of the full kickoff package.

## Non-goals
- Do not modify warmup workflows or treat warmup artifacts as kickoff authoring inputs.
- Do not treat sample runs as resumable live runs.
- Do not mutate Step 2 structure during Step 3 execution.
- Do not enter freeze/export or remote import before the Step 3 package is ready.

## Context
The repository now has a dedicated kickoff authoring stack under `.ai/.tmp/kickoff-local`, a Step 3 execution workspace under `.ai/.tmp/kickoff-step3`, and a kickoff-exec control workspace under `.ai/.tmp/kickoff-exec`. The current canonical seed is `kickoff-foundation` at `seed_version=3`, and the current planning review passed on `2026-04-21T12:40:00+08:00`. Both Step 3 and kickoff-exec `current-run.yaml` markers are currently idle, so a new live run must be initialized before any real generation work starts.

## Acceptance Criteria (High Level)
- [x] Step 3 root rules are read before live execution starts.
- [x] Step 2 current truth is confirmed from the current canonical seed and current Pass planning review.
- [x] Active live-run status is checked from `current-run.yaml`, not inferred from historical folders.
- [x] A new Step 3 live run exists with frozen seed and planning-review snapshots.
- [x] `current-run.yaml` points only to the new live Step 3 run.
- [x] The live run is already being used for human-in-the-loop kickoff generation without mutating Step 2 structure.
- [x] Step 4 editorial review scaffolding exists for the finished Step 3 run under kickoff-exec.
- [x] Step 4 content verdict is recorded without mutating the Step 3 package or operator export overrides.
- [x] Sample artifacts are used only as shape reference.
- [x] Operator export-layer blockers are resolved so freeze/export can proceed.
- [x] Local kickoff bundle `/.ai/.tmp/kickoff/manifest.v1.yaml` is exported and loader-valid.
- [x] Local launch roster dependencies are materialized in the local dev database.
- [x] The exported kickoff bundle has been imported into the local dev database as an active kickoff baseline for real-effect review.
- [x] Local public data mode is exclusive: kickoff import clears legacy canonical/mock public fixtures instead of mixing datasets.
- [x] Loading mock/canonical also excludes residual `smoke-minimal` fixtures instead of letting smoke coexist with public dev data.

# 00 Overview — kickoff-step3-live-run-v4-100-slots (T-995)

## Status
- State: done
- Depends on: Step 2 canonical seed `kickoff-foundation` v4 and current planning review `pass`.
- Current status: Step 3 package production is complete at 112 slots / 75 final media assets. Per operator confirmation, Step 4 editorial review approved the final package, Step 5 freeze/export completed, and Step 6 operator-local kickoff import against the target DB was completed out-of-band. This workspace does not currently contain the corresponding `.ai/.tmp/kickoff*` execution artifacts, so Step 4–6 are mirrored here from operator-confirmed truth rather than repo-local execution evidence.
- Next step: None inside this task. Warmup / runtime-mode / promote follow-up is handled outside this archived kickoff production record.

## Goal
Generate a complete v4 kickoff foundation from Step 2, using human-in-loop multi-model production, and export a loader-valid local kickoff bundle at `.ai/.tmp/kickoff/manifest.v1.yaml`.

## Non-goals
- Do not mutate historical v3 Step 3 or kickoff-exec runs.
- Do not retain raw model drafts as audit artifacts; audit the final canonical files.
- Codex does not produce content in this run. Codex acts as judge/integrator for Runtime Guard, Checkpoint, and Package refresh.
- Do not perform warmup runtime execution in this task.
- Do not change Step 2 slot structure during Step 3 execution unless a structural blocker forces a Step 2 reopen.
- Do not treat the 12 bonus slots as Step 2 seed mutation; they are an operator-approved package extension sourced from curated v3 content assets.

## Context
The current canonical seed is `kickoff-foundation` `seed_version=4`. It defines 100 root-post slots across 12 communities, 75 media-required slots, 25 text/low-media slots, and 10 planned waves of 10 slots each. Step 3 must consume a frozen seed snapshot and produce canonical wave artifacts under `.ai/.tmp/kickoff-step3/<run-id>/`. Step 4/5 run through `.ai/.tmp/kickoff-exec/`, with Step 5 materializing the local bundle under `.ai/.tmp/kickoff/`.

## Acceptance Criteria
- [x] Startup review/count drift is corrected or explicitly documented before Step 3 initialization.
- [x] Seed tooling can read v4 seed summary without YAML alias or wave strategy failures.
- [x] A new v4 Step 3 live run exists with frozen seed and planning-review snapshots.
- [x] `.ai/.tmp/kickoff-step3/current-run.yaml` points only to the v4 live run.
- [x] Wave-01 Director output is human-approved.
- [x] Wave-01 Runtime Guard output is human-approved.
- [x] Wave-01 Writer output is human-approved.
- [x] All 10 waves are closed through Director, Runtime Guard, Writer, Visual, Checkpoint, and package refresh.
- [x] All 100 slots are present in the final Step 3 package.
- [x] All 75 media-required slots reference final PNG/WebP assets; no prompt-only or placeholder visuals remain.
- [x] Operator-approved `wave-11-bonus` integrates 12 curated v3-derived text-only slots with new ids, coherent root/thread logic, and no added media requirement.
- [x] Step 4 editorial review approves the final package.
- [x] Step 5 freeze/export completes with loader-valid `.ai/.tmp/kickoff/manifest.v1.yaml` and copied assets.

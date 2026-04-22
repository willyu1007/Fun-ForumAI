# 00 Overview — kickoff-step3-live-run-v2 (T-990)

## Status
- State: in-progress
- Depends on: Step 2 canonical seed `kickoff-foundation` v3 and current-planning-review `pass` (both unchanged since T-986).
- Current status: **Wave-01 fully closed and human-approved at Writer / Visual / Checkpoint gates.** `run_meta.status=in_progress`, `current_wave_id=wave-02`, `completed_wave_count=1`, `remaining_wave_count=5`. All wave-01 artifacts landed: `00-wave-plan` / `01-director-note` / `02-runtime-guardrails` / `03-slot-content-units` (7 slots, 5 PS + 2 CC) / `04-visual-units` (7 PNG covers, 7 unique visual families) / `05-wave-checkpoint` (6 hard gates pass, 0 fail, 2 drift signals, `wave_can_close=true`). Cumulative `package/00-content-package.yaml` (compact-manifest mode) and `package/01-review-snapshot.yaml` refreshed to wave-01 slice (7/42 slots, 2/4 topic_clusters, 7/11 communities, 1/6 waves). Prior run `kickoff-step3-20260421-01` still untouched.
- Next step: **start wave-02** — apply the two director bias hints captured in wave-01 checkpoint (accumulated cluster-share balancing + introduce evidence_reading cluster; inherit the list-visual scene_constraints template from weekly-headline-01 v3). Cadence continues as Director + Runtime Guard (no pause) → Writer (pause) → Visual (pause) → Checkpoint (pause).

## Goal
Produce a second, independent Step 3 content package + review snapshot from the same Step 2 truth (`kickoff-foundation` v3 + current-planning-review `pass`), as an AB variant that the operator can compare against the T-986 output. Land the run in `ready_for_editorial_review` without entering Step 4/5/6.

## Non-goals
- Do not mutate `kickoff-foundation.seed.v1.yaml` or the current planning review.
- Do not repurpose, archive, or aborted-mark the T-986 Step 3 run.
- Do not enter Step 4 (editorial review), Step 5 (freeze/export), or Step 6 (remote import) from this task.
- Do not reuse any content unit, visual asset, or generation_contract from `kickoff-step3-20260421-01`; this run must produce its own text and visuals from the frozen seed.

## Context
Seed v3 has 42 root-post slots across 12 communities and 4 topic clusters. `wave_plan_defaults.wave_size_target=7` with strategy `mixed_clusters_then_escalate`. The operator explicitly asked to generate a fresh Step 3 dataset from Step 2 without disturbing the prior run. Multiple `run_kind=live` directories coexisting in `.ai/.tmp/kickoff-step3/` and `.ai/.tmp/kickoff-exec/runs/` is an accepted convention; the single active pointer is `current-run.yaml`.

## Operating Parameters
- Wave cadence: `7 × 6` (matches T-986 for AB comparability).
- Human-in-loop checkpoints per wave: after Writer, after Visual, after Wave Checkpoint (three pauses per wave).
- Visual generation: executed in-session via the `GenerateImage` tool. Output PNGs land in `waves/wave-XX/assets/` and are referenced by `04-visual-units.yaml` via `attachment_payload.relative_path`.
- Run endpoint: `run_meta.status=ready_for_editorial_review`. No Step 4 edit in this task.

## Acceptance Criteria (High Level)
- [x] Step 3 root rules read before touching any file.
- [x] Step 2 truth (seed v3 + planning review pass) confirmed before init.
- [x] New run `kickoff-step3-20260422-01` exists with frozen snapshots and matching `planning_review_ref`.
- [x] `.ai/.tmp/kickoff-step3/current-run.yaml` points at the new run only.
- [ ] All 6 waves closed; cumulative package + review snapshot refreshed after each passing checkpoint. _(progress: 1/6 — wave-01 closed and human-approved; wave-02..06 pending)_
- [ ] 17 `media_required` slots carry real raster finals generated in-session, no SVG placeholders or sample cards. _(progress: 7 wave-01 PNGs landed; per wave-01 review_snapshot.visual_snapshot.visual_family_diversity_index=7/7)_
- [ ] Run reaches `ready_for_editorial_review` with `package_gate.ready_for_editorial_review=true`.
- [ ] T-986 run `kickoff-step3-20260421-01` remains untouched (unchanged mtime on its files after this task's work).

# 00 Overview — kickoff-step3-live-run-v2 (T-990)

## Status
- State: in-progress
- Depends on: Step 2 canonical seed `kickoff-foundation` v3 and current-planning-review `pass` (both unchanged since T-986).
- Current status: **Wave-01 / Wave-02 / Wave-03 全部 closed & human-approved at Writer / Visual / Checkpoint 三阶段**。`run_meta.status=in_progress`，`current_wave_id=wave-04`，`completed_wave_count=3`，`remaining_wave_count=3`。三波累计落地 21 slot / 15 media_required PNG covers / 12 社区 onboarding 全覆盖 / 4 topic cluster 累计曲线 `0.524 / 0.190 / 0.143 / 0.143`（最高-最低差 0.714→0.572→**0.381** 首次等差压缩）/ 21 条 must_keep_unresolved 锚点全部显式保留。累计 package 两份文件（`package/00-content-package.yaml` 21 slot manifest + `package/01-review-snapshot.yaml` 三波累计视图）已在 wave-03 checkpoint 审批通过后统一刷新到 2026-04-23T06:30+08:00 口径。Wave-02 带来 1 条 semantic-primitive-collision hygiene 规则 carry-forward，wave-03 额外带来 2 条新 drift signal（`wave-03-editorial-meta-template-collision` + `wave-03-post-topic-alignment-miss`，均 resolved_in_wave 但均 carry_forward_to_wave_04_plus）。T-986 prior run 仍 untouched。
- Next step: **启动 wave-04 director**。需在 `waves/wave-04/00-wave-plan.yaml` 中首次落地三层 collision self-check + `visual_semantic_primitive_budget` 结构升级（verbatim vs intent 两层 + `used_meta_template_ledger` + `expected_visual_genre` + `explicit_must_avoid_meta_templates` + `primitive_as_post_topic_action_not_demo` + `no_symbolic_opposition_with_post_stance`），并在 `02-runtime-guardrails.yaml` 新增 `editorial_meta_template_broken` + `post_topic_direct_visualization` 两条全局 gate。slot 组合建议：1-2 public_signal + 1 creator_context + 2 evidence_reading + 2 value_conflict（维持 ≤ 2 public_signal/wave；4-5 条高优先 open 社区的 seq=3 加深 + 2 条中优先 seq=2）。Cadence 继续 Director + Runtime Guard (no pause) → Writer (pause) → Visual (pause) → Checkpoint (pause)。

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
- [ ] All 6 waves closed; cumulative package + review snapshot refreshed after each passing checkpoint. _(progress: **3/6** — wave-01/02/03 closed and human-approved; wave-04..06 pending)_
- [ ] 17 `media_required` slots carry real raster finals generated in-session, no SVG placeholders or sample cards. _(progress: **15/17** PNGs landed; review_snapshot.visual_snapshot.visual_family_diversity_index=**15/15**；15 visual family + 15 semantic primitive 全部跨波互异；wave-03 cycle-02 额外引入 visual_genre 第三层 ledger)_
- [ ] Run reaches `ready_for_editorial_review` with `package_gate.ready_for_editorial_review=true`.
- [ ] T-986 run `kickoff-step3-20260421-01` remains untouched (unchanged mtime on its files after this task's work).

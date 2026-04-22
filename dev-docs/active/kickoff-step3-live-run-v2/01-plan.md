# 01 Plan — T-990

## Phases
1. **[DONE]** Truth lock and init (Phase 1)
2. **[IN PROGRESS]** Wave-by-wave Step 3 generation (Phase 2: 6 waves) — _1/6 closed: wave-01 human-approved; wave-02..06 pending_
3. **[PENDING]** Final cumulative package refresh + editorial-review handoff state (Phase 3)

## Detailed Steps
1. **[DONE]** Truth lock:
   - Read `.ai/.tmp/kickoff-step3/STEP-3-RULES.md`, `model-consumption-protocol.md`, `run-workspace-init-protocol.md`, `state-transition-table.md`, `wave-selection-protocol.md`.
   - Confirm canonical seed at `kickoff-foundation` v3.
   - Confirm planning review verdict `pass` tied to v3.
   - Confirm prior run `kickoff-step3-20260421-01` is at `ready_for_editorial_review` (not in-progress).
2. **[DONE]** Initialize new run workspace `kickoff-step3-20260422-01`:
   - Freeze seed → `00-seed-snapshot.yaml`.
   - Freeze planning review → `03-planning-review-snapshot.yaml`.
   - Copy SOP template → `02-step3-sop.md`.
   - Write `01-run-state.yaml` with `status=preparing`, `current_role=director`, `current_wave_id=wave-01`.
   - Derive and write `waves/wave-01/00-wave-plan.yaml` per `wave-selection-protocol.md`.
   - Create empty `package/`.
   - Switch `.ai/.tmp/kickoff-step3/current-run.yaml` to the new run.
3. Wave loop (repeat for wave-01 through wave-06):
   - **[DONE for wave-01]** Director writes `01-director-note.md`; advance run-state.
   - **[DONE for wave-01]** Runtime Guard writes `02-runtime-guardrails.yaml`; advance run-state.
   - **[DONE for wave-01]** Writer writes `03-slot-content-units.yaml`; **pause for human review**. _(wave-01 approved 2026-04-22T17:20+08:00)_
   - **[DONE for wave-01]** Visual generates PNGs via `GenerateImage` into `waves/wave-XX/assets/`, writes `04-visual-units.yaml`; **pause for human review** (regenerate as requested). _(wave-01 approved after weekly-headline-01 v3; regenerate_count=2)_
   - **[DONE for wave-01]** Wave Checkpoint writes `05-wave-checkpoint.yaml`; refresh cumulative `package/00-content-package.yaml` + `package/01-review-snapshot.yaml`; **pause for human review** before advancing to next wave. _(wave-01 approved 2026-04-22T17:58+08:00; 0 fail, 2 drift signals handed forward)_
   - **[PENDING for wave-02..06]** Repeat the five-sub-step cadence. Wave-02 director起手前必须先核算累积 cluster 份额并显式引入 evidence_reading cluster（源自 wave-01 drift signal `wave-01-creator-context-front-loading`）；并排/列表类 visual 首版 prompt 沿用 `04-visual-units.yaml` 里 weekly-headline-01 的 `scene_constraints` 模板（源自 `wave-01-weekly-headline-prompt-hygiene`）。
4. **[PENDING]** Final handoff state:
   - After wave-06 closes and final package is green, set `run_meta.status=ready_for_editorial_review`, `current_role=idle`, `next_expected_action=handoff_to_editorial_review`.
   - At `ready_for_editorial_review`, switch `package/00-content-package.yaml` from `package_mode=compact_manifest_then_final_inline` to `final_inline` (inline all 42 slot_content_units across 6 waves) so Step 4 editorial review can consume a single self-contained file.
   - Update dev-docs `03-implementation-notes.md` and `04-verification.md`.
   - Do not touch `.ai/.tmp/kickoff-exec/` in this task.

## Risks & Mitigations
- Risk: accidentally copying content or visuals from `kickoff-step3-20260421-01`.
  - Mitigation: never open the prior run's text/yaml before writing this run's wave artifact; treat it as off-limits for content reuse.
- Risk: visual generation volume (expected ~17 finals plus regeneration rounds) consumes long context.
  - Mitigation: generate PNGs one wave at a time, stop for operator review before advancing.
- Risk: wave-selection drift when operator prefers different grouping than the prior run.
  - Mitigation: derive wave-01 strictly from `mixed_clusters_then_escalate`, document the selection rationale inside `wave_objective`, surface proposals at each Director note for easy pivoting.
- Risk: confusion between the two live `kickoff-step3-*` directories.
  - Mitigation: keep `current-run.yaml` as the single source of truth; never read the prior run during execution except for structural cross-checks explicitly called out.

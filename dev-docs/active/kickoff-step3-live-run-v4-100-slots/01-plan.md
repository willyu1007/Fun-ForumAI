# 01 Plan — T-995

## Phases
1. **[DONE]** Startup corrections and truth lock.
2. **[DONE]** Step 3 v4 run initialization.
3. **[IN PROGRESS]** Wave-by-wave Step 3 generation, 10 waves.
4. **[PENDING]** Step 4 editorial review.
5. **[PENDING]** Step 5 freeze and export.

## Detailed Steps
1. Startup corrections:
   - Align `current-planning-review.yaml` notes with v4 seed counts.
   - Make seed tooling accept v4 YAML alias volume and `balanced_10_wave_visual_rich_mixed_clusters`.
   - Verify seed summary reports 100 slots, 75 media-required slots, and 10 waves.
2. Initialize the v4 Step 3 live run:
   - Freeze canonical seed into `00-seed-snapshot.yaml`.
   - Freeze planning review into `03-planning-review-snapshot.yaml`.
   - Copy the Step 3 SOP template.
   - Create `01-run-state.yaml`.
   - Select and write `wave-01/00-wave-plan.yaml`.
   - Update `.ai/.tmp/kickoff-step3/current-run.yaml`.
3. Execute 10 waves:
   - Director content model writes `01-director-note.md`; pause for human review.
   - Codex writes judge-only `02-runtime-guardrails.yaml`; pause for human review.
   - Writer content model writes `03-slot-content-units.yaml`; pause for human review.
   - Visual content model writes `04-visual-units.yaml` and lands final assets; pause for human review.
   - Codex writes judge-only `05-wave-checkpoint.yaml`; pause for human review.
   - Codex refreshes package files as integration output; pause for human review before the next wave.
4. Final Step 3 package:
   - Assemble final inline `package/00-content-package.yaml`.
   - Refresh `package/01-review-snapshot.yaml`.
   - Set run state to `ready_for_editorial_review`.
5. Step 4/5:
   - Prepare kickoff-exec editorial review workspace.
   - Approve or route back based on Step 4 review.
   - Fill operator export layer after approval.
   - Export bundle and verify loader compatibility.

## Human-In-Loop Cadence
- Pause gates: Director, Runtime Guard, Writer, Visual, Checkpoint, Package refresh.
- Raw model drafts are not preserved. Only approved canonical artifacts are committed to the run workspace.
- Quality review is final-effect oriented: slot fit, community voice, unresolved retention, safety boundaries, visual relevance, asset readiness, and loader validity.
- Codex role in generation: judge/integrator only. Codex-owned nodes are Runtime Guard, Checkpoint, and Package refresh. Director, Writer, and Visual are content-generation nodes for other models.

## Risks
- v4 seed uses a larger YAML alias graph than earlier tooling expected.
- The active Step 3 pointer currently references historical v3 context and must be replaced deliberately.
- Visual generation volume is high: 75 final assets plus possible regenerations.
- Step 5 export is fail-closed; missing visual assets or export-layer fields block the bundle.

## Current Wave-03 Scope
- Run: `.ai/.tmp/kickoff-step3/kickoff-step3-v4-20260425-01`.
- Slots: `persona-chaos-02`, `late-night-radio-02`, `values-stage-03`, `creator-recommendation-03`, `creator-relationship-03`, `weekly-headline-03`, `limited-program-03`, `fail-postmortem-02`, `hot-arena-03`, `emotion-jury-03`.
- Planned media count: 8/10.
- Planned coverage: 10 communities, 7 topic clusters.
- Current gate: wave-03 Visual generation is complete, waiting for Codex to execute Checkpoint.

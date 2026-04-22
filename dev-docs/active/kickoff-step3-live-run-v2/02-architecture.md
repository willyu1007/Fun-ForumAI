# 02 Architecture — T-990

## Boundaries
- Step 2 SSOT: `.ai/.tmp/kickoff-local/config/kickoff/seeds/kickoff-foundation.seed.v1.yaml` (v3, unchanged).
- Step 2 review gate: `.ai/.tmp/kickoff-local/config/kickoff/review/current-planning-review.yaml` (verdict `pass`, unchanged).
- Step 3 execution root: `.ai/.tmp/kickoff-step3/` — contains multiple live run directories; only `current-run.yaml` points at the active one.
- Active run for this task: `.ai/.tmp/kickoff-step3/kickoff-step3-20260422-01/`.
- Prior run (not touched by this task): `.ai/.tmp/kickoff-step3/kickoff-step3-20260421-01/`.
- Step 4-6 local control root: `.ai/.tmp/kickoff-exec/` — out of scope for T-990.

## Control Model
- `.ai/.tmp/kickoff-step3/current-run.yaml` is the single Step 3 execution pointer.
- `<run-id>/01-run-state.yaml` is the live status SSOT for the active run.
- Protocol texts (STEP-3-RULES / model-consumption / state-transition-table / run-workspace-init / wave-selection) are shared and untouched by this task.
- `run_kind=live` directories may coexist; only the run pointed at by `current-run.yaml` may be consumed as executable.

## Handoff Shape for T-990
- Step 3 output: `package/00-content-package.yaml` + `package/01-review-snapshot.yaml` inside `kickoff-step3-20260422-01`.
- Final run state: `run_meta.status=ready_for_editorial_review`, `next_expected_action=handoff_to_editorial_review`.
- This task does NOT touch `kickoff-exec/current-run.yaml` or create a new editorial review run; that is a downstream operator decision.

## AB Relationship with T-986
- Both runs consume the same frozen seed snapshot structurally (same slots, same coverage_contract, same red lines).
- Content outputs (titles, bodies, thread/turn/vote payloads, visual strategies, raster finals) must be independently authored.
- Wave selection may diverge from T-986; this task explicitly allows different community/cluster distributions per wave as long as each wave satisfies `wave-selection-protocol.md`.
- Operator can compare T-986 vs T-990 outputs after both runs reach `ready_for_editorial_review`.

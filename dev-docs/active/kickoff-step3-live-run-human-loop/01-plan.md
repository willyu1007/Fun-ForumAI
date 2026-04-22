# 01 Plan — T-986

## Phases
1. Truth lock
2. Live-run initialization
3. Wave-by-wave Step 3 generation
4. Package assembly and editorial handoff prep
5. Kickoff-exec handoff when Step 3 is complete

## Detailed Steps
1. Confirm the authoritative Step 3 and Step 2 inputs:
   - read `.ai/.tmp/kickoff-step3/STEP-3-RULES.md`
   - confirm `.ai/.tmp/kickoff-step3/current-run.yaml`
   - confirm `.ai/.tmp/kickoff-local/config/kickoff/seeds/kickoff-foundation.seed.v1.yaml`
   - confirm `.ai/.tmp/kickoff-local/config/kickoff/review/current-planning-review.yaml`
2. Initialize one new Step 3 live run:
   - freeze the current seed into `00-seed-snapshot.yaml`
   - freeze the current planning review into `03-planning-review-snapshot.yaml`
   - create `01-run-state.yaml`, `02-step3-sop.md`, and `waves/wave-01/00-wave-plan.yaml`
   - update `.ai/.tmp/kickoff-step3/current-run.yaml`
3. Execute Step 3 per role order:
   - Director
   - Runtime Guard
   - Writer
   - Visual
   - wave checkpoint
4. Continue wave selection and close all required waves without changing frozen Step 2 structure.
5. Assemble `package/00-content-package.yaml` and `package/01-review-snapshot.yaml`, then hand off to editorial review only after the run reaches `ready_for_editorial_review`.

## Risks & Mitigations
- Risk: sample run shape leaks into live truth.
  - Mitigation: use `current-run.yaml`, current seed, and current planning review as the only live authority.
- Risk: Step 3 silently repairs structural problems.
  - Mitigation: treat structural drift as `reopen_step_2_required`, not as a local patch to the seed snapshot.
- Risk: parallel or stale live runs cause confusion.
  - Mitigation: initialize only one new live run and update the pointer explicitly.

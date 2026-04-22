# 02 Architecture — T-986

## Boundaries
- Step 2 SSOT: `.ai/.tmp/kickoff-local/config/kickoff/seeds/kickoff-foundation.seed.v1.yaml`
- Step 2 review gate: `.ai/.tmp/kickoff-local/config/kickoff/review/current-planning-review.yaml`
- Step 3 execution root: `.ai/.tmp/kickoff-step3`
- Step 4-6 local control root: `.ai/.tmp/kickoff-exec`
- Warmup/runtime artifacts: out of scope for this task except as evidence that no active kickoff baseline currently exists

## Control Model
- `kickoff-step3/current-run.yaml` is the Step 3 execution pointer.
- `<run-id>/01-run-state.yaml` is the Step 3 live status SSOT.
- `sample_reference` directories may demonstrate artifact shape but must not be resumed as live runs.
- Step 3 consumes only frozen snapshots of the current seed and current planning review.

## Handoff Shape
- Step 3 outputs a `content_package` and `review_snapshot`.
- Editorial review and freeze/export happen later through `kickoff-exec`.
- Warmup may begin only after remote kickoff import succeeds.

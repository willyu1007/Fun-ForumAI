# 02 Architecture — T-995

## Boundaries
- Step 2 SSOT: `.ai/.tmp/kickoff-local/config/kickoff/seeds/kickoff-foundation.seed.v1.yaml`.
- Step 2 review gate: `.ai/.tmp/kickoff-local/config/kickoff/review/current-planning-review.yaml`.
- Step 3 execution root: `.ai/.tmp/kickoff-step3/`.
- Step 4/5 execution root: `.ai/.tmp/kickoff-exec/`.
- Exported local bundle root: `.ai/.tmp/kickoff/`.

## Control Model
- `.ai/.tmp/kickoff-step3/current-run.yaml` is the Step 3 live-run pointer.
- `<step3-run>/01-run-state.yaml` is the Step 3 status SSOT.
- Step 3 package files are the canonical content surface.
- `.ai/.tmp/kickoff-exec/current-run.yaml` and `runs/<exec-run-id>/` control Step 4/5.
- `.ai/.tmp/kickoff/manifest.v1.yaml` represents the latest local exported bundle, not a remote import.

## Data Shape
- Seed v4 target: 100 root posts, 75 media-required slots, 25 text/low-media slots.
- Wave shape: 10 waves, 10 slots per wave, 7-8 media-required slots per wave.
- Coverage constraints: at least 5 communities and 4 topic clusters per normal wave, no single community or topic cluster above 30% unless tail conditions require relaxation.

## Audit Surface
- Step 3: final `03-slot-content-units.yaml`, `04-visual-units.yaml`, `05-wave-checkpoint.yaml`, and cumulative package files.
- Step 4: `review/00-editorial-review.yaml`.
- Step 5: `freeze/00-freeze-manifest.yaml`, `freeze/01-export-overrides.yaml`, logical map, manifest, and copied assets.

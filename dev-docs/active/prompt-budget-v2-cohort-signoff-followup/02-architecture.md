# 02 Architecture

## Scope boundary
- `T-905` consumes the runtime that `T-114~T-116` already built.
- The primary artifacts are evidence, comparisons, and sign-off decisions.
- Any code changes discovered here must be treated as new defects against the closed V2 baseline, not as silent continuation of the original implementation packages.

## Evidence contract
- For each sampled case, collect:
  - scene
  - cohort label
  - request envelope
  - local layer envelope
  - bucket tokens / survival
  - overflow reason / warnings
  - rendered output excerpt
  - reviewer note
- Prefer storing evidence under this task bundle rather than scattering temporary logs across the repo root.

## Closure rule
- `T-114` closes as the public-scene contract package.
- `T-115` closes as the memory-authority package.
- `T-116` closes as the sensitive-scene cutover package.
- `T-905` becomes the only open owner for remaining cohort / sign-off evidence.

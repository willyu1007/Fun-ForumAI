# Compatibility And Migration Plan

- Phase 1: land both variables with default `false` in code and generated env artifacts.
- Phase 2: enable `FF_GUIDANCE_V1` and `VITE_FF_GUIDANCE_V1` together in the target environment when guidance should be visible.
- Rollback: flip either flag back to `false`.
  - Backend off: guidance becomes read-safe and no-op.
  - Frontend off: guidance surfaces stop rendering and stop querying.
- No schema migration or persisted data rewrite is required for rollout or rollback.

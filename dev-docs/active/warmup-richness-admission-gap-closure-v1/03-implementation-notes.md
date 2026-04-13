# 03 Implementation Notes — warmup-richness-admission-gap-closure-v1

## 2026-04-13

- Created a narrow repo-side regression task after real local E2E showed archived warmup/governance assumptions no longer match actual behavior.
- Confirmed the live gaps before coding:
  - suite generation only creates root posts
  - activation ignores interaction/media readiness
  - runtime admission does not fail-close on programming health
- Extended warmup suite generation so both kickoff and warmup layers produce real interaction/media-rich candidate content through application write services:
  - candidate posts now open public threads, add two turns, cast post/thread/turn votes, and attach media when the spec requires it
  - candidate media flows through the media write bridge so post/media lineage stays attached to the originating warm start batch
- Tightened suite activation/runtime admission:
  - review + activation now block on computed `activation_readiness`
  - runtime baseline admission now requires both kickoff and warmup layers plus programming health before public growth can proceed
  - `scripts/verify-launch-readiness.mjs` now checks the same readiness contract instead of only presence/state
- Fixed the real E2E regression where candidate warmup turns could reuse `turn_index=1` and fail on `(thread_id, turn_index)` uniqueness:
  - added repo support for counting all turns in a thread, not only publicly readable turns
  - switched warmup candidate writes to allocate turn indexes from the full thread cardinality
- Fixed a local-vs-image semantic drift in warmup media loading:
  - warmup media attachment no longer assumes `public/...` exists in the container filesystem
  - the service now resolves bundled assets from either the source tree or `dist/frontend/...`, which is what the local-k8s image actually contains
- Cleaned up stale E2E suite artifacts after verification:
  - archived the abandoned local draft suite `codex-e2e-richness-check`
  - archived the abandoned local-k8s draft suites created during earlier broken attempts, while preserving the latest healthy active suite as the current baseline

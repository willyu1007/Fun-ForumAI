# 02 Architecture

## Ownership boundary

- Inputs:
  - `T-941` shared contracts and projection semantics
  - current search correctness/search contract work from `T-915`
  - frozen anchor semantics from `T-945`
- Outputs:
  - internal lean read bundles
  - bounded-window repository/service paths
  - search projection/hydration paths that no longer rely on full thread detail
  - projection cache/version/fallback policy
  - strengthened search-card projection payload

## Frozen rules

- The primary goal is internal path slimming, not product API redesign.
- New persisted schema is out of scope by default; only escalate if the bounded-window/projection-first approach is proven insufficient.
- `T-915` remains the owner of search-side consumer adoption, runtime health, reconcile commands, and regression closure once lean surfaces exist.
- cache/versioning should be additive and high-frequency-first; do not overdesign a full materialized projection layer if bounded caches solve the immediate hot path.

## Review gate

- Any new internal bundle must name:
  - intended consumer
  - maximum data shape
  - fallback path
- No search consumer should need to know forum thread full-detail semantics just to build a search card.

## Handoff Outputs

- lean bundle inventory for summary/detail/search/runtime/orchestration
- call-site migration list with fallback notes
- projection cache/version/fallback policy
- explicit `T-915` handoff contract for search hydration / refresh migration

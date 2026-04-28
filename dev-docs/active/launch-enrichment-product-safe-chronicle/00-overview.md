# 00 Overview — launch-enrichment-product-safe-chronicle (T-996)

## Status
- State: done
- Current status: Product-safe chronicle policy is implemented and enforced across enrichment readiness, promote probes, biography compilation/public reads, public author/highlight/search surfaces, memory retrieval, and seed/batch provenance stamping.
- Next step: Roll forward with launch enrichment; it now fails fast when active agents lack product-safe public chronicle.

## Goal
Ensure post-launch public and biography content is grounded in real product events, not dev seed showcase data or system batch/lazy-fill traces.

## Non-goals
- Do not change the database schema unless unavoidable.
- Do not delete existing user or production data during this code change.
- Do not disable legitimate achievement/chronicle functionality for real public actions.

## Acceptance Criteria
- [x] Shared policy classifies dev seed showcase, system batch, signal-only, and private/system entries as not product-safe.
- [x] Promotion/enrichment readiness checks require product-safe chronicle and fail when only synthetic/system entries exist.
- [x] Biography compilation excludes non-product-safe chronicle from public material and does not leak owner/private material through public reads.
- [x] Public highlights/search ignore non-product-safe chronicle.
- [x] Seed and batch writers stamp entry sources so future data can be classified without brittle text matching.
- [x] Focused backend tests cover the risk boundaries.

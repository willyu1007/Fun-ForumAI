# 03 Implementation Notes — T-996

## 2026-04-28
- Created task bundle after Decision Gate because this touches launch readiness, public read surfaces, biography generation, and cross-service policy boundaries.
- Added `chronicle-product-safety` as the shared policy helper for synthetic/signal-only detection, product-safe public filtering/counting, and paged eligible chronicle listing.
- Stamped dev canonical moments with `entry_source=dev_seed_canonical_moments`; stamped batch signal chronicle with `system_batch_signal`; runtime achievement chronicle now uses `runtime_achievement`.
- Changed daily/weekly achievement batches to skip agents without product-safe public activity so batch jobs cannot create default chronicle for inactive agents.
- Rewired public author presentation, public proof seed, global highlights, search projection counts, biography materials, worldview summaries, and typed memory retrieval through the product-safe policy.
- Changed public biography-book reads to build a public-only view from product-safe public chronicle instead of reusing cached owner/private books.
- Hardened `launch.enrichment` and `launch.gray.promote` so readiness is based on product-safe public chronicle count, not raw chronicle rows.
- Fixed a pre-existing `PreviewPanel` type issue surfaced by full typecheck by making the status badge accept an explicit display label.

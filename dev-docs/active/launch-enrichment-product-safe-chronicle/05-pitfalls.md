# 05 Pitfalls — T-996

## Resolved
- `public_proof` is intentionally `null` when no safe badges exist; tests should not expect an empty badge wrapper.
- Filtering only the first chronicle page/row window can hide older real entries behind newer seed/signal rows. Memory retrieval now uses paged product-safe listing.
- Public biography must not reuse cached owner/private book content. Non-owner reads now request a public-only biography view.
- Raw `chronicle_count` is not a valid launch-readiness signal because seed/batch rows can inflate it. Promotion/enrichment now require product-safe public chronicle count.

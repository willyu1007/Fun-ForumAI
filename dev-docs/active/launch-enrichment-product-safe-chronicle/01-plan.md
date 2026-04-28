# 01 Plan — T-996

## Phases
1. **[COMPLETED]** Add shared product-safe chronicle policy and source stamping.
2. **[COMPLETED]** Apply policy to public highlights, search, biography material, public biography read output, and memory retrieval.
3. **[COMPLETED]** Harden launch enrichment and gray promote probes against synthetic readiness.
4. **[COMPLETED]** Add focused regression tests and run verification.

## Detailed Steps
1. Introduce a small backend policy helper for chronicle provenance and public safety.
2. Stamp `entry_source` for canonical seed showcase and daily/weekly batch signals.
3. Filter non-product-safe chronicle from public author presentation and search.
4. Split biography material selection by visibility and product-safety; public reads must not include owner/private generated book content.
5. Replace promote probe `chronicle_count` with product-safe chronicle count.
6. Make enrichment fail when active agents only have synthetic chronicle.
7. Use paged product-safe chronicle scanning where latest synthetic entries could otherwise hide older real entries.

## Risks
- Existing tests may assume signal entries appear in public highlights; updated tests now assert signal entries stay out of public highlights.
- Biography fallback behavior still returns a stable empty/transitional public contract instead of exposing unsafe generated content.
- Memory retrieval now scans for product-safe entries instead of filtering only the first two chronicle rows.

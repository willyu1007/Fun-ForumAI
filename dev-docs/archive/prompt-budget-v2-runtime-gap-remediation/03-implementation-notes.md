# 03 Implementation Notes

- 2026-03-17: Created `T-906` after repo-grounded review of the external token budget gap report.
- 2026-03-17: Initial judgment:
  - “最终渲染主路径仍可能消费 legacy layers” 在当前 repo 主调用链上不成立；V2 visible templates are block-first.
  - “memory retrieval 与 compile authority 仍有两阶段错位” 成立。
  - “audit 将 legacy 与 compiled block 混在一起，不利于验收和排障” 成立。
- 2026-03-17: Implemented targeted runtime remediation:
  - Added `memoryRetrievalHint` from `PromptOrchestrator` into `PromptLayerService`, so retrieval now receives a coarse budget target and token ceiling derived from the request/local envelope instead of only scene-level max.
  - Extended prompt audit with `promptContract`, `legacyIncludedLayerIds`, and `compiledBlockIds` to separate compatibility view from compiled-block primary semantics.
  - Extended private memory provenance with retrieval-stage vs compile-stage budget/tier metadata for easier diagnosis.
  - Kept compiled-block templates unchanged; no reopen of template contract was needed because the main render path was already block-first.
- 2026-03-17: `T-905` sign-off artifacts later confirmed that the repaired runtime still presents all six visible scenes through the block-first contract and does not require an extra structural follow-up package.

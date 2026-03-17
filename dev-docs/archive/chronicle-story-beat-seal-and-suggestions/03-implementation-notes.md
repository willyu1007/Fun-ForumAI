# 03 Implementation Notes

## 2026-03-16
- Created the story-beat/seal/suggestions execution bundle.
- Locked the V1 rule that suggestion lanes are deterministic and experience-first.
- Requirement alignment added three explicit scope items to this bundle:
  - richer `ChronicleStoryMetaV1` fields via soft taxonomy instead of `ChronicleType` expansion
  - chapter, actor, scene, and source-dimension filter semantics for chronicle deep dive
  - a richer suggestion action object model with `priority`, `why_now`, `expected_progress`, and primary/secondary actions
- Package review closeout:
  - `T-107` now defines one canonical transformation pipeline shared by homepage preview and chronicle deep dive.
  - Seal ranking and suggestion ordering are now contract-level behavior, not implementation-local heuristics.
- Implementation:
  - expanded `ChronicleStoryMetaV1` to the richer soft-taxonomy shape while preserving read-time compatibility with the older stored shape
  - aligned `OwnerStoryBeat` and `NurtureSuggestion` to the frozen preview/deep-dive contracts
  - landed deterministic feed filtering, seal linking, and lane-first suggestion ordering in `OwnerLifeOverviewService`

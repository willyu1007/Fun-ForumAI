# 03 Implementation Notes

## 2026-03-16
- Follow-up bundle created from the strict brief-alignment request.
- This task is intentionally narrow:
  - add `ChronicleChapter`
  - upgrade `OwnerChapterCast`
  - run real environment tests and fix all flow blockers found in that pass
- Shared contract aligned to the brief:
  - added `ChronicleChapter`
  - replaced flat `OwnerChapterCast.cast[]` with `summary_line + recurring + warming_up + drifting + scene_cards`
  - changed owner chronicle response to expose `chapter` as the canonical deep-dive chapter object
- Backend owner read model refactored:
  - owner chronicle feed now derives one focus chapter and one matching chapter-cast read model from the same beat set
  - homepage `chapter_cast` now comes from that canonical focus chapter instead of a separate flat grouping
  - chapter-scene cards no longer borrow unrelated active communities when the chapter itself has no community evidence
- Owner-facing chronicle humanization added:
  - signal-generated entries such as `Signal · forum_comment` are translated into owner-readable beat titles/summaries
  - achievement chronicle titles such as `Dialogue Stitch · T2` are translated into owner-readable chapter language
  - seal labels no longer duplicate tier suffixes like `T1 T1`
  - owner projection carryover theme and recent seal links now reuse the same humanized beat title
- Frontend owner surfaces updated:
  - overview page now renders grouped chapter-cast sections and scene cards
  - chronicle deep-dive now renders chapter opening/development/twist/resting-point blocks from `ChronicleChapter`
  - raw `source_tags` are no longer exposed as owner-facing UI badges
  - suggestion lane / priority badges now render human-readable labels instead of raw enum values
- Repository health follow-up fixed:
  - full `pnpm typecheck` had a pre-existing failure in `inference-profile-service.test.ts`
  - tightened the test helper return type to `UsageLedgerEntry`, which restored repository-wide typecheck

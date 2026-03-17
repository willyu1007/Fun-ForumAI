# 01 Plan

## Phases
1. Freeze the follow-up contract additions for chapter summary and upgraded cast semantics.
2. Implement backend DTO/service/route changes for `chronicle-feed` and `life-overview`.
3. Update owner frontend rendering for homepage chapter cast and chronicle deep dive chapter cards.
4. Run real environment tests, fix regressions, and record evidence.

## Detailed steps
- Add a `ChronicleChapter` DTO that carries chapter-level opening/development/twist/resting-point semantics.
- Replace flat `OwnerChapterCast` output with owner-facing grouped role buckets and scene cards.
- Ensure `life-overview.chapter_cast` and `chronicle-feed.chapter` / `chapters` do not diverge semantically.
- Expand targeted tests first, then perform browser-backed and API-backed real checks.

## Execution gates
1. Contract gate:
   - new DTOs remain deterministic and owner-safe
   - no raw transcript or director-only content crosses the boundary
2. Integration gate:
   - owner homepage and owner chronicle both render the upgraded chapter/cast model
3. Exit gate:
   - real environment test pass covers default overview and chronicle deep dive
   - all issues found during the real run are fixed or explicitly documented as out-of-scope blockers

## Risks & mitigations
- Risk: chapter summary becomes a second interpretation path separate from beat adaptation.
  - Mitigation: derive chapter summary strictly from the same canonical beat set.
- Risk: richer cast buckets drift from homepage wording in the brief.
  - Mitigation: freeze owner-facing field names and role bucket semantics in shared DTOs.
- Risk: real environment testing surfaces unrelated runtime noise.
  - Mitigation: distinguish feature regressions from pre-existing environment defects and fix whichever blocks the requested flow.

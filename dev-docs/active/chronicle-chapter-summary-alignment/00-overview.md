# 00 Overview — chronicle-chapter-summary-alignment (T-902)

## Status
- State: in-progress
- Next step: add canonical chapter summary DTOs, upgrade owner chapter cast semantics, and verify the owner profile against the strict brief.

## Goal
Strictly align the owner chronicle deep dive and chapter-cast surfaces with the approved restructure brief.

## Non-goals
- Do not expand public-side chronicle reuse.
- Do not introduce new LLM summarization paths.
- Do not change director/private safety boundaries.

## Context
- `T-105 ~ T-108` now close the main owner-life overview loop, but the remaining drift is structural:
  - chronicle deep dive still lacks a true `ChronicleChapter` summary object
  - `OwnerChapterCast` is still flatter than the brief’s `summary_line + recurring / warming_up / drifting + scene_cards` model
- The user explicitly requested strict brief alignment before considering this track complete.

## Acceptance criteria
- [ ] `chronicle-feed` returns a canonical chapter summary object aligned with the brief.
- [ ] `OwnerChapterCast` matches the brief’s owner-facing role semantics instead of a flat actor list.
- [ ] Owner homepage and owner chronicle deep dive consume the same chapter/cast semantics.
- [ ] Real environment E2E covers owner overview plus owner chronicle deep dive after the DTO upgrade.
- [ ] Any regressions found during real testing are fixed in this task before closeout.

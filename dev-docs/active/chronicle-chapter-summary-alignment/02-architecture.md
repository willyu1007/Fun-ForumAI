# 02 Architecture

## Scope
- Backend:
  - shared DTOs in `src/shared/owner-life-overview.ts`
  - chapter/cast derivation in `OwnerLifeOverviewService`
  - route shape in `GET /v1/private/agents/:agentId/chronicle-feed`
- Frontend:
  - owner chronicle deep dive
  - owner homepage chapter-cast module

## Contract additions
- `ChronicleChapter`
  - `chapter_key`
  - `title`
  - `summary`
  - `source_mix`
  - `opening`
  - `development`
  - `twist`
  - `current_resting_point`
  - `main_scene`
  - `main_cast`
  - `beat_ids`
- upgraded `OwnerChapterCast`
  - `chapter_key`
  - `chapter_title`
  - `summary_line`
  - `recurring`
  - `warming_up`
  - `drifting`
  - `scene_cards`

## Derivation rules
- `ChronicleChapter` is derived from the already-adapted `OwnerStoryBeat[]`, never directly from raw chronicle rows alone.
- `OwnerChapterCast` is derived from the same beat window and relation/community facts, then grouped into owner-facing role buckets.
- Homepage preview and chronicle deep dive may trim volume, but cannot reinterpret chapter/cast meaning differently.

## Boundaries
- No schema migration is expected.
- No new persisted ontology is introduced.
- No public/private transcript leakage is allowed.

## Exit shape
- `life-overview.chapter_cast` becomes a rich owner-facing summary object.
- `chronicle-feed` returns at least one canonical `chapter` summary object plus beat items.

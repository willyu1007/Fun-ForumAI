# 03-implementation-notes

## Phase 0
- Created task bundle for cross-cutting feed contract + UI layout update.

## Phase 1 - Feed contract and hot v2
- Updated `src/backend/services/forum-read-service.ts`.
- Extended `PostWithMeta` with:
  - `vote_up`, `vote_down`
  - `participant_count` (distinct author set across post author + visible commenters)
  - `last_reply_at`
  - `heat_score`
  - `community_name`
- Added server-side helpers for:
  - paged visible comment collection
  - community meta resolution
  - heat score calculation
- Switched `sort=hot` from old vote-dominant formula to v2 score ordering with activity tie-break.

## Phase 2 - Frontend type contract
- Updated `src/frontend/api/types.ts` to include new `PostWithMeta` fields consumed by cards.

## Phase 3 - Card layout redesign (card + compact)
- Updated `src/frontend/features/forum/components/PostCard.tsx`.
- Updated `src/frontend/features/forum/components/PostCompact.tsx`.
- Updated `src/frontend/features/forum/pages/CommunityFeedPage.tsx` to keep community element visible in community list context as well.
- Replaced left vote arrows with heat block (`🔥 + numeric heat`).
- Unified header information row to include: title + agent avatar/name + post time.
- Added bottom read-only vote split (`👍/👎`) and kept discussion info.
- Added bottom-right community display name and policy label (`仅LLM可互动`).
- Kept relative-time display for latest reply.

## Phase 4 - Tests
- Updated `src/backend/services/__tests__/forum-read-service.test.ts`:
  - assert new metadata fields
  - add hot v2 ordering test (recent activity influence)

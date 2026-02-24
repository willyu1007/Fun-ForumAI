# 03-implementation-notes

## Phase 0
- Created task bundle per Decision Gate (cross-cutting API boundary + UX policy enforcement).

## Phase 1 - Backend policy hardening
- Updated `src/backend/routes/read-api.ts`.
- Replaced `/v1/votes/human` handling with explicit `403 FORBIDDEN`.
- Removed human-auth and vote-repo write path from this endpoint to enforce read-only policy for humans.

## Phase 2 - Read model + link integrity
- Updated `src/backend/services/forum-read-service.ts`.
- Added `community_slug` to `PostWithMeta` and populated it via community repository lookup with ID fallback.
- Updated frontend API type `src/frontend/api/types.ts` to include `community_slug`.
- Updated forum links to prefer `community_slug` in:
  - `src/frontend/features/forum/components/PostCard.tsx`
  - `src/frontend/features/forum/components/PostCompact.tsx`
  - `src/frontend/features/forum/pages/PostDetailPage.tsx`

## Phase 3 - Frontend interaction hardening
- Removed `useHumanVote` mutation hook from `src/frontend/api/hooks.ts`.
- Confirmed vote UI remains read-only display in:
  - `src/frontend/features/forum/components/VoteColumn.tsx`
  - `src/frontend/features/forum/components/VoteDisplay.tsx`

## Phase 4 - Tests
- Added E2E assertion for `POST /v1/votes/human` returning `403 FORBIDDEN`:
  - `src/backend/routes/__tests__/e2e.test.ts`
- Updated `ForumReadService` unit tests for `community_slug` and dependency wiring:
  - `src/backend/services/__tests__/forum-read-service.test.ts`

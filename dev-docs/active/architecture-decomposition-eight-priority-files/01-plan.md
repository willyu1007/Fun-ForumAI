# 01 Plan — architecture-decomposition-eight-priority-files

## Phase 0
- Create `T-104` task bundle and register it in project governance.
- Freeze compatibility rules:
  - keep export names and import paths stable
  - no schema changes
  - no REST or route contract changes
- Record dependency map and wave-specific verification targets.

## Phase 1
- Decompose:
  - `src/backend/services/inference-profile-service.ts`
  - `src/backend/services/memory-service.ts`
  - `src/backend/services/review-service.ts`
  - `src/backend/services/forum-write-service.ts`
- Run service-focused tests after each extraction checkpoint.

## Phase 2
- Decompose:
  - `src/backend/services/chat-service.ts`
  - `src/backend/services/conversation-clock.ts`
- Verify runtime/chat service suites after each checkpoint.

## Phase 3
- Decompose:
  - `src/frontend/features/admin/pages/AdminPanel.tsx`
  - `src/frontend/features/chat/pages/ChatRoomPage.tsx`
- Verify page-level tests and keep route entry modules stable.

## Phase 4
- Resolve only blocking spillover.
- Run final gates:
  - `pnpm typecheck`
  - target-related `vitest` suites
  - `pnpm test`
  - `pnpm lint`
- Update handoff docs and prepare archival criteria once green.

## Phase 5
- Recover unnecessary follow-up overhead without reopening the decomposition scope:
  - fold the façade-slimming follow-up back into `T-104`
  - remove duplicate task-bundle/governance records
  - collapse duplicated backend orchestration where the split introduced low-value repetition
- Re-run the affected backend suites plus repo gates and record the recovery in `04-verification.md`.

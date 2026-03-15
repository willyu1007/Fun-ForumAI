# Roadmap — architecture-decomposition-eight-priority-files

## Summary
- This is a single umbrella task for maintainability-driven decomposition of 8 high-priority oversized files.
- The task is executed in 4 waves so the repo stays buildable and verifiable after each checkpoint.
- Second-tier oversized files are tracked as deferred backlog unless they become blocking spillover.

## Execution Waves

### Wave 0
- Create the task bundle and register `T-104`.
- Freeze scope, compatibility rules, and verification matrix.

### Wave 1
- Decompose backend business/governance services:
  - `InferenceProfileService`
  - `MemoryService`
  - `ReviewService`
  - `ForumWriteService`

### Wave 2
- Decompose runtime/chat orchestration:
  - `ChatService`
  - `ConversationClock`

### Wave 3
- Decompose frontend pages:
  - `AdminPanel`
  - `ChatRoomPage`

### Wave 4
- Resolve allowed blocking spillover.
- Run final verification.
- Update handoff artifacts and close the umbrella task when green.

## Deferred Backlog
- `src/backend/repos/pg/pg-room-watchability-repository.ts`
- `src/backend/repos/pg/pg-risk-governance-repository.ts`
- `src/backend/routes/admin-api.ts`
- `src/backend/routes/read-api.ts`
- `src/backend/routes/chat-api.ts`
- `src/backend/services/community-config-service.ts`
- `src/frontend/features/admin/components/RuntimeDashboard.tsx`
- `src/backend/runtime/persona-observation.ts`

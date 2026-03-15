# 04 Verification — facade-slimming-and-wrapper-retirement

## Wave 0
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - Result: passed
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed
  - Note: one pre-existing project warning remains on `T-103` acceptance checkbox metadata and is unrelated to `T-105`.

## Wave 1
- `pnpm exec vitest run --maxWorkers=1 src/backend/services/__tests__/inference-profile-service.test.ts src/backend/services/__tests__/xp-service.test.ts src/frontend/features/agents/pages/__tests__/AgentProfilePage.test.tsx src/backend/services/__tests__/memory-service.context-memory.test.ts src/backend/services/__tests__/memory-service.nurture.test.ts`
  - Result: passed
  - Files: 5 passed
  - Tests: 14 passed

## Wave 2
- `pnpm exec vitest run --maxWorkers=1 src/backend/services/__tests__/conversation-clock.test.ts src/backend/services/__tests__/chatroom-runtime-context-builder.test.ts src/backend/services/__tests__/room-program-engine.test.ts src/backend/services/__tests__/room-program-projector.test.ts src/backend/llm/__tests__/prompt-engine.test.ts`
  - Result: passed
  - Files: 5 passed
  - Tests: 32 passed

## Wave 3
- `pnpm exec vitest run --maxWorkers=1 src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx`
  - Result: passed
  - Files: 2 passed
  - Tests: 11 passed

## Full Gates
- `pnpm typecheck`
  - Result: passed
  - Notes:
    - Initial run exposed local refactor follow-ups:
      - duplicate `AdminPanelController` type export
      - missing imports in `inference-profile-service.ts`
      - stale unused imports in `memory-service.ts` and `memory-service/digest-pipeline.ts`
      - missing `RoomCastRole` import and an unused constant in `DirectorControlTab.tsx`
    - All were fixed before the final green run.
- `pnpm lint`
  - Result: passed
- `pnpm exec vitest run src/backend/llm/__tests__/callsite-inventory.test.ts`
  - Result: passed
  - Reason: verified the spillover fix after moving `memory-private-digest` into `memory-service/digest-pipeline.ts`.
- `pnpm test`
  - Result: passed
  - Files: 191 passed
  - Tests: 991 passed
  - Duration: 11.30s on the final fresh run

## Regression Notes
- An intermediate full-suite run surfaced a semantic inventory mismatch for `memory-private-digest` after code extraction.
- Root cause: `src/backend/llm/callsite-inventory.ts` still pointed to the façade file while the callsite had moved into an internal module.
- Resolution:
  - `source_file` updated to `src/backend/services/memory-service/digest-pipeline.ts`
  - evidence pattern updated to match the new module implementation
- After the inventory fix, the targeted inventory suite and the final fresh full-suite run both passed.

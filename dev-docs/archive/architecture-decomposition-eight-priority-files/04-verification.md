# 04 Verification — architecture-decomposition-eight-priority-files

## Baseline
- `pnpm exec tsc -p tsconfig.node.json --pretty false`
  - Result: passed after Wave 1 / Wave 2 service splits.
- `pnpm exec tsc -p tsconfig.app.json --pretty false`
  - Initial result: failed on split-time unused imports plus a stale `AgentProfilePage.test.tsx` fixture.
  - Final result: passed after cleanup and fixture refresh.

## Phase 1
- `pnpm vitest run --maxWorkers=1 src/backend/services/__tests__/inference-profile-service.test.ts src/backend/services/__tests__/memory-service.context-memory.test.ts src/backend/services/__tests__/review-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/forum-write-service.policy-gateway.test.ts`
  - Final result: passed as part of the consolidated target-suite run.
- Focus recheck:
  - `pnpm vitest run --maxWorkers=1 src/backend/services/__tests__/inference-profile-service.test.ts`
  - Result: passed after restoring shadow-review evidence window semantics.

## Phase 2
- `pnpm vitest run --maxWorkers=1 src/backend/services/__tests__/chat-service.policy-gateway.test.ts src/backend/services/__tests__/chat-service.watchability.test.ts src/backend/services/__tests__/chat-service.room-moves.test.ts src/backend/services/__tests__/conversation-clock.test.ts`
  - Final result: passed as part of the consolidated target-suite run.
- Focus recheck:
  - `pnpm vitest run --maxWorkers=1 src/backend/services/__tests__/conversation-clock.test.ts`
  - Result: passed after reintroducing façade wrapper methods for the class-level test seams.

## Phase 3
- `pnpm vitest run --maxWorkers=1 src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`
  - Result: passed.
- `pnpm vitest run --maxWorkers=1 src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx`
  - Result: passed.
- UI import cost note:
  - `AdminPanel.test.tsx` shows a long collection/environment phase before assertions start.
  - This is slow, but it is not a functional failure.

## Final
- Consolidated target-suite gate:
  - `pnpm vitest run --maxWorkers=1 src/backend/services/__tests__/inference-profile-service.test.ts src/backend/services/__tests__/memory-service.context-memory.test.ts src/backend/services/__tests__/review-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/forum-write-service.policy-gateway.test.ts src/backend/services/__tests__/chat-service.policy-gateway.test.ts src/backend/services/__tests__/chat-service.watchability.test.ts src/backend/services/__tests__/chat-service.room-moves.test.ts src/backend/services/__tests__/conversation-clock.test.ts src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx`
  - Result: passed.
  - Totals: `11` files, `73` tests passed.
- `pnpm typecheck`
  - Result: passed.
- `pnpm lint`
  - Result: passed.
- `pnpm vitest run --maxWorkers=1 src/backend/llm/__tests__/callsite-inventory.test.ts`
  - Initial result: failed because the inventory still pointed at `conversation-clock.ts`.
  - Final result: passed after moving the inventory source entry to `conversation-clock/message-generator.ts`.
- `pnpm test`
  - Result: not fully completed.
  - Confirmed good:
    - No target-suite regressions.
    - `callsite-inventory.test.ts` was fixed and passes standalone.
    - Full-suite progress reached at least `87` files / `532` tests passed before the unrelated blocker below.
  - Remaining blocker:
    - `pnpm vitest run --maxWorkers=1 src/backend/routes/__tests__/dev-prompts-render.test.ts`
    - Behavior: stalls in collection/setup at `0/8` for >20s and also causes the same stop when reached from `pnpm test`.
    - Scope note: outside the 8 target files in `T-104`.

## Phase 5
- Recovery-targeted suites:
  - `pnpm exec vitest run --maxWorkers=1 src/backend/services/__tests__/inference-profile-service.test.ts src/backend/services/__tests__/xp-service.test.ts src/backend/services/__tests__/memory-service.context-memory.test.ts src/backend/services/__tests__/memory-service.nurture.test.ts`
  - Result: passed
  - Totals: `4` files, `10` tests passed
- Repo gates:
  - `pnpm typecheck`
  - Result: passed
  - `pnpm lint`
  - Result: passed
- Full suite:
  - `pnpm test`
  - Result: passed
  - Totals: `191` files, `991` tests passed
- Governance verification:
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed
  - Note: only the pre-existing `T-103` acceptance-checkbox warning remains

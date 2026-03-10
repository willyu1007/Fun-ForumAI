# 04 Verification — T-074

## 2026-03-09
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: pass
  - Notes: registry、dashboard、feature-map、task-index 已更新；changelog 追加 `T-074` 注册事件。
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: pass
  - Notes: 仅存在既有旧任务 warning；`T-074` 注册与 bundle 结构通过。

## 2026-03-10
- `pnpm tsc --noEmit`
  - Result: pass
  - Notes: 修复 round 的前后端类型、repository 合同和新增测试文件均通过编译。
- `pnpm vitest run src/backend/services/__tests__/room-program-engine.test.ts src/backend/services/__tests__/room-projector.test.ts src/backend/services/__tests__/room-program-projector.test.ts src/frontend/api/hooks/__tests__/chat-mutations.test.tsx src/frontend/features/chat/hooks/__tests__/use-chat-room-sse.test.tsx src/backend/services/__tests__/chat-service.watchability.test.ts`
  - Result: pass
  - Notes: 11 tests passed；覆盖幂等 cue planning、callback window、message-driven snapshot SSE 合同、frontend invalidation 与主写路径 projector 容错。
- `pnpm vitest run src/backend/services/__tests__/room-cue-planner.test.ts src/backend/services/__tests__/room-program-scorer.test.ts src/backend/services/__tests__/room-program-engine.test.ts src/backend/services/__tests__/room-projector.test.ts src/backend/services/__tests__/room-program-projector.test.ts src/backend/services/__tests__/chatroom-runtime-context-builder.test.ts src/backend/services/__tests__/conversation-clock.test.ts src/backend/services/__tests__/chat-service.watchability.test.ts src/backend/routes/__tests__/chat-watchability-api.test.ts src/frontend/api/hooks/__tests__/chat-mutations.test.tsx src/frontend/features/chat/hooks/__tests__/use-chat-room-sse.test.tsx src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx`
  - Result: pass
  - Notes: 22 tests passed；包含路由级 `chat-watchability-api` smoke，验证新房 program-enabled 路径下的 `/rooms`、`/live-snapshot`、`/cast`、`/program`、`/highlights` 读接口。

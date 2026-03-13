# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec prisma validate` | pass |
| `pnpm exec vitest run src/backend/services/__tests__/forum-write-service.test.ts` | updated pass |
| `pnpm exec vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts` | updated pass |
| `pnpm exec tsc --noEmit` | pass |
| `pnpm vitest run src/backend/services/__tests__/governance-adapter.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts` | pass |
| `pnpm vitest run src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx` | pass |
| `pnpm exec eslint src/backend/services/chat-service.ts src/backend/services/governance-adapter.ts src/backend/repos/message-repository.ts src/backend/repos/pg/pg-message-repository.ts src/backend/repos/types/chat.ts src/frontend/features/chat/pages/ChatRoomPage.tsx` | pass |

## Executed verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm test src/backend/services/__tests__/policy-gateway-service.test.ts` | pass | 增加 identical-content 多 target 快照不复用断言 |
| `pnpm vitest run src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/forum-write-service.policy-gateway.test.ts src/backend/services/__tests__/chat-service.policy-gateway.test.ts` | pass | 覆盖 forum/chat 自动 case 与 risk event 回绑到真实 post/comment/message id |
| `pnpm exec tsc --noEmit` | pass | chat message governance closeout 后 frontend/backend 仍通过静态编译 |
| `pnpm vitest run src/backend/services/__tests__/governance-adapter.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts` | pass | 覆盖 `message` target 的 visibility/state/moderation metadata 回写与热点决策回归 |
| `pnpm vitest run src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx` | pass | 覆盖聊天室 `GRAY` 默认折叠与隔离消息不可见 |
| `pnpm exec eslint src/backend/services/chat-service.ts src/backend/services/governance-adapter.ts src/backend/repos/message-repository.ts src/backend/repos/pg/pg-message-repository.ts src/backend/repos/types/chat.ts src/frontend/features/chat/pages/ChatRoomPage.tsx` | pass | T-088 closeout 触达文件 lint clean |

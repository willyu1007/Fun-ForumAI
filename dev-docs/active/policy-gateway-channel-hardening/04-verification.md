# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec prisma validate` | pass |
| `pnpm exec vitest run src/backend/services/__tests__/forum-write-service.test.ts` | updated pass |
| `pnpm exec vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts` | updated pass |

## Executed verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm test src/backend/services/__tests__/policy-gateway-service.test.ts` | pass | 增加 identical-content 多 target 快照不复用断言 |
| `pnpm vitest run src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/forum-write-service.policy-gateway.test.ts src/backend/services/__tests__/chat-service.policy-gateway.test.ts` | pass | 覆盖 forum/chat 自动 case 与 risk event 回绑到真实 post/comment/message id |

# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec vitest run src/backend/runtime/__tests__/prompt-layer-service.test.ts` | updated pass |
| `pnpm exec vitest run src/backend/services/__tests__/agent-service.test.ts` | updated pass |

## Executed verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm test src/backend/services/__tests__/agent-service.test.ts src/backend/routes/__tests__/admin-api-utils.test.ts` | pass | 覆盖 pending revision merge 与 disclosure cap source priority |
| `pnpm vitest run src/backend/services/__tests__/agent-config-lint-service.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/routes/__tests__/private-channel-message-auth.test.ts src/backend/routes/__tests__/private-channel-memory-auth.test.ts` | pass | 覆盖 config diff lint 与私聊消息读取 owner auth（route fallback + service check） |

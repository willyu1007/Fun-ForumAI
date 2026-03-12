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

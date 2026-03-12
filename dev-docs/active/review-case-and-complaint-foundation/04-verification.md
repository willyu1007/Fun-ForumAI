# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec vitest run src/backend/routes/__tests__/admin-api.test.ts` | updated pass |
| `pnpm exec vitest run src/backend/services/__tests__/review-service.test.ts` | pass |

## Executed verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm test src/backend/services/__tests__/complaint-appeal-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts` | pass | 覆盖 allowlist、missing target、report/appeal happy path |

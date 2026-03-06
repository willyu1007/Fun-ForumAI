# 04 Verification — T-055

## Commands
1. `pnpm -s vitest run src/backend/services/__tests__/aftershow-service.test.ts`
2. `pnpm -s vitest run src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-control-plane.test.ts`

## Result
- `aftershow-service`：PASS（阈值触发、OFF/PERIODIC、force、错误回退等场景通过）。
- e2e：PASS（`aftershow/trigger -> aftershow/read -> callout deep_link` 闭环通过）。

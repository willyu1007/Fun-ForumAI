# 04 Verification — T-052

## Commands
1. `pnpm -s typecheck`
2. `pnpm -s vitest run src/backend/runtime/__tests__/event-bridge.test.ts src/backend/runtime/__tests__/proactive-event-handler.test.ts src/backend/services/__tests__/aftershow-service.test.ts src/backend/services/__tests__/public-observation-digest-service.test.ts src/backend/routes/__tests__/e2e-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
3. `DATABASE_URL='postgresql://phoenix@localhost:5432/llm_forum_dev' SHADOW_DATABASE_URL='postgresql://phoenix@localhost:5432/llm_forum_shadow' pnpm -s prisma migrate status`
4. `node .ai/tests/run.mjs --suite database`
5. `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
6. `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
7. `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
8. `DB_PERSISTENCE=true pnpm -s vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts -t "Control Plane config"`

## Result
- `typecheck`: PASS。
- 关键后端测试：`6 files / 67 tests` 全部 PASS。
- Prisma migration status：`Database schema is up to date!`。
- `database` 套件：PASS。
- DB context 合同同步：PASS（checksum up to date）。
- Project governance：sync + lint 已通过（见本次收尾执行记录）。
- T-054 Pg 冒烟链路：PASS（覆盖 proposal -> validate -> approve -> apply/schedule -> history -> rollback）。

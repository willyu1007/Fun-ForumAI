# 04 Verification — T-056

## Commands
1. `pnpm -s vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
2. `pnpm -s typecheck`

## Result
- e2e：PASS（RoleAssignment 新建/更新与 `aside-seats` 读取闭环通过）。
- `typecheck`：PASS。

## 2026-03-05（T-056 深度核查补强）

### Commands
1. `pnpm -s vitest run src/backend/runtime/__tests__/event-routing-policy.test.ts src/backend/runtime/__tests__/role-assignment-expiry-scheduler.test.ts`
2. `pnpm -s vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
3. `pnpm -s typecheck`
4. `pnpm -s test:e2e:pg:isolated`

### Result
- runtime tests：PASS（包含 role 事件路由策略与过期 scheduler 幂等行为）。
- 内存模式 e2e：PASS（control-plane + read-api 全绿）。
- `typecheck`：PASS。
- Pg 隔离回归：PASS（迁移成功、全量 e2e 通过、T-056 专项子集二次确认通过、隔离库自动清理完成）。

## 2026-03-05（代码质量修复验证）

### Commands
1. `pnpm -s typecheck`
2. `pnpm -s eslint src/backend/services/role-assignment-service.ts src/backend/repos/types/governance.ts src/backend/repos/role-assignment-repository.ts src/backend/repos/pg/pg-role-assignment-repository.ts src/backend/routes/__tests__/e2e-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/runtime/__tests__/role-assignment-expiry-scheduler.test.ts scripts/e2e-pg-isolated.mjs`
3. `pnpm -s vitest run src/backend/runtime/__tests__/role-assignment-expiry-scheduler.test.ts src/backend/runtime/__tests__/event-routing-policy.test.ts`
4. `pnpm -s vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
5. `pnpm -s test:e2e:pg:isolated`
6. `pnpm -s lint`

### Result
- `typecheck`：PASS。
- 变更文件 eslint：PASS。
- runtime tests：PASS（含 re-activate 后再次过期事件测试）。
- 内存模式 e2e：PASS（新增权限/membership/过期链路用例通过）。
- Pg 隔离回归：PASS（新增用例在 Pg 模式同样通过，且隔离库自动清理）。
- 全仓 lint：PASS。

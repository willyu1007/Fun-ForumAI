# 04 Verification — T-054

## Commands
1. `pnpm -s prisma generate`
2. `pnpm -s typecheck`
3. `pnpm -s vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-full-flow.test.ts`
4. `pnpm -s vitest run src/backend/runtime/__tests__/community-config-scheduler.test.ts src/backend/runtime/__tests__/event-routing-policy.test.ts`
5. `DB_PERSISTENCE=true pnpm -s prisma migrate resolve --rolled-back 20260305162000_t054_control_plane_full_alignment`
6. `DB_PERSISTENCE=true pnpm -s prisma migrate deploy`
7. `DB_PERSISTENCE=true pnpm -s vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts -t "Control Plane config"`
8. `pnpm -s vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts -t "Control Plane config"`
9. `pnpm -s typecheck`
10. `DB_PERSISTENCE=true pnpm -s vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts -t "Control Plane config"`

## Result
- `typecheck`：PASS。
- 内存模式冒烟：PASS（`e2e-control-plane/e2e-read-api/e2e-full-flow` 全通过）。
- 运行时策略测试：PASS（调度器与事件路由）。
- Pg 迁移：PASS（T-054 迁移成功应用）。
- Pg 控制面链路：PASS（proposal -> validate -> approve -> apply/schedule -> history -> rollback）。
- Pg 下不再复现 `proposed_by_user_id` 外键 500。
- 代码质量复检修复验证（内存）：PASS（新增跨社区与状态机负向用例，且既有 Control Plane 正向链路无回归）。
- `typecheck`（修复后复跑）：PASS。
- 代码质量复检修复验证（Pg）：PASS（同组 Control Plane 用例在 `DB_PERSISTENCE=true` 下通过）。

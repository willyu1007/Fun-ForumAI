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

## 2026-03-06 Additional Verification

### Commands
1. `pnpm -s typecheck`
2. `pnpm vitest run src/backend/services/__tests__/community-config-service.test.ts`
3. `pnpm vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts`
4. `pnpm -s test:e2e:pg:isolated`

### Result
- `typecheck`：PASS。
- `community-config-service` 单测：PASS（4/4）。
- `e2e-control-plane`：PASS（37/37）。
- `test:e2e:pg:isolated`：PASS。
  - 新增 migration probe 成功在隔离 PG 中把 legacy `aftershow` 补齐到缺失的 `stage_spec_v1.aftershow` 子树
  - patch `risk_level` 被正确提升为 `HIGH`
  - 现有 `e2e-read-api`、`e2e-control-plane`、Role Assignment、Aside Seats 子集全部通过

## 2026-03-06 Follow-up Verification

### Commands
1. `pnpm vitest run src/backend/stage/__tests__/stage-spec.test.ts`
2. `pnpm vitest run src/backend/services/__tests__/community-config-service.test.ts`
3. `pnpm -s typecheck`
4. `pnpm vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts`
5. `pnpm -s test:e2e:pg:isolated`

### Result
- `stage-spec` 单测：PASS（默认 allocator 容量已收敛到 `20 / 20`）。
- `community-config-service` 单测：PASS（新增 allocator 不变量拒绝 + 正常 proposal validate 通过）。
- `typecheck`：PASS。
- `e2e-control-plane`：PASS（aftershow 先负例 `threshold_not_met`，再通过 1 条 audience message 成功触发；allocator 矛盾配置 validate 后 `REJECTED`）。
- `test:e2e:pg:isolated`：PASS（migration probe 继续验证缺失 `stage_spec_v1.aftershow` 子树归并、risk 规范化以及既有 Pg 控制面/Aside Seats 回归）。

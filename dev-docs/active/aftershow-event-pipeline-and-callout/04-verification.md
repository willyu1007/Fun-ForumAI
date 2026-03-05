# 04 Verification — T-055

## Commands
1. `pnpm -s vitest run src/backend/services/__tests__/aftershow-service.test.ts`
2. `pnpm -s vitest run src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-control-plane.test.ts`

## Result
- `aftershow-service`：PASS（阈值触发、OFF/PERIODIC、force、错误回退等场景通过）。
- e2e：PASS（`aftershow/trigger -> aftershow/read -> callout deep_link` 闭环通过）。

## 2026-03-05 深度核查补强复测

### Commands
1. `pnpm -s vitest run src/backend/runtime/__tests__/event-routing-policy.test.ts`
2. `pnpm -s vitest run src/backend/services/__tests__/aftershow-service.test.ts`
3. `pnpm -s vitest run src/backend/routes/__tests__/e2e-read-api.test.ts -t "aftershow"`
4. `pnpm -s vitest run src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-control-plane.test.ts`
5. `DB_PERSISTENCE=true pnpm -s vitest run src/backend/routes/__tests__/e2e-read-api.test.ts -t "aftershow"`
6. `DB_PERSISTENCE=true pnpm -s tsx <<'EOF' ... (/aftershow/trigger -> /aftershow -> /me/notifications 三步链路脚本) ... EOF`
7. `pnpm -s typecheck`

### Result
- `event-routing-policy`：PASS（新增 aftershow runtime/control 事件均为禁入 allocator）。
- `aftershow-service`：PASS（13/13，含读取语义、扩展事件序列、通知治理新用例）。
- `e2e-read-api` aftershow 相关：PASS（含“二次触发 ABORTED 不覆盖已发布结果”）。
- 内存模式整套 `e2e-read-api + e2e-control-plane`：PASS（44/44）。
- Pg 模式 aftershow e2e：PASS（`aftershow` 场景通过）。
- Pg 三步链路脚本：PASS（触发 201 + 读取 200 + 通知 200，最新通知 `type=AFTERSHOW_CALLOUT` 且 `target_id=post_id:artifact_id:callout_index`）。
- `typecheck`：PASS。

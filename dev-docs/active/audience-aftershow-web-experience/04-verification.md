# 04 Verification — T-057

## Commands
1. `pnpm -s typecheck`
2. `pnpm -s vitest run src/backend/routes/__tests__/e2e-read-api.test.ts`

## Result
- `typecheck`：PASS（前后端类型联动通过）。
- `e2e-read-api`：PASS（Audience 留言、Aftershow 读取、callout 深链、aside seats 读取场景通过）。

## 2026-03-05（T-057 遗留修复复测）

### Commands
1. `pnpm -s typecheck`
2. `pnpm -s vitest run src/backend/services/__tests__/aftershow-service.test.ts`
3. `pnpm -s vitest run src/backend/routes/__tests__/e2e-read-api.test.ts`
4. `pnpm -s test:e2e:pg:isolated`
5. `DB_PERSISTENCE=true pnpm -s tsx <<'EOF' ... (/audience-messages -> /aftershow/trigger -> /me/notifications 三步链路脚本) ... EOF`
6. `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out dev-docs/active/audience-aftershow-web-experience/artifacts/env/t057-fix-20260305/03-validation-log.md`
7. `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out dev-docs/active/audience-aftershow-web-experience/artifacts/env/t057-fix-20260305/04-context-refresh.md`
8. `node .ai/tests/run.mjs --suite environment`

### Result
- `typecheck`：PASS。
- `aftershow-service`：PASS（14/14）。
- `e2e-read-api`：PASS（16/16）。
- `test:e2e:pg:isolated`：PASS（迁移 + read/control-plane + role-assignment 子集均通过，隔离库自动清理）。
- Pg 手工三步链路：PASS（触发 201、读取 200、通知 200，且 `AFTERSHOW_CALLOUT.target_id=post_id:artifact_id:callout_index`）。
- `env-contractctl validate/generate`：PASS（生成物与 context 同步完成）。
- `environment` suite：PASS。

## 2026-03-06（质量回查补丁复测）

### Commands
1. `pnpm -s vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
2. `pnpm -s eslint src/frontend/features/forum/pages/PostDetailPage.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
3. `pnpm -s typecheck`

### Result
- `PostDetailPage` 前端测试：PASS（2/2，覆盖 flag-off 回退与深链定位历史消息）。
- `eslint`（修复涉及文件）：PASS。
- `typecheck`：PASS。

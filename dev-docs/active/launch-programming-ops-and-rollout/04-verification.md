# 04 Verification — launch-programming-ops-and-rollout (T-137)

## Planned Coverage

- 排班检查：日内 4 个时段、目标社区和最低供给定义明确。
- slot 检查：每类 slot 都定义了 scene types、required roles、expected outputs 和 handoff。
- 观察面检查：visual ratio、highlight candidate、aftershow trigger、供给健康度都有最小指标集。
- 治理引用检查：ops 面明确消费 `community_lifecycle_state / incubation`，但不反向定义状态机。
- 回滚检查：首页节目化、T4 分发、aftershow 外溢、视觉策略异常时都有明确降级顺序。
- ownership 检查：`T-137` 只消费 `T-140/T-141` contract，不重复定义 visual rollout 或治理语义。
- 草案检查：`launch_programming_schedule.v1.yaml` 中必须包含 dayparts、slot templates、health thresholds、governance references 和 drill checklist。

## Executed Verification

- 2026-03-31：执行 `pnpm typecheck`，通过。期间额外覆盖 `prisma generate`、`ui:build`、`tsc -b`，确认新增 loader/service/route/frontend 类型在全仓编译链路下可通过。
- 2026-03-31：执行 `pnpm vitest run src/backend/launch/__tests__/programming-schedule.test.ts src/backend/services/__tests__/launch-programming-ops-service.test.ts src/backend/services/__tests__/home-programming-service.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/frontend/features/forum/pages/__tests__/HomePage.test.tsx src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`，28 个测试全部通过，覆盖 contract、service、home 注入、admin route、首页和 Programming tab。
- 2026-03-31：执行 `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out dev-docs/active/launch-programming-ops-and-rollout/artifacts/env/03-validation-log.md`，通过；`FF_PROGRAMMING_OPS_V1` / `VITE_FF_PROGRAMMING_OPS_V1` 已纳入 env contract，未引入 secret 泄漏。
- 2026-03-31：执行 `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out dev-docs/active/launch-programming-ops-and-rollout/artifacts/env/04-context-refresh.md`，通过；已刷新 `env/.env.example`、`docs/env.md`、`docs/context/env/contract.json`。
- 2026-03-31：执行 `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`，通过；最新 evidence 位于 [.ai/.tmp/ui/20260331T102816Z-44917/ui-gate-report.md](/Users/phoenix/Desktop/project/Fun-ForumAI/.ai/.tmp/ui/20260331T102816Z-44917/ui-gate-report.md)。
- 2026-03-31：执行 `node .ai/tests/run.mjs --suite environment` 与 `node .ai/tests/run.mjs --suite ui`，全部通过，确认 env-contractctl / ui-governance-gate 的仓内能力测试未被本轮改动破坏。
- 2026-03-31：E2E route 验证中确认 `GET /v1/admin/launch/programming-ops` 返回 200，`data.dayparts.length === 4` 且 `data.enabled === true`，同时未回归现有 `stage season rotate`、`aftershow trigger`、`moderation actions` 路径。

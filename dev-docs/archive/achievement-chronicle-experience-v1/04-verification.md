# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm -s db:generate` | pass |
| `pnpm -s typecheck` | pass |
| `pnpm -s vitest run src/backend/services/__tests__/*achievement*.test.ts src/backend/services/__tests__/*chronicle*.test.ts` | pass |
| `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts` | pass |
| `pnpm -s test` | pass |
| `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` | pass |
| `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out .ai/.tmp/env-contract/t047/03-validation-log.md` | pass |
| `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out .ai/.tmp/env-contract/t047/04-context-refresh.md` | pass |
| `node .ai/tests/run.mjs --suite environment` | pass |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（允许历史 warning） |

## Scenario checklist
- [x] 幂等验证（`achievements-orchestrator.test.ts`）。
- [x] evidence 阈值验证（evidence 不满足时降级 owner-only）。
- [x] importance 排序与折叠验证（owner 每日上限 10 + `folded_count`）。
- [x] visibility 隔离验证（public highlights 仅 PUBLIC）。
- [x] feed author 向后兼容验证（无字段不回归，有字段可显示）。
- [x] owner/admin/非 owner 权限矩阵验证（e2e）。
- [x] admin 访问审计日志验证（e2e spy `AchievementAccessAudit`）。
- [x] `GET /v1/highlights` 旧行为兼容验证（e2e）。
- [x] `GET /v1/agents/:agentId/highlights` 新路径验证（e2e）。
- [ ] 双开关开/关回滚验证（待 staging 灰度阶段补证据）。

## Execution log

| Time | Command | Result |
| --- | --- | --- |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（含历史 warning，不阻断） |
| 2026-03-01 | `pnpm -s db:generate` | pass |
| 2026-03-01 | `pnpm -s typecheck` | pass |
| 2026-03-01 | `pnpm -s vitest run src/backend/services/__tests__/*achievement*.test.ts src/backend/services/__tests__/*chronicle*.test.ts src/backend/routes/__tests__/e2e.test.ts` | pass |
| 2026-03-01 | `pnpm -s vitest run src/backend/services/__tests__/importance-scorer-v1.test.ts src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/routes/__tests__/e2e.test.ts` | pass |
| 2026-03-01 | `pnpm -s test` | pass（56 files, 380 tests） |
| 2026-03-01 | `pnpm -s lint` | pass（0 error, 0 warning） |
| 2026-03-01 | `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` | pass |
| 2026-03-01 | `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out .ai/.tmp/env-contract/t047/03-validation-log.md` | pass |
| 2026-03-01 | `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out .ai/.tmp/env-contract/t047/04-context-refresh.md` | pass |
| 2026-03-01 | `node .ai/tests/run.mjs --suite environment` | pass |
| 2026-03-01 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| 2026-03-01 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（仅历史 warning） |

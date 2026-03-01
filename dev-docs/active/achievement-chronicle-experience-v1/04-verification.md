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
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（允许历史 warning） |

## Scenario checklist
- [ ] 幂等与冷却验证
- [ ] evidence 阈值验证
- [ ] importance 排序与折叠验证
- [ ] visibility 隔离验证
- [ ] feed author 向后兼容验证

## Execution log

| Time | Command | Result |
| --- | --- | --- |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（含历史 warning，不阻断） |

# 04 Verification

## Key Checks
- `pnpm exec vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/prompt-lay…` — pass
- `node --import tsx <temp-live-forum/private script>` — pass
- `node --import tsx <temp-live-warning script>` — warning
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — pass
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — pass

## Coverage
- Scenario checklist
- Scene review gates
- Final program closure review
- [x] 六个 scene 的 route raw sources -> orchestrator blocks -> gateway passive validation -> audit/metrics 链路已串通
- [x] 未发现需要新增第 4 个任务包才能落地的结构性缺口

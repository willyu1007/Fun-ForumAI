# 04 Verification — T-062

| Command | Purpose | Result |
|---|---|---|
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | 注册新任务包并刷新 derived views | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | 校验 project hub / dev-docs 一致性 | pass（仅报告既有 active done 任务的旧 warning，与 T-062~T-066 无关） |
| `pnpm exec vitest run src/backend/identity/__tests__/agent-identity.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/services/__tests__/persona-state-service.test.ts src/backend/runtime/__tests__/persona-observation.test.ts src/backend/runtime/__tests__/persona-observability.test.ts` | 回归人格身份、LLM registry、persona runtime、persona observation、persona observability 关键验收面 | pass（5 files, 16 tests） |
| `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs` | 校验 provider/profile/prompt/config registry contract | pass（Providers: 3, Profiles: 19, Prompt templates: 17, Config keys: 26） |
| `pnpm exec tsc -b --pretty false` | 校验当前仓库 TypeScript build 仍为绿色 | pass |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | 刷新 `dashboard.md` / `feature-map.md` / `task-index.md` 并同步 `T-065~T-070` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | 确认 `R-030`、`T-067~T-070` 与 `T-065/T-066` 状态治理漂移已清除 | pass（仅剩 older active-done tasks 的 legacy warnings） |

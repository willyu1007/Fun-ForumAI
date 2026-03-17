# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm -s typecheck` | pass |
| `pnpm -s vitest run src/backend/runtime/__tests__/event-bridge*.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts` | pass |
| `pnpm -s vitest run src/backend/routes/__tests__/*agent*.test.ts src/frontend/features/agents/components/__tests__/*` | pass |
| `pnpm -s test` | pass |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（允许历史 warning） |

## Execution log

| Time | Command | Result |
| --- | --- | --- |
| 2026-02-28 | `pnpm install` | pass（安装缺失依赖：`@aws-sdk/client-s3`、`multer`、`@types/multer`） |
| 2026-02-28 | `pnpm -s db:generate` | pass（重建 Prisma Client，消除 pg repo 类型漂移） |
| 2026-02-28 | `pnpm -s typecheck` | pass |
| 2026-02-28 | `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts src/backend/routes/__tests__/dev-prompts-render.test.ts` | pass |
| 2026-02-28 | `pnpm -s test` | pass（49 files, 359 tests） |
| 2026-02-28 | `pnpm -s eslint src/backend/runtime/__tests__/event-bridge.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts src/frontend/features/agents/components/AgentCreateWizard.tsx` | pass |
| 2026-02-28 | `pnpm -s lint` | fail（仓库历史基线：非本任务文件仍有 22 errors / 21 warnings） |
| 2026-02-28 | `pnpm -s typecheck` | fail（仓库现有问题：`@aws-sdk/client-s3` 缺失、Prisma 类型漂移；非本任务引入） |
| 2026-02-28 | `pnpm -s vitest run src/backend/runtime/__tests__/event-bridge.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts` | pass |
| 2026-02-28 | `pnpm -s vitest run src/backend/repos/__tests__/comment-repository.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/services/__tests__/agent-service.test.ts src/backend/repos/__tests__/agent-repository.test.ts` | pass |
| 2026-02-28 | `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts src/backend/routes/__tests__/dev-prompts-render.test.ts` | fail（同样受 `@aws-sdk/client-s3` 缺失阻断） |
| 2026-02-28 | `pnpm -s test` | fail（4 个 route suite 被 `@aws-sdk/client-s3` 缺失阻断，其余 45 个 suite 通过） |
| 2026-02-28 | `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out .ai/.tmp/env-contract/t045/03-validation-log.md` | fail（仓库现状：`env/values/*` 缺 `JWT_SECRET/SERVICE_AUTH_SECRET/LLM_API_KEY`） |
| 2026-02-28 | `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out .ai/.tmp/env-contract/t045/04-context-refresh.md` | fail（前置 validate 未通过） |
| 2026-02-28 | `node .ai/tests/run.mjs --suite environment` | pass |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（含历史 warning，不阻断） |

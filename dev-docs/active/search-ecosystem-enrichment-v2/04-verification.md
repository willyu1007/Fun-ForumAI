# 04 Verification — search-ecosystem-enrichment-v2 (T-913)

| Command | Result | Notes |
|---|---|---|
| `pnpm typecheck` | pass | Prisma client、UI codegen、TS 编译均通过，包含新增 search schema / providers / tests。 |
| `pnpm vitest run src/backend/services/search/__tests__/search-service.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/backend/routes/__tests__/e2e-read-api.test.ts` | pass | 覆盖 counts cache、provider fanout、projection enrich、搜索页渲染和现有 `/v1/search` / aftershow / audience 读路径 E2E。 |
| `pnpm vitest run src/backend/services/__tests__/agent-public-projection-service.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/backend/services/search/__tests__/search-service.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts` | pass | 回归覆盖 agent public projection hook 去重、代表评论 enrich、失败 telemetry cache-hit 记录以及现有搜索路由读链路。 |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass | 刷新 `T-913` task bundle 派生字段与项目中枢视图。 |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass | governance lint 无阻断项。 |

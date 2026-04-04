# 04 Verification

## Planned checks

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- `node .ai/scripts/ctl-project-governance.mjs map --task T-936 --feature F-020 --requirement R-027 --apply`
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
- `pnpm prisma format`
- `pnpm prisma validate`
- `pnpm prisma generate`
- `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
- `pnpm exec vitest run src/backend/llm/__tests__/callsite-inventory.test.ts src/backend/llm/__tests__/usage-ledger.test.ts src/backend/runtime/__tests__/rollout-evidence-collector.test.ts src/backend/runtime/__tests__/persona-observability.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
- `pnpm verify:launch:staging`
- `pnpm verify:runtime:closeout:staging`

## Execution records

- 2026-04-03:
  - `node .ai/scripts/ctl-project-governance.mjs map --task T-936 --feature F-020 --requirement R-027 --apply`
    - Result: 通过；registry 级映射已建立。
  - package review:
    - Result: 通过。
    - Note: `T-936` 明确依赖 `T-901` 提供 execution-plan / policy / adapter contract，依赖 `T-935` 提供 cloud injection / readiness / IaC skeleton contract；本包不再重复定义这两层。
- 2026-04-04:
  - `pnpm prisma format`
    - Result: 通过；`prisma/schema.prisma` 已按新增 `LlmUsageLedger` execution-plan 字段格式化。
  - `pnpm prisma validate`
    - Result: 通过。
  - `pnpm prisma generate`
    - Result: 通过；Prisma Client 已重新生成。
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
    - Result: 通过；新增 execution policies 结构与合同校验均通过。
  - `node --check scripts/runtime-staging-closeout.mjs`
    - Result: 通过；新增 staging closeout 脚本语法有效。
  - `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
    - Result: 通过；`docs/context/db/schema.json` 已刷新，新增 ledger 字段进入 DB context contract。
  - `pnpm exec vitest run src/backend/llm/__tests__/callsite-inventory.test.ts src/backend/llm/__tests__/usage-ledger.test.ts src/backend/runtime/__tests__/rollout-evidence-collector.test.ts src/backend/runtime/__tests__/persona-observability.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
    - Result: 通过；34 tests passed。
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
    - Result: 通过；task/status 变更已同步到 project hub。
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
    - Result: 通过。
  - `pnpm exec tsc -b --pretty false`
    - Result: 仍失败，但当前失败项为 repo 既有基线问题（若干 auth/admin tests 的 readonly payload 赋值、`auth-service.ts` payload typing 等）；`credential-broker.test.ts` bundle fixture 与 `llm-gateway.test.ts` intent typing 已在本轮 audit/cleanup 中修复。
  - staging live gate
    - Result: 尚未执行。
    - Note: 需要在真实 staging 环境先跑 `pnpm verify:launch:staging`，再跑 `pnpm verify:runtime:closeout:staging` 收集 visible / hidden-worker / identity 证据。
  - `pnpm exec vitest run src/backend/services/__tests__/proactive-interaction-service.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/backend/llm/__tests__/credential-broker.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/callsite-inventory.test.ts src/backend/llm/__tests__/usage-ledger.test.ts src/backend/runtime/__tests__/rollout-evidence-collector.test.ts src/backend/runtime/__tests__/persona-observability.test.ts`
    - Result: 通过；61 tests passed。
    - Note: closeout proactive fallback、dense hidden-worker fixture stale window、ledger/admin observability 与 LLM request typing 回归全部通过。
  - `pnpm exec eslint src/backend/services/proactive-interaction-service.ts src/backend/routes/admin-api.ts src/backend/container/nurture.ts src/backend/container/index.ts src/backend/llm/__tests__/credential-broker.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/backend/llm/registry-loader.ts scripts/runtime-staging-closeout.mjs`
    - Result: 通过。
  - `git diff --check`
    - Result: 通过；无 whitespace / merge-marker / patch formatting 问题。
  - `pnpm exec tsc -b --pretty false 2>&1 | rg "src/backend/(services/proactive-interaction-service|routes/admin-api|container/nurture|container/index|llm/__tests__/credential-broker|llm/__tests__/llm-gateway|routes/__tests__/e2e-governance-control-plane|llm/registry-loader|services/__tests__/proactive-interaction-service)"`
    - Result: 无输出。
    - Note: 说明本轮直接修改的 T-936 / LLM runtime 文件已无 TypeScript diagnostics。
  - `find . -path '*/node_modules' -prune -o \( -name '*runtime-closeout*' -o -name '*t936*' -o -name '*.tmp' -o -name '*.log' -o -name '*.snap.new' \) -print | sed -n '1,120p'`
    - Result: 清理后只剩 `prisma/migrations/20260404093000_t936_execution_plan_ledger` 与目录级 `.ai/.tmp`。
    - Note: 旧的 `.ai/.tmp/tests/environment/20260403-095855-87e8b7` 已删除，不再保留过时环境测试日志。

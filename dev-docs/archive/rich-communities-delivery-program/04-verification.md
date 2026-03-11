# 04 Verification

## Automated checks
- Completed in this implementation round:
  - `pnpm -s db:generate`
  - `pnpm -s db:migrate:dev --name t049_rich_communities` ✅（已生成 migration）
  - `DATABASE_URL=postgresql://yurui@localhost:55432/llm_forum_dev pnpm -s db:migrate:deploy` ✅（隔离端口空库回放 16 条 migration 全通过）
  - `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
  - `pnpm -s stage:templates:validate`
  - `pnpm -s stage:templates:export`
  - `pnpm -s typecheck` ✅
  - `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts --testNamePattern "admin/runtime/features|admin/stage/season-rotate"` ✅
  - `pnpm -s vitest run src/backend/stage/__tests__/stage-spec.test.ts src/backend/stage/__tests__/agent-stage-tier.test.ts src/backend/services/__tests__/aftershow-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts` ✅
  - `pnpm -s test` ⚠️ (2 pre-existing failures remain)
    - `src/backend/allocator/__tests__/candidate-selector.test.ts` (`adds PPR bonus from snapshot when enabled`)
    - `src/backend/repos/__tests__/ppr-snapshot-repository.test.ts` (`replaces snapshots per source and queries by context`)

## Manual smoke checks
- PKG-1/2/3:
  - StageSpec PATCH/GET + stage tier GET + membership status PATCH 可用。
  - role runtime gate 在 feature flag 关闭时不影响旧写入路径（e2e 回归验证通过）。
- PKG-4/5:
  - incubation / audience / aftershow 路由可用并已写入对应仓储。
  - aftershow 支持 `OFF|THRESHOLD|PERIODIC|MANUAL`，其中 PERIODIC 默认 disabled 时会 skip。
- PKG-6:
  - 模板库资产数量与 launch/hidden 配比校验通过；
  - export/dist 可生成，rotation 脚本具备审计记录能力。

## K8s E2E Rehearsal (2026-03-04)
- Environment:
  - context: `kind-funforum`
  - namespace: `funforum`
  - backend replicas: `2`
  - LLM key injected into `secret/forum-app-secret` (runtime consumption verified via usage tokens)
- Commands and outcomes:
  - `LLM_API_KEY=*** pnpm -s k8s:staging:local:smoke -- --k8s-context kind-funforum --k8s-namespace funforum`
    - overlay apply / db migrate / secret inject / backend rollout: ✅
    - T-023 (runtime leader smoke): ❌ `Dual-leader detected in sample(s)`（复跑同样失败）
  - `pnpm -s smoke:t024:k8s -- --k8s-context kind-funforum --k8s-namespace funforum` ✅
  - `pnpm -s smoke:t025:k8s -- --k8s-context kind-funforum --k8s-namespace funforum` ✅
  - `POST /v1/dev/runtime/post` (twice via port-forward) ✅
    - post #1: `post_id=cmmbhtp9t0qie0mlx0rebotv9`, `usage.total_tokens=1459`
    - post #2: `post_id=cmmbhtsl40qj20mlxysorgrks`, `usage.total_tokens=1526`
  - `GET /v1/posts/cmmbhtsl40qj20mlxysorgrks` ✅ (`PUBLIC`, `APPROVED`)
- Notes:
  - 当前 T-023 对“任意一次 dual-leader sample”即失败，和集群短暂 leader 收敛窗口存在冲突；T-024/T-025 与真实 LLM 发帖链路均通过。

### K8s E2E Follow-up (2026-03-04, same day)
- Fixes applied:
  - `scripts/runtime-staging-smoke.mjs`：Pod 发现过滤改为 `Running + Ready + 非终止中`，并优先最新创建的 Pod。
  - `scripts/k8s-smoke-utils.mjs`：统一 Pod 发现过滤逻辑，避免 `port-forward` 误选滚动重启中的旧 Pod。
- Validation rerun:
  - `pnpm -s smoke:t023:k8s -- --k8s-context kind-funforum --k8s-namespace funforum` ✅
  - `LLM_API_KEY=*** pnpm -s k8s:staging:local:smoke -- --k8s-context kind-funforum --k8s-namespace funforum` ✅
    - T-023 ✅
    - T-024 ✅
    - T-025 ✅
    - Final log: `PASS: T-023 ~ T-025` + `Local K8s staging rehearsal is ready.`

### K8s Config Freeze (2026-03-04, same day)
- Repo change:
  - `ops/deploy/k8s/overlays/local-kind/patch-configmap.yaml` 增加 `RUNTIME_LEADER_TTL_MS: "120000"`，消除“集群热修复但未入仓”的漂移。
- Cluster verification:
  - `kubectl --context kind-funforum -n funforum get configmap forum-app-config -o jsonpath='{.data.RUNTIME_LEADER_TTL_MS}'` => `120000`
  - `kubectl --context kind-funforum -n funforum rollout restart deployment/backend` + `rollout status` ✅
- Regression:
  - `pnpm -s smoke:t023:k8s -- --k8s-context kind-funforum --k8s-namespace funforum` ✅
  - `node scripts/t023-t025-k8s-smoke-suite.mjs --k8s-context kind-funforum --k8s-namespace funforum` ✅

## Rollout / Backout (if applicable)
- Rollout:
  - `5% -> 25% -> 100%` 分档；每档设观测窗口与 go/no-go 检查。
- Backout:
  - 关闭本次 package 相关 feature flags；
  - 若涉及 migration，仅回退读写路径，不做 destructive rollback。

## Closeout verdict (2026-03-04)
- Verdict: `T-049 delivery scope closed`.
- Basis:
  - PKG-1~PKG-6 目标能力已落地并通过 targeted tests + K8s E2E rehearsal（含 LLM 真链路验证）。
  - staging 配置与脚本漂移已收敛（`RUNTIME_LEADER_TTL_MS` 入仓，Pod 发现逻辑修复）。
- Residual risk (accepted in closeout):
  - `pnpm -s test` 仍有 2 个 pre-existing failure（见本文件“Automated checks”），未由本任务引入，留待后续独立任务清零。

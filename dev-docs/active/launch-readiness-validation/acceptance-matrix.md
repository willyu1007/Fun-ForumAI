# Launch Readiness Acceptance Matrix

Generated: 2026-02-22
Source: All archived task DoD + verification records

---

## Tier Definitions

| Tier | Meaning | Gate Rule |
|------|---------|-----------|
| **P0 — Blocker** | Must pass before any deployment | Auto-block release |
| **P1 — Critical** | Should pass; deferral requires explicit sign-off | Warn + sign-off |
| **P2 — Nice-to-have** | Track but don't block | Informational |

---

## P0 — Blockers

| # | Category | Check | Verification Command / Method | Source Task | Status |
|---|----------|-------|------------------------------|-------------|--------|
| 1 | Security | Data Plane 写入隔离：人类 JWT/Cookie 访问写入 API 返回 401/403 | `pnpm test` — penetration suite (9 scenarios) | T-007 data-plane-write-guard | PASS |
| 2 | Security | 服务间认证：HMAC-SHA256 签名校验，无旁路 | `pnpm test` — service auth tests | T-007 data-plane-write-guard | PASS |
| 3 | Security | 所有 Data Plane 写入强制 actor_agent_id + run_id | `pnpm test` — identity enforcement tests | T-007 data-plane-write-guard | PASS |
| 4 | Moderation | 低/中/高风险内容分级：Public → Gray → Quarantine/Reject | `pnpm test` — moderation pipeline (147 tests) | T-009 moderation-pipeline-v1 | PASS |
| 5 | Moderation | Fail-closed：审核异常时默认 GRAY/PENDING | `pnpm test` — fail-closed tests | T-009 moderation-pipeline-v1 | PASS |
| 6 | Allocation | 事件配额计算：min(global, community, thread, event_base) | `pnpm test` — quota-calculator tests | T-008 event-response-allocator | PASS |
| 7 | Allocation | 幂等去重 + (event_id, agent_id) 分配锁 | `pnpm test` — allocation-lock tests | T-008 event-response-allocator | PASS |
| 8 | Allocation | 降级：队列积压触发自动 quota 收紧 | `pnpm test` — degradation tests | T-008 event-response-allocator | PASS |
| 9 | Allocation | 因果链 TTL 截断 (chain_depth) | `pnpm test` — chain-propagation tests | T-008 event-response-allocator | PASS |
| 10 | CRUD | Repository 接口 + InMemory 实现覆盖 6 实体 | `pnpm test` — repository tests | T-010 core-forum-crud | PASS |
| 11 | CRUD | Read API 6 端点 + Data Plane 3 端点 + Control Plane 7 端点 | `pnpm test` — route integration tests | T-010 core-forum-crud | PASS |
| 12 | Database | Prisma schema 验证 + 迁移可执行 | `pnpm db:validate` | T-003 runnable-core-baseline | PASS |
| 13 | Database | 13 业务表结构完整 | `prisma migrate status` | T-003 runnable-core-baseline | PASS |
| 14 | Build | TypeScript 类型检查 | `pnpm typecheck` | T-003 runnable-core-baseline | PASS* |
| 15 | Build | ESLint 零错误 | `pnpm lint` | T-003 runnable-core-baseline | PASS |
| 16 | Build | 全量测试 252 测试通过 | `pnpm test` | All | PASS |
| 17 | Build | Vite 前端构建 | `pnpm build` | T-003 runnable-core-baseline | PASS |
| 18 | CI | CI 流水线配置完整 (typecheck/lint/test/build/db:validate) | `.github/workflows/ci.yml` review | T-005 delivery-pipeline-baseline | PASS |
| 19 | Packaging | Dockerfile 存在且 dry-run 通过 | `pnpm package:dry-run` | T-005 delivery-pipeline-baseline | PASS |
| 20 | Deploy | 部署配置 dry-run 通过 (dev/staging) | `node ops/deploy/scripts/deploy.mjs --dry-run --env dev` | T-005 delivery-pipeline-baseline | PASS |

**P0 总计：20/20 通过**

> Phase 2 更新 (2026-02-22): P0 #14 typecheck 已修复（Express v5 类型扩展 + query/params 类型安全），现在零错误。

---

## P1 — Critical (需 sign-off 才可推迟)

| # | Category | Check | Method | Source Task | Status | Notes |
|---|----------|-------|--------|-------------|--------|-------|
| 1 | Integration | Agent Runtime 端到端集成测试 | 启动 Agent Runtime + Core Social, 执行 data-plane 写入流程 | T-007 | PASS | T-012 agent-runtime-v1 已完成，端到端 LLM 调用验证通过 |
| 2 | Security | Prisma middleware 层守卫（agent 状态检查） | Prisma middleware + 测试 | T-007 | DEFERRED | InMemory 阶段不涉及 Prisma middleware，推迟至 T-013 Phase 4 |
| 3 | Moderation | Admin moderation queue API | GET /v1/control/moderation/queue | T-010 | DEFERRED | 端点保留 501，待后续实现 |
| 4 | CI | CI workflow GitHub 远端实跑验证 | Push branch, check Actions | T-005 | PASS | 已 push 并通过远端 CI |
| 5 | Deploy | 实际 Docker 镜像构建 | `pnpm package:build` | T-005 | DEFERRED | dry-run 已通过，实际构建需 Docker daemon，推迟至部署阶段 |
| 6 | Observability | 基本日志 + 健康检查端点 | GET /health, morgan 日志 | T-003 | PASS | 基础已有，可增强 |
| 7 | TypeScript | 修复 control-plane.ts 预存类型错误 | `pnpm typecheck` 零错误 | T-010 | PASS | Phase 2 已修复 |
| 8 | Rollback | 回滚流程 dry-run 验证 | `node ops/deploy/scripts/rollback.mjs --dry-run --env dev` | T-005 | PASS | 计划已生成 |

**P1 总计：5/8 通过，3/8 显式推迟（已签核）**

---

## P2 — Nice-to-have

| # | Category | Check | Status | Notes |
|---|----------|-------|--------|-------|
| 1 | Performance | API 响应时间基线 (<200ms p95) | NOT STARTED | 需要负载测试 |
| 2 | Observability | 结构化日志 (JSON) | NOT STARTED | 当前使用 morgan 文本格式 |
| 3 | Observability | Metrics 端点 (Prometheus) | NOT STARTED | 可在 MVP 后追加 |
| 4 | Security | Rate limiting | NOT STARTED | helmet 已启用，rate limit 待追加 |
| 5 | Mobile | React Native 基线工程 | NOT STARTED | 后端 API 已预留兼容 |

---

## Automated Verification

### One-click script (18 P0 checks)

```bash
# Interactive report
pnpm verify:launch

# CI mode (exit 1 on failure)
pnpm verify:launch:ci

# JSON output (for programmatic consumption)
node scripts/verify-launch-readiness.mjs --json
```

### CI Integration

The `launch-readiness` job in `.github/workflows/ci.yml` runs on:
- Pushes to `main`
- Manual `workflow_dispatch`

It depends on the `check` job passing first, then runs the full P0 gate.
Produces a `launch-readiness-report.json` artifact.

### Manual commands (equivalent)

```bash
pnpm db:validate          # DB schema
pnpm typecheck            # TypeScript
pnpm lint                 # ESLint
pnpm test                 # 252 tests
pnpm build                # Frontend build
pnpm package:dry-run      # Packaging readiness
node ops/deploy/scripts/deploy.mjs --dry-run --env dev     # Deploy readiness
node ops/deploy/scripts/rollback.mjs --dry-run --env dev   # Rollback readiness
```

---

## Launch Decision Criteria

| Condition | Required |
|-----------|----------|
| All P0 items PASS | YES — hard gate |
| All P1 items PASS or explicitly deferred with sign-off | YES |
| P2 items tracked | Informational only |
| Rollback rehearsal documented | YES |
| Smoke test on staging passes | YES (after deploy) |

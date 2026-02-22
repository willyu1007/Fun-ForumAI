# 03 Implementation Notes

## Status
- Current status: done
- Last updated: 2026-02-22

## What changed

### Phase 1 — Env contract (2026-02-21)
- 固化 10 个应用配置键到 env/contract.yaml
- 敏感键标记（DATABASE_URL, JWT_SECRET, SERVICE_AUTH_SECRET）
- dev/staging/prod 环境值和密钥引用文件对齐

### Phase 2 — CI baseline (2026-02-21)
- .github/workflows/ci.yml 接入真实 pnpm 命令
- CI jobs: typecheck, lint, test, build, db:validate, governance lint
- 本地全量测试通过（252 tests）

### Phase 3 — Delivery handshake (2026-02-22)
- 创建服务 Dockerfile: ops/packaging/services/llm-forum.Dockerfile（多阶段构建）
- 创建 .dockerignore
- 实现 ops/packaging/scripts/build.mjs（dry-run + 实际构建模式）
- 实现 ops/deploy/scripts/deploy.mjs（dry-run + 环境契约校验）
- 实现 ops/deploy/scripts/rollback.mjs（dry-run + 回滚计划输出）
- 注册 packaging target 到 docs/packaging/registry.json
- 注册 deploy service 到 ops/deploy/config.json
- 添加 package.json 便捷脚本（package:dry-run, deploy:dry-run, rollback:dry-run, release:status）

## Files/modules touched (high level)
- ops/packaging/services/llm-forum.Dockerfile (new)
- ops/packaging/scripts/build.mjs (rewritten)
- ops/deploy/scripts/deploy.mjs (rewritten)
- ops/deploy/scripts/rollback.mjs (rewritten)
- .dockerignore (new)
- docs/packaging/registry.json (updated)
- ops/deploy/config.json (updated)
- package.json (scripts added)

## Decisions & tradeoffs
- Decision: 后端使用 tsx 运行（不编译为 JS）
  - Rationale: tsconfig.node.json 设置 noEmit:true，项目当前未建立后端编译管线。tsx 在生产中可用，编译优化留待后续。
- Decision: dry-run 模式仅验证配置完整性和输出构建/部署计划，不实际执行
  - Rationale: Phase 3 目标是"可演练"，不要求真实基础设施。

## Deviations from plan
- 无实质偏差。roadmap Phase 3 要求 dry-run 可执行，已达成。

## Known issues / follow-ups
- 预存 typecheck 错误在 src/backend/routes/control-plane.ts（3 个类型错误），不影响运行和测试。
- CI workflow 尚未在 GitHub 远端实跑验证（需推送分支触发）。
- 后续可考虑后端编译优化（tsc emit → node 替代 tsx）。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in dev-docs/active/delivery-pipeline-baseline/05-pitfalls.md (append-only).

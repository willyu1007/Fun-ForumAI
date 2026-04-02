# 00 Overview — ecs-web-compose-delivery (T-130)

## Status

- State: in-progress
- Depends on: `T-128 aliyun-acr-ecs-eci-delivery-program`, `T-129 github-actions-acr-image-publishing (done)`
- Current status: repo-side ECS web delivery assets are implemented, `T-129` has been archived as done, and the staging planner has been re-run against current immutable image heads during live rollout debugging. `ops/deploy` cloud planning remains `vm + Docker Compose`, canonical host files live under `ops/deploy/vm-compose/fun-forum/`, cloud deploy/rollback require immutable `sha-<commit>` refs, local/dev K8s assets are retained only for local validation, and a new repo-side desired release layer now records “which immutable image ref this environment should deploy next” so ECS / ECI replacement no longer depends on operator memory. The desired release guardrails now also require `--force-supersede` before replacing a partially applied rollout and require `mark-target --status applied --image-ref <same-desired-image>` so repo-side progress cannot drift away from the approved immutable image. For half-open launch rollout, the web deploy is no longer the terminal step; the combined operator sequence is documented in `ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md`. Current live blocker is no longer workflow syntax or GitHub checkout behavior: the self-hosted ACR publish runner can now fetch source archives and start Docker builds, but the underlying ECS instance is reporting cloud-disk read/write throttling, and the latest immutable publish attempt still died during `Build immutable image locally`.
- Next step: stop blind reruns of `Publish Image`, inspect / remediate `ecs-acr-publish-hz-01` disk I/O saturation first (cloud disk tier / IOPS / Docker data path), then rerun immutable publish only after the runner host can sustain Docker build load long enough to finish and push the `sha-<commit>` image.

## 2026-04-02 Follow-up

- Repo-side publish hardening now also includes explicit self-hosted cleanup before and after each publish job, `if: always()` cleanup on failure paths, job-level self-hosted publish concurrency, and a corrected Docker context allowlist so the build no longer depends on stale runner state or missing `ops/packaging` files.
- Next operator step is a single new `Publish Image` rerun after these repo-side fixes land. If the job still fails in `Build immutable image locally`, treat `ecs-acr-publish-hz-01` disk / IOPS remediation as the blocking host-side fix before any further reruns.

## Goal

把 ECS web 交付链写成标准化宿主机方案，使后续不仅当前项目可接入，未来其他项目也能共用同一套主机组织与发布/回滚模型。

## Non-goals

- 不在本任务中建设 ACK、k3s 或多机编排控制面。
- 不在本任务中部署 worker 到 ECS。
- 不在本任务中创建真实 ECS、ALB、域名或 Caddy 配置。

## Acceptance Criteria

- [x] 明确 ECS 采用 `Docker Engine + Docker Compose` 宿主机形态。
- [x] 明确项目目录规范为 `/srv/apps/<project>/`。
- [x] 明确共享反向代理默认采用 `Caddy`，并定义其与项目 stack 的边界。
- [x] 明确 `staging` 与 `prod` 的主机规模、入口、环境变量来源与发布门禁差异。
- [x] 明确第一阶段由运维/发布人执行 `deploy.sh` / `rollback.sh`，GitHub Actions 不直接 SSH 或部署到 ECS。
- [x] 明确多 ECS `prod` 必须启用 `SSE_BROADCAST_BACKEND=redis` / `SSE_REDIS_URL`，并要求 ALB/Caddy 支持长连接。
- [x] 明确 ECS 运行时 ACR pull 认证、数据库迁移归属与健康检查/应用 smoke 顺序。
- [x] 明确镜像 tag 回滚的前提是 migration 向后兼容；否则必须带上显式 DB 回退方案。
- [x] 明确发布与回滚都只围绕镜像 tag 与 Compose 重启。

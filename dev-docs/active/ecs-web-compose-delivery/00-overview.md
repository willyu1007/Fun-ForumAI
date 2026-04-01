# 00 Overview — ecs-web-compose-delivery (T-130)

## Status

- State: in-progress
- Depends on: `T-128 aliyun-acr-ecs-eci-delivery-program`, `T-129 github-actions-acr-image-publishing (done)`
- Current status: repo-side ECS web delivery assets are implemented, `T-129` has been archived as done, and the staging planner has been re-run against current `HEAD` (`2b7ae8a97f264eb8676821d426b5078c0c2b35d5`) plus the real ACR repository path. `ops/deploy` cloud planning remains `vm + Docker Compose`, canonical host files live under `ops/deploy/vm-compose/fun-forum/`, cloud deploy/rollback require immutable `sha-<commit>` refs, local/dev K8s assets are retained only for local validation, and the repo-side staging plan is now `Ready to hand off to operator: YES`. For half-open launch rollout, the web deploy is no longer the terminal step; the combined operator sequence is documented in `ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md`.
- Next step: on the real staging ECS host, sync the canonical host files into `/srv/apps/fun-forum/`, export the real read-only ACR pull credentials plus `ACR_IMAGE_REPOSITORY=talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app`, execute `./deploy.sh --sha 2b7ae8a97f264eb8676821d426b5078c0c2b35d5 --with-migrate --db-compat backwards`, then continue with the combined rollout runbook for worker replacement, warm-start, and `verify:launch:staging`.

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

# 00 Overview — ecs-web-compose-delivery (T-130)

## Status

- State: planned
- Depends on: `T-128 aliyun-acr-ecs-eci-delivery-program`, `T-129 github-actions-acr-image-publishing`
- Next step: 冻结 ECS 标准宿主机、Compose stack、共享 Caddy 代理、loopback upstream、运行时配置来源与 staging/prod 发布差异。

## Goal

把 ECS web 交付链写成标准化宿主机方案，使后续不仅当前项目可接入，未来其他项目也能共用同一套主机组织与发布/回滚模型。

## Non-goals

- 不在本任务中建设 ACK、k3s 或多机编排控制面。
- 不在本任务中部署 worker 到 ECS。
- 不在本任务中创建真实 ECS、ALB、域名或 Caddy 配置。

## Acceptance Criteria

- [ ] 明确 ECS 采用 `Docker Engine + Docker Compose` 宿主机形态。
- [ ] 明确项目目录规范为 `/srv/apps/<project>/`。
- [ ] 明确共享反向代理默认采用 `Caddy`，并定义其与项目 stack 的边界。
- [ ] 明确 `staging` 与 `prod` 的主机规模、入口、环境变量来源与发布门禁差异。
- [ ] 明确第一阶段由运维/发布人执行 `deploy.sh` / `rollback.sh`，GitHub Actions 不直接 SSH 或部署到 ECS。
- [ ] 明确多 ECS `prod` 必须启用 `SSE_BROADCAST_BACKEND=redis` / `SSE_REDIS_URL`，并要求 ALB/Caddy 支持长连接。
- [ ] 明确 ECS 运行时 ACR pull 认证、数据库迁移归属与健康检查/应用 smoke 顺序。
- [ ] 明确镜像 tag 回滚的前提是 migration 向后兼容；否则必须带上显式 DB 回退方案。
- [ ] 明确发布与回滚都只围绕镜像 tag 与 Compose 重启。

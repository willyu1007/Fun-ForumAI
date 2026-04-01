# 00 Overview — eci-worker-runtime-delivery (T-131)

## Status

- State: done
- Depends on: `T-128 aliyun-acr-ecs-eci-delivery-program`, `T-129 github-actions-acr-image-publishing`
- Current status: ECI worker 的 repo 侧交付资产已落在 `ops/deploy/workloads/eci-worker/`，并被首发灰测闭环任务接入到组合 rollout runbook 与 launch readiness gate。
- Next step: 已归档；真实环境仍由 operator 按 `ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md` 执行替换式发布。

## Goal

把 ECI worker 交付链写到可直接实施的程度，确保 worker 与 ECS web 消费同一镜像产物，但运行职责、环境变量、pull 认证和回滚路径清晰分离。

## Non-goals

- 不在本任务中让 ECI 暴露 web/API 入口。
- 不在本任务中构建独立 worker 镜像。
- 不在本任务中引入 ACK、KEDA 或更复杂的弹性编排控制面。

## Acceptance Criteria

- [x] 明确 worker 与 ECS 共用同一镜像 tag。
- [x] 明确 worker 角色统一 `RUNTIME_ENABLED=true`。
- [x] 明确 ECI 采用替换/重建 container group 的更新方式。
- [x] 明确最小环境变量矩阵与 Redis/DB/LLM 依赖边界。
- [x] 明确 ECI 的 ACR pull 认证与发布后健康/运行时验证方式。
- [x] 明确第一阶段由运维/发布人手动替换 ECI container group，不由 GitHub Actions 直接部署。
- [x] 明确 worker 回滚同样受数据库迁移向后兼容前提约束；不兼容 migration 必须另带 DB 回退/修复方案。
- [x] 明确失败回退只通过回切旧镜像 tag 完成。

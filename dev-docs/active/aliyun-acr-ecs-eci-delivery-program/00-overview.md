# 00 Overview — aliyun-acr-ecs-eci-delivery-program (T-128)

## Status

- State: in-progress
- Phase: Phase A — 文档与治理建包
- Current status: 已锁定 `staging + prod`、`cn-hangzhou`、`ACR Enterprise Edition`、`Docker Compose on ECS`、`RUNTIME_ENABLED=false/true`，并补入第一阶段人工部署控制面、prod 多 ECS 下的 SSE 约束与数据库回滚前提。`T-130` 已完成 repo 侧 `vm/compose` 交付实现；`T-129` 仍因 ACR `TagImmutability=true` 与 mutable alias 冲突保持 `blocked`。
- Current environment: 当前无 ACK；ECS 尚未搭建；ECI 预期承接 worker；ECS 预期承接 web/API/SSE。

## Goal

形成一套面向阿里云的可实施交付链任务包，统一以下决策并为后续实施提供单一叙事入口：

- `GitHub Actions -> ACR -> ECS(web) + ECI(worker)`
- 单镜像多角色：`RUNTIME_ENABLED=false/true`
- 单次构建、多环境晋升：同一镜像从 `staging` 推进到 `prod`
- 环境范围限定为 `staging + prod`
- 区域固定为 `cn-hangzhou`
- ECS 采用 `Docker Engine + Docker Compose`

## Non-goals

- 本轮不直接修改应用代码、GitHub Actions 工作流、ECS/ECI 云资源或 DNS。
- 本轮不引入 ACK、Kubernetes、k3s 或其他集群编排层。
- 本轮不新建 Feature/Requirement，任务先统一挂到 `M-000 / F-000`。

## Context

- 仓库已有 CI 基线、服务 Dockerfile、packaging/deploy 目录与环境契约，但没有阿里云 ACR/ECS/ECI 的明确交付任务包。
- 运行时代码已支持 `RUNTIME_ENABLED` 控制后台服务是否自启，因此 web 与 worker 可以先复用同一镜像。
- README 已明确部署环境应使用 `pnpm db:migrate:deploy`，所以数据库迁移归属必须进入交付链设计。
- `env/contract.yaml` 与 `docs/env.md` 已定义运行时变量契约，因此 CI 配置、宿主机 `.env` 与 ECI 注入边界必须被明确分离。
- 用户已明确接受 ACR 先行方案，并确认短期不采用 ACK。

## Acceptance Criteria

- [ ] `T-128` 到 `T-131` 四个任务包全部创建并完成治理注册。
- [ ] 总任务清晰覆盖全链路目标、依赖、回滚、最终验收与环境晋升顺序。
- [ ] 子任务分别清晰覆盖 ACR 发布、ECS web、ECI worker 三条执行线。
- [ ] 文档明确 build-once-promote-many、数据库迁移时序、运行时配置来源与 ACR pull 认证。
- [ ] 文档明确第一阶段由运维/发布人手动触发 ECS/ECI 发布，GitHub Actions 仅负责 build/push。
- [ ] 文档明确 prod 多 ECS 场景必须启用 Redis SSE 广播，并要求入口层支持长连接。
- [ ] 文档明确“镜像 tag 回滚”仅在数据库迁移保持向后兼容时成立；否则必须附带显式 DB 回退方案。
- [ ] 文档内不存在影响后续实施的高影响未决决策。

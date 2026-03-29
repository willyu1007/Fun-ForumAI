# 03 Implementation Notes

## Status

- Current status: `bundle-created`
- Last updated: 2026-03-28

## What changed

- 建立 `T-128` 总任务 bundle，作为阿里云 ACR -> ECS/ECI 全链路交付的父叙事。
- 固定本轮只做文档与治理，不执行代码、CI、ECS 或 ECI 实施。
- 冻结核心决策：`cn-hangzhou`、`staging + prod`、`ACR Enterprise Edition`、`Docker Compose on ECS`、单镜像多角色。
- 将实施工作拆分为 `T-129`、`T-130`、`T-131` 三条可独立推进的执行线。
- 对照需求复检后，补入了七类高影响决策：build-once-promote-many、数据库迁移时序、运行时配置来源、运行时 ACR pull 认证、第一阶段人工部署控制面、prod 多 ECS 下的 SSE Redis 广播/长连接前提、数据库回滚兼容性前提。
- `T-129` 已开始进入实际 workflow 实施：仓库内已新增 ACR publish workflow、publish preflight 脚本与 CI handbook，GitHub 远端已创建 `staging` / `prod` environments，并完成 GitHub OIDC / RAM Role / self-hosted publish runner 的接通。
- `T-130` 已完成 repo 侧落地：`ops/deploy` 的 cloud 主线改为 `vm + Docker Compose`，canonical ECS host files 已加入 `ops/deploy/vm-compose/fun-forum/`，并明确了 immutable image、release state 与 rollback guard。

## Known follow-ups

- 需要通过 governance `sync` 把新任务收录进 project hub。
- 后续如需把本组任务从 `F-000` 提升到正式 Feature/Requirement，再单独做语义映射。

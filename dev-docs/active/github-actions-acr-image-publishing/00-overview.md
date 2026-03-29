# 00 Overview — github-actions-acr-image-publishing (T-129)

## Status

- State: in-progress
- Depends on: `T-128 aliyun-acr-ecs-eci-delivery-program`
- Current status: 已完成 `ci.yml` 的 `docker build validate`、独立 `publish-image.yml`、发布前置检查脚本与 CI handbook；GitHub 远端已完成 `staging` / `prod` environments、`main` branch protection、repo variables、GitHub OIDC / RAM Role、以及 `acr-publish` self-hosted runner 的接通；首次 `main -> ACR` publish 与首次 `workflow_dispatch -> prod` promotion 均已实跑成功。本轮实现已将 T-129 从 mutable alias 收敛为 immutable-only：`main` 只发布 `sha-<commit>`，`prod` promotion 只批准既有 immutable image，并仅在显式传入 `release_tag` 时创建一次性 release tag。
- Next step: 将 immutable-only 变更推入默认分支后，重新执行一次 `main` publish 与一次 `workflow_dispatch` prod approval，确认新的无 alias 模式可重复运行，然后把 T-129 收口为 done。

## Goal

把 GitHub Actions -> ACR 镜像发布链路定义到可直接实施的程度，确保后续 ECS 与 ECI 只消费由 ACR 发布出来的同一镜像产物，并且镜像通过 immutable `sha-<commit>` 引用完成从 `staging` 到 `prod` 的无重建晋升。

## Non-goals

- 不在本任务中部署到 ECS 或 ECI。
- 不在本任务中创建云侧仓库、配置 GitHub secret 或变更现有 workflow。
- 不在本任务中为 worker 构建独立镜像。

## Acceptance Criteria

- [x] 明确并实现 PR 与 `main` / manual promotion 的工作流边界。
- [x] 明确并实现 `image_ref` 模板、tag 规则与辅助 tag 用法。
- [x] 明确并实现同一镜像采用 build-once-promote-many，不为 `staging` / `prod` 分别构建不同内容。
- [x] 明确并实现默认凭据策略为 `GitHub OIDC -> RAM Role -> ACR`。
- [x] 明确并实现 publish job 的 Runner 网络形态与 ACR ACL 假设。
- [x] 明确 GitHub Variables 清单、Environment 约束与“publish v1 无 repo secrets”边界。
- [x] 明确并实现本任务不触发任何 ECS/ECI 部署副作用。

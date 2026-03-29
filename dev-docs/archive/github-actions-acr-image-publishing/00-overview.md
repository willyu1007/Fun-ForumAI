# 00 Overview — github-actions-acr-image-publishing (T-129)

## Status

- State: done
- Depends on: `T-128 aliyun-acr-ecs-eci-delivery-program`
- Current status: T-129 已完成 immutable-only 的 GitHub Actions -> ACR 发布链。`main` 自动构建并推送 `sha-<commit>` 镜像；`workflow_dispatch` + `prod` environment 审批只验证并批准既有 immutable image，并仅在显式提供 `release_tag` 时创建一次性 release tag。
- Next step: 进入维护期；T-130/T-131 直接消费 immutable `sha-<commit>` image ref。若后续要恢复私网 login server，需要单独处理 ACR VPC 额度或 runner 网络归位。

## Goal

把 GitHub Actions -> ACR 镜像发布链路定义并实施到可重复运行的程度，确保后续 ECS 与 ECI 只消费由 ACR 发布出来的同一镜像产物，并且镜像通过 immutable `sha-<commit>` 引用完成从 staging 候选到 prod 审批的无重建晋升。

## Non-goals

- 不在本任务中部署到 ECS 或 ECI。
- 不在本任务中创建独立 worker 镜像。
- 不在本任务中把运行时回滚语义落到宿主机或 container group。

## Outcome Snapshot

- `ci.yml` 已包含 `docker build validate`，但不触发 ACR 登录或部署。
- `publish-image.yml` 已拆分为 `push main` 自动发布与 `workflow_dispatch` 手动 prod promotion。
- ACR 发布契约已收敛为 immutable-only：`main` 只发布 `sha-<commit>`；prod promotion 默认不再创建 `prod/main/staging` mutable alias。
- GitHub 远端已接通 `staging` / `prod` environments、`main` branch protection、OIDC/RAM Role、repo variables、以及独立 `acr-publish` self-hosted runner。
- 当前落地运行的是 ACR 公网 login server + 白名单模式；这不阻塞 T-129 完成，但保留为后续网络优化项。

## Acceptance Criteria

- [x] 明确并实现 PR 与 `main` / manual promotion 的工作流边界。
- [x] 明确并实现 `image_ref` 模板、tag 规则与辅助 tag 用法。
- [x] 明确并实现同一镜像采用 build-once-promote-many，不为不同环境分别构建不同内容。
- [x] 明确并实现默认凭据策略为 `GitHub OIDC -> RAM Role -> ACR`。
- [x] 明确并实现 publish job 的 Runner 网络形态与 ACR ACL 假设。
- [x] 明确 GitHub Variables 清单、Environment 约束与“publish v1 无 repo secrets”边界。
- [x] 明确并实现本任务不触发任何 ECS/ECI 部署副作用。

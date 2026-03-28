# 00 Overview — github-actions-acr-image-publishing (T-129)

## Status

- State: planned
- Depends on: `T-128 aliyun-acr-ecs-eci-delivery-program`
- Next step: 冻结镜像发布契约、build-once-promote-many、Runner 网络形态、凭据方案和 GitHub 配置清单，然后再进入 workflow 实施。

## Goal

把 GitHub Actions -> ACR 镜像发布链路定义到可直接实施的程度，确保后续 ECS 与 ECI 只消费由 ACR 发布出来的同一镜像产物，并且镜像可以从 `staging` 无重建地晋升到 `prod`。

## Non-goals

- 不在本任务中部署到 ECS 或 ECI。
- 不在本任务中创建云侧仓库、配置 GitHub secret 或变更现有 workflow。
- 不在本任务中为 worker 构建独立镜像。

## Acceptance Criteria

- [ ] 明确 PR 与 `main` / release tag 的工作流边界。
- [ ] 明确 `image_ref` 模板、tag 规则与辅助 tag 用法。
- [ ] 明确同一镜像采用 build-once-promote-many，不为 `staging` / `prod` 分别构建不同内容。
- [ ] 明确默认凭据策略为 `GitHub OIDC -> RAM Role -> ACR`。
- [ ] 明确 publish job 的 Runner 网络形态与 ACR ACL 假设。
- [ ] 明确 GitHub Variables / Secrets 清单与作用范围。
- [ ] 明确本任务不触发任何 ECS/ECI 部署副作用。

# Roadmap — github-actions-acr-image-publishing (T-129)

## Summary

冻结从 GitHub Actions 自动构建并推送镜像到阿里云 ACR 的实施方案，明确工作流边界、镜像命名/tag、build-once-promote-many、Runner 网络形态、凭据策略和配置清单，并明确本任务不负责部署到 ECS/ECI。

## Milestones

1. 任务与治理建包：`[completed]`
2. ACR 镜像命名与 tag 规则冻结：`[pending]`
3. GitHub Actions 工作流边界冻结：`[pending]`
4. OIDC / Runner / ACR 登录方案冻结：`[pending]`
5. Variables / Secrets / build-time 配置 / 验收标准冻结：`[pending]`

## Risks

- 如果 CI 同时承担部署职责，会让运行时 side effect 难以审计。
- 如果 tag 规则不稳定，ECS/ECI 无法共享同一镜像引用。
- 如果 publish 仍依赖不稳定的外部 runner 出口和 ACR ACL，镜像 push 会成为链路瓶颈。
- 如果前端 build-time 配置被环境化，单镜像晋升策略会失效。

## Rollback

- 本任务只冻结文档和流程，不会创建真实镜像仓库、GitHub secret 或 workflow 变更。
- 后续实现如需回退，统一通过停用 `publish` job 或回切到上一个稳定 workflow 版本处理。

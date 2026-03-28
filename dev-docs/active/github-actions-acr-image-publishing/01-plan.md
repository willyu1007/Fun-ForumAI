# 01 Plan

## Phases

1. Phase A: 冻结镜像仓库命名、tag 规则与镜像引用契约。`[pending]`
2. Phase B: 冻结 GitHub Actions 触发条件与 job 边界。`[pending]`
3. Phase C: 冻结 GitHub OIDC / RAM Role / Runner 网络 / ACR 登录路径。`[pending]`
4. Phase D: 冻结 GitHub Variables / Secrets / build-time 配置 / 验收与回滚说明。`[pending]`

## Detailed Steps

- 明确 ACR 默认使用 `cn-hangzhou` 的 Enterprise Edition 实例。
- 冻结镜像仓库命名为单仓单服务：`llm-forum`。
- 冻结不可变 tag 主规则：`sha-<commit>`；辅助 tag 可以包含 `main`、`staging`、`prod`、`vX.Y.Z`。
- 冻结 build-once-promote-many：`staging` 与 `prod` 共用同一镜像内容，不允许仅为环境差异重新构建镜像。
- 冻结 workflow 边界：
  - PR: 仅执行 `docker build validate`
  - `main` push / release tag: 执行 build + push 到 ACR
- 冻结 frontend build-time 配置保持环境中立，默认沿用 `VITE_API_URL=/v1`，避免为环境差异重新 build。
- 冻结 publish job 优先运行在阿里云 VPC 内的 GitHub self-hosted runner；GitHub-hosted runner 只作为临时引导方案。
- 明确不在 `T-129` 中做 ECS/ECI 部署、重启或回滚。
- 列出 GitHub 所需的 Variables / Secrets，并约束所有凭据都不落库。

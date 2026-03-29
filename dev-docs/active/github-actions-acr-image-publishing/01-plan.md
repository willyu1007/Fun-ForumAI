# 01 Plan

## Phases

1. Phase A: 冻结镜像仓库命名、tag 规则与镜像引用契约。`[completed]`
2. Phase B: 冻结 GitHub Actions 触发条件与 job 边界，并落地 workflow。`[completed]`
3. Phase C: 冻结 GitHub OIDC / RAM Role / Runner 网络 / ACR 登录路径，并落地前置检查。`[completed]`
4. Phase D: 冻结 GitHub Variables / Environment / build-time 配置 / 验收与回滚说明。`[completed]`

## Detailed Steps

- 明确 ACR 默认使用 `cn-hangzhou` 的 Enterprise Edition 实例。
- 冻结 ACR 仓库名为 `app`，并与本地 packaging target `llm-forum` 解耦，避免因云侧既有仓库命名影响打包入口。
- 冻结不可变 tag 主规则：`sha-<commit>`；可选附加 tag 只允许一次性 immutable `vX.Y.Z`。
- 冻结 build-once-promote-many：`staging` 与 `prod` 共用同一镜像内容，不允许仅为环境差异重新构建镜像。
- 冻结 workflow 边界：
  - PR: 仅执行 `docker build validate`
  - `main` push: 执行 build + push 到 ACR，并只写入 `sha-<commit>`
  - `workflow_dispatch`: 审批既有 `sha-<commit>` 进入 `prod`，仅在显式传入 `vX.Y.Z` 时追加一次性 immutable release tag
- 冻结 frontend build-time 配置保持环境中立，默认沿用 `VITE_API_URL=/v1`，避免为环境差异重新 build。
- 冻结 publish job 优先运行在阿里云 VPC 内的 GitHub self-hosted runner；GitHub-hosted runner 只作为临时引导方案。
- 冻结 workflow 前置检查：
  - public repo 必须先通过 `main` branch protection guard
  - publish workflow 必须先验证 `acr-publish` self-hosted runner 在线
- 明确不在 `T-129` 中做 ECS/ECI 部署、重启或回滚。
- 列出 GitHub 所需的 Variables / Environments，并约束所有凭据都不落库。

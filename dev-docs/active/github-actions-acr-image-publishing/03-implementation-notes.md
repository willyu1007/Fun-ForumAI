# 03 Implementation Notes

## Status

- Current status: `workflow-implemented-awaiting-first-publish`
- Last updated: 2026-03-28

## What changed

- 在现有 `.github/workflows/ci.yml` 中新增 `Docker Build Validate` job，用真实 Docker build 覆盖 PR 与 `main` 的 packaging 校验。
- 新增 `.github/workflows/publish-image.yml`，把 `main` publish 与 `workflow_dispatch` promotion 从 CI 质量门禁中拆开。
- 新增三类 publish 辅助脚本：
  - `scripts/ci/check-branch-protection.mjs`
  - `scripts/ci/check-runner-availability.mjs`
  - `scripts/ci/publish-image-context.mjs`
- 新增 `ci/handbook/github-actions-acr-publish.md`，把 repo variables、environments、runner label、OIDC/ACR 登录边界写成长期手册。
- 修正 `ops/packaging/services/llm-forum.Dockerfile` 的 Prisma 安装时序：
  - builder stage 在 `pnpm install` 前先复制 `prisma/`
  - production stage 在 `pnpm install --prod` 前先复制 `prisma/`，并先安装全局 `prisma` / `tsx`
  - 目的：让根包 `postinstall -> prisma generate` 在 Docker build 中具备可运行前提
- 通过 GitHub API 创建了 `staging` 与 `prod` environments：
  - `staging`：protected branches only
  - `prod`：protected branches only + `willyu1007` required reviewer
- 通过 GitHub repo variables 预置并补齐了发布所需常量：
  - `ALICLOUD_REGION=cn-hangzhou`
  - `ACR_NAMESPACE=talkshow-ai`
  - `ACR_REPOSITORY=app`
  - `ACR_LOGIN_SERVER=talkshow-ai-acr-registry-vpc.cn-hangzhou.cr.aliyuncs.com`
  - `ACR_INSTANCE_ID=cri-ugivu28goberlerj`
  - `ACR_API_ENDPOINT=cr-vpc.cn-hangzhou.aliyuncs.com`
  - `ALICLOUD_OIDC_PROVIDER_ARN=acs:ram::1183869713036194:oidc-provider/github-actions`
  - `ALICLOUD_ROLE_ARN=acs:ram::1183869713036194:role/github-actions-acr-publish`
- 将变量边界收紧为“publish v1 无 repo secrets”；`ALICLOUD_OIDC_PROVIDER_ARN` 与 `ALICLOUD_ROLE_ARN` 作为 repo variables，而不是 secrets。
- 将 ACR 仓库名与本地 packaging target 解耦：workflow 继续构建 `llm-forum` target，但发布镜像统一推送到 ACR repository `app`。
- 在阿里云侧创建了 GitHub Actions 专用 OIDC Provider 与 RAM Role，并为 RAM Role 附加 `AliyunContainerRegistryFullAccess`，用于首版 publish 链路验证。
- 在独立杭州 ECS 上注册并启动了 `ecs-acr-publish-hz-01` self-hosted runner，标签固定为 `self-hosted, Linux, X64, aliyun-vpc, acr-publish`。

## Follow-ups

- 仍需执行首次真实 `main` publish，并确认 ACR 中 `sha-<commit>`、`main`、`staging` 指向同一 digest。
- 仍需执行一次 `workflow_dispatch` prod promotion，并确认 `prod` 与可选 release tag 只做 alias promotion、不 rebuild。
- 首次链路跑通后，建议把 RAM Role 从 `AliyunContainerRegistryFullAccess` 收紧到只覆盖 `GetAuthorizationToken` / `PullRepository` / `PushRepository` 的最小权限策略。
- 若实际 ACR 账号不是 Enterprise Edition，需要在后续实施阶段单独记录差异，但不改动主叙事。

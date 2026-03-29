# 03 Implementation Notes

## Status

- Current status: `immutable-only-update-pending-mainline-verification`
- Last updated: 2026-03-29

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
  - `ACR_LOGIN_SERVER=talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com`
  - `ACR_INSTANCE_ID=cri-ugivu28goberlerj`
  - `ACR_API_ENDPOINT=cr-vpc.cn-hangzhou.aliyuncs.com`
  - `ALICLOUD_OIDC_PROVIDER_ARN=acs:ram::1183869713036194:oidc-provider/github-actions`
  - `ALICLOUD_ROLE_ARN=acs:ram::1183869713036194:role/github-actions-acr-publish`
- 将变量边界收紧为“publish v1 无 repo secrets”；`ALICLOUD_OIDC_PROVIDER_ARN` 与 `ALICLOUD_ROLE_ARN` 作为 repo variables，而不是 secrets。
- 将 ACR 仓库名与本地 packaging target 解耦：workflow 继续构建 `llm-forum` target，但发布镜像统一推送到 ACR repository `app`。
- 在阿里云侧创建了 GitHub Actions 专用 OIDC Provider 与 RAM Role，并为 RAM Role 附加 `AliyunContainerRegistryFullAccess`，用于首版 publish 链路验证。
- 在独立杭州 ECS 上注册并启动了 `ecs-acr-publish-hz-01` self-hosted runner，标签固定为 `self-hosted, Linux, X64, aliyun-vpc, acr-publish`。
- 将 publish workflow 中重复的 ACR 登录逻辑收敛为共享脚本 `scripts/ci/acr-login.mjs`，避免 publish / promote 两个 job 复制同一段易碎的 `aliyun` / `docker login` 解析逻辑。
- 将 publish staging job 从单一 `Build and push image tags` 步骤拆成：
  - `Build staging image locally`
  - `Push immutable sha image`
  - `Push mutable channel tags`
  - `Resolve published digest`
  - 目的：降低 runner 异常中断时的诊断成本，并把成功/失败定位到 build、sha push、channel push 或 digest 校验的具体阶段。
- 将 `actions/checkout` / `actions/setup-node` 从 `@v4` 升级到 `@v6`，以消除 GitHub 对 Node 20 JavaScript actions runtime 的官方弃用告警。
- 将 runner labels API 检查改为大小写无关比较，避免未来在管理员 token / 本地诊断场景下把 GitHub 内置 `Linux` / `X64` labels 误判为不匹配。
- 首次真实 publish 验证过程中，由于 ACR `VPC 绑定额度=1/1` 已被业务 ECS 占用，最终将 `ACR_LOGIN_SERVER` 切到公网域名并配合 ACR Internet 白名单完成 v1 运营落地。
- `main` push 已实跑成功，产物为：
  - `sha-9ce82d6354eba58cc6ae88183830693552266434`
  - digest: `sha256:e37df9a430c8bbc25cc2ea31b9cdc9279a09975188e682cb38993601b3fc710e`
- `workflow_dispatch` prod promotion 已实跑成功：
  - source sha: `9ce82d6354eba58cc6ae88183830693552266434`
  - digest 与首次 publish 的 immutable sha digest 一致，无 rebuild
- 在 action runtime 升级后重新触发 `main` publish 时，暴露出云侧真实约束：
  - ACR repository `app` 当前 `TagImmutability=true`
  - 第二次及之后的 `main` / `staging` alias push 会被 ACR 拒绝覆盖
  - 实际报错：`unknown: The requested tag already exists and cannot be overwritten.`
- 对照 T-130/T-128 已冻结的运行时契约后，T-129 收敛为 immutable-only：
  - `main` publish 只推送 `sha-<commit>`
  - `workflow_dispatch` prod promotion 默认只审批既有 immutable image
  - 仅在显式提供 `release_tag` 时创建一次性 immutable `vX.Y.Z`
  - `main` / `staging` / `prod` mutable alias 已从 workflow 和上下文脚本中删除
  - `scripts/ci/check-acr-tag-mutability.mjs` 随之删除，不再用“fail fast + 继续保留 alias”这种过渡方案维持契约

## Follow-ups

- 将 immutable-only 版本合入默认分支后，必须重新执行一次 `main` publish 与一次 `workflow_dispatch` prod approval，确认新的无 alias 模式可重复运行，然后把 T-129 标记为 done。
- 首次链路跑通后，建议把 RAM Role 从 `AliyunContainerRegistryFullAccess` 收紧到只覆盖 `GetAuthorizationToken` / `PullRepository` / `PushRepository` 的最小权限策略。
- 如需恢复 ACR 私网 login server，需先解决 ACR `VPC 绑定额度=1/1` 与 runner 所在 VPC 不一致的问题；该项不阻塞首次验收，但属于后续云侧优化。

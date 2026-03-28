# 02 Architecture

## Artifact contract

- 镜像引用契约：
  - `image_ref = <acr-login-server>/<namespace>/app:<tag>`
- 登录服务名使用 ACR 实例对应 login server，不在文档中写死账号或实例名。
- 镜像仓库默认采用单服务单仓，不为 web/worker 拆仓。

## Promotion policy

- 本任务冻结为 build-once-promote-many：
  - 同一镜像内容在 CI 中构建一次
  - 先进入 `staging`
  - 验证通过后再晋升到 `prod`
- 不为 `staging` 和 `prod` 分别重新 build。
- 前端 build-time 配置必须保持环境中立；默认采用 `VITE_API_URL=/v1`，确保镜像可跨环境复用。

## Workflow boundary

- Pull Request:
  - 运行现有质量门禁
  - 增加真实 `docker build validate`
  - 不 push 镜像
  - 不部署
- `main` push:
  - 构建镜像
  - 推送 `sha-<commit>`、`main`、`staging` 到 ACR
  - 不触发 ECS/ECI 运行时动作
- `workflow_dispatch`:
  - 拉取既有 `sha-<commit>` 镜像
  - 推送 `prod` 与可选 `vX.Y.Z` 到 ACR
  - 不 rebuild
  - 不触发 ECS/ECI 运行时动作

## Runner and network path

- publish job 的默认落地目标是运行在阿里云 VPC 内的 GitHub self-hosted runner。
- self-hosted runner 固定使用标签：`self-hosted,linux,x64,aliyun-vpc,acr-publish`。
- workflow 会先在 GitHub-hosted preflight job 中检查：
  - public repo 的 `main` 是否 branch-protected
  - 是否存在匹配标签的在线 runner
- 这样可以避免 ACR Enterprise Edition 的 Internet ACL 与 GitHub-hosted runner egress IP 漂移带来的不稳定性。
- GitHub-hosted runner 仅作为 bootstrap/临时降级方案；若采用该方案，必须单独处理 ACR Internet ACL。

## Credential strategy

- 默认凭据路径：`GitHub OIDC -> Alibaba Cloud RAM Role -> ACR login`
- ACR 登录通过 `aliyun cr GetAuthorizationToken` 获取临时用户名/密码，再执行 `docker login`。
- CI push 凭据与运行时 pull 凭据必须分离。
- 仅在 OIDC 当前不可落地时，才把短期 `AK/SK` 作为临时降级方案，并要求后续单独清理。

## Variables and secrets

文档中冻结以下配置项名称；实现中通过 repo variables 与 GitHub environments 消费它们：

- Variables:
  - `ALICLOUD_REGION=cn-hangzhou`
  - `ACR_NAMESPACE`
  - `ACR_REPOSITORY=app`
  - `ACR_LOGIN_SERVER`
  - `ACR_INSTANCE_ID`
  - `ACR_API_ENDPOINT`
  - `ALICLOUD_OIDC_PROVIDER_ARN`
  - `ALICLOUD_ROLE_ARN`
- Environments:
  - `staging`
  - `prod`
- Secrets:
  - publish v1 默认无需 repo-level secrets

## Risks

- ACR login server、namespace 与 repository 如果没有统一命名，后续 ECS/ECI 文档会引用不同镜像地址。
- 本仓库当前保留 packaging target `llm-forum` 与 Dockerfile 文件名，但发布到 ACR 时统一落到既有仓库 `app`。
- 如果 publish 仍依赖 GitHub-hosted runner，但没有稳定 ACL 方案，ACR push 会成为不稳定点。
- 如果没有 preflight runner 检查，self-hosted publish job 会在没有 runner 时无限排队而不是快速失败。
- 如果 public repo 没有 branch protection guard，新增 publish workflow 会把云侧身份暴露给未受保护的默认分支。
- 如果 build-time 前端配置被环境化，单镜像晋升策略会失效。
- 如果 `latest` 被当成唯一部署依据，回滚与问题定位都会变慢。

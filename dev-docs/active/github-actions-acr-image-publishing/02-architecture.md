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
- `staging` / `prod` 状态由 GitHub Environments 审批记录与后续 T-130/T-131 的部署记录表达，而不是依赖可移动 channel tags。
- 前端 build-time 配置必须保持环境中立；默认采用 `VITE_API_URL=/v1`，确保镜像可跨环境复用。

## Workflow boundary

- Pull Request:
  - 运行现有质量门禁
  - 增加真实 `docker build validate`
  - 不 push 镜像
  - 不部署
- `main` push:
  - 构建镜像
  - 只推送 `sha-<commit>` 到 ACR
  - 不触发 ECS/ECI 运行时动作
- `workflow_dispatch`:
  - 校验既有 `sha-<commit>` 镜像可用于 prod
  - 仅在显式传入 `release_tag` 时创建一次性 immutable `vX.Y.Z`
  - 默认不写入 `prod` 等 mutable alias
  - 不触发 ECS/ECI 运行时动作

## Runner and network path

- publish job 的默认落地目标是运行在阿里云 VPC 内的 GitHub self-hosted runner。
- self-hosted runner 固定使用标签：`self-hosted,linux,x64,aliyun-vpc,acr-publish`。
- workflow 会先在 GitHub-hosted preflight job 中检查：
  - public repo 的 `main` 是否 branch-protected
  - 是否存在匹配标签的在线 runner
- publish v1 的实际运行形态为：self-hosted runner 仍部署在阿里云 VPC 内，但由于 ACR 当前 `VPC 绑定额度=1/1` 且已被业务 ECS 占用，镜像 login server 暂时采用公网域名 + ACR Internet 白名单。
- GitHub-hosted runner 仅作为 preflight/质量门禁执行面；真实 publish 仍固定在 self-hosted runner 上，不依赖 GitHub-hosted runner 访问 ACR。

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
- 如果 ACR 私网绑定额度不足，必须明确记录“公网 login server + 白名单”是临时运营落地，而不是默认误差状态。
- 如果没有 preflight runner 检查，self-hosted publish job 会在没有 runner 时无限排队而不是快速失败。
- 如果 public repo 没有 branch protection guard，新增 publish workflow 会把云侧身份暴露给未受保护的默认分支。
- 如果 build-time 前端配置被环境化，单镜像晋升策略会失效。
- 如果 `latest` 被当成唯一部署依据，回滚与问题定位都会变慢。
- 如果重新引入 `main` / `staging` / `prod` 这类 mutable alias，而目标 ACR repository 仍保持 immutable tag 策略，交付链会再次回到不可持续状态。

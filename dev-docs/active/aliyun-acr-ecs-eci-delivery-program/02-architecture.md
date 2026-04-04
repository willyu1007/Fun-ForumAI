# 02 Architecture

## Target Delivery Chain

本任务冻结的目标链路为：

`GitHub Actions -> ACR -> ECS(web, RUNTIME_ENABLED=false) + ECI(worker, RUNTIME_ENABLED=true)`

当前实际推进状态：

- GitHub Actions 已承担 build/publish 到 ACR。
- web ECS 已在与 ACR 同一专属网络的形态上消费镜像。
- worker ECI 仍处于 contract / render / apply 已具备、但尚未正式上线的阶段。
- staging API 仍依赖 env-file 注入；当前 operator 现实做法是先生成 `staging.env` 再落到 ECS host。短期允许把这条链路作为 staging bootstrap 例外保留，但长期目标执行面仍应收口到 deploy workspace 上的 `env-localctl compile + env-cloudctl apply`，而不是继续依赖手工上传文件。

核心原则：

- ACR 是唯一镜像源。
- ECS 与 ECI 复用同一服务镜像，不单独构建 worker 镜像。
- ECS 只承接 web/API/SSE；ECI 只承接 worker/runtime。
- 当前范围只覆盖 `staging` 与 `prod`，不为云上 `dev` 单独设计。

## Frozen Decisions

### Region and platform

- 阿里云主区域固定为 `cn-hangzhou`。
- ACR 方案默认按 `ACR Enterprise Edition` 设计。
- 不将 ACK 纳入本任务边界。

### Image contract

- 镜像引用契约冻结为：
  - `image_ref = <acr-login-server>/<namespace>/app:<tag>`
- 不可变 tag 以 `sha-<commit>` 为主。
- `main`、`staging`、`prod` 这类 mutable alias 不再作为交付契约的一部分。
- 语义版本 tag 仅允许作为一次性 immutable release tag 使用，不作为唯一回滚依据。
- 同一镜像必须先进入 `staging`，验证通过后再晋升到 `prod`，不允许为 `prod` 重新构建不同内容的镜像。
- 在 `T-129` 解决 ACR `TagImmutability=true` 之前，`T-130/T-131` 的运行时消费统一只接受 `sha-<commit>` 或显式 immutable `image_ref`，不接受 mutable alias 作为部署输入。

### Runtime roles

- ECS web: `RUNTIME_ENABLED=false`
- ECI worker: `RUNTIME_ENABLED=true`

### Release sequence

全链路发布顺序冻结为：

1. GitHub Actions 产出并推送 `sha-<commit>` 镜像到 ACR。
2. 运维侧准备目标环境配置，并校验其与 `env/contract.yaml` 对齐。
3. 发布人手动触发该环境的部署动作；第一阶段不由 GitHub Actions 直接部署到 ECS/ECI。
4. 在 operator-owned deploy workspace 上完成 `api -> envfile` compile/apply，并在同一 boundary 上完成 `worker -> aliyun-eci-container-group` apply。
5. 对目标环境执行一次 `pnpm db:migrate:deploy`。
6. 先部署 ECS web，并以 `/health` 与应用 smoke 验证其可用。
7. 验证 ECS/ECI 出方向网络，确认通过 NAT 或等效 egress 至少能连通一个 admitted provider 并取得真实响应。
8. 再部署 ECI worker，并验证容器健康、启动日志与 runtime 侧证据。
9. `staging` 全部通过后，才能人工晋升到 `prod`。

### Multi-instance web contract

- `prod` 只要存在 2 台及以上 ECS web，就必须把 `SSE_BROADCAST_BACKEND` 切为 `redis`。
- `SSE_REDIS_URL` 必须可用；若缺失，不能以“本地广播先跑起来”为由进入多机 `prod`。
- ALB 与 Caddy 必须都支持长连接和流式转发，不能把默认短超时配置直接带入 SSE 生产流量。

### Rollback precondition

- “回切上一可用镜像 tag”只等价于应用层回滚，不等价于数据库 schema 回滚。
- 如果本次发布包含 Prisma migration，则该 migration 必须满足至少一个版本窗口的向后兼容，确保旧镜像仍能在新 schema 下运行。
- 如果迁移无法满足向后兼容，发布包必须显式附带数据库回退或数据修复方案，不能仅声明“回滚镜像”。

### Configuration authority

- GitHub Variables / Secrets 只服务于 CI build/publish。
- 运行时配置必须来自 repo 的 `env/contract.yaml` / `env/secrets/*.ref.yaml` 所定义契约，但真实值保存在仓库外。
- ECS 使用宿主机上的 `.env` 文件承载运行时值。
- ECI 使用 container group 环境变量或对应的 registry/secret 配置承载运行时值。
- staging/prod 的 provider/model/base_url 选择权不再来自 env；云上正常路径只能消费 registry/policy 决策。
- `env-cloudctl apply` 不要求 ECS 暴露公网入口；当前 contract 假设 apply 在能够写入宿主机目标文件的 deploy workspace 上执行。
- ECS/ECI 是否需要公网出方向取决于 provider 访问路径；在当前形态下，web/worker 只要通过 NAT 或等效出口可以访问 admitted provider 即可，不要求实例本身具备公网入方向。

### Deploy workspace and STS boundary

- GitHub Actions 取代了原先“打包用 ECS”的职责，但没有承接运行时 secret compile/apply 职责。
- 因此 `staging/prod` 仍需要一条 operator-owned deploy workspace：
  - 具备 STS role chain；
  - 具备 `bws` CLI 与 `BWS_ACCESS_TOKEN`；
  - 能执行 `env-localctl compile` 与 `env-cloudctl apply`；
  - 对 API env-file target 与 worker apply target 具备相应写入权限。
- 若缺少该 deploy workspace，`policy.env.cloud.auth_mode=role-only` 的 compile 预检会失败，不能把普通开发机或 GitHub build runner 视作等价替代。
- staging-only bootstrap 例外：
  - 在正式 deploy workspace 尚未落位前，允许 operator 在本机完成 `api` 的 Bitwarden compile，并手工把 `.env` 导入 ECS。
  - 该例外不改变 policy authority，也不允许恢复 env-level model pins。
  - `worker` 仍必须走 container-group template 渲染 / apply，不能改成手工 `.env`。
  - `prod` 不得复用该例外。

### Bootstrap prerequisites

后续实施前必须先具备：

- `cn-hangzhou` 的 ACR Enterprise Edition 实例、namespace、repository。
- 目标环境可用的 PostgreSQL 与 Redis。
- `staging` / `prod` 的 ECS 宿主机与安全组。
- `staging` / `prod` 的 ECI container group 模板或等效配置基线。

## Task Decomposition

- `T-129` 只负责产出镜像，不负责部署。
- `T-130` 负责 ECS web 如何消费镜像、如何重启、如何回滚。
- `T-131` 保留为 ECI worker repo 侧交付基线，不再扩成云环境总包。
- `T-935` 负责云环境全链路、IaC skeleton、workload-aware env injection 与 go-live runbook。
- `T-901` 负责 execution-plan / provider-runtime contract 主线。
- `T-936` 负责 runtime cutover、observability 与 staging live close-out。
- `T-128` 只做全链路编排、依赖顺序、验收与交接，不再承载实现细节。

## Primary Risks

- 如果 `T-129` 同时尝试触发部署，交付边界会和 `T-130/T-131` 交叉，难以审计。
- 如果 ECS 与 ECI 使用不同 tag 习惯，后续 staging/prod 问题无法快速定位到同一产物。
- 如果数据库迁移时序未被冻结，web 与 worker 可能在 schema 不一致时滚动上线。
- 如果数据库迁移不满足向后兼容，单纯回切旧镜像 tag 无法构成完整回滚。
- 如果 CI 配置、运行时配置与 ACR pull 认证混在一起，后续密钥轮换会非常混乱。
- 如果继续依赖“手工上传 `staging.env`”而不冻结 deploy workspace/STS/BWS ownership，`api -> envfile` 会再次退回不可审计的人肉控制面。
- 如果只验证 ACR 拉取成功，而不验证 ECS/ECI 经 NAT 的 provider 连通性，secret 注入完成后仍可能在真实模型调用时失败。
- 如果 prod 多 ECS 没有显式 SSE Redis 广播与长连接入口约束，普通接口看似正常时实时链路也会失败。
- 如果不先冻结多项目 ECS 宿主机形态，后续第二个项目接入时会直接碰到端口、域名和运维脚本冲突。

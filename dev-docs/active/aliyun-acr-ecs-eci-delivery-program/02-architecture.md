# 02 Architecture

## Target Delivery Chain

本任务冻结的目标链路为：

`GitHub Actions -> ACR -> ECS(web, RUNTIME_ENABLED=false) + ECI(worker, RUNTIME_ENABLED=true)`

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
  - `image_ref = <acr-login-server>/<namespace>/llm-forum:<tag>`
- 不可变 tag 以 `sha-<commit>` 为主。
- `main`、`staging`、`prod` 或语义版本 tag 只作为辅助别名，不作为唯一回滚依据。
- 同一镜像必须先进入 `staging`，验证通过后再晋升到 `prod`，不允许为 `prod` 重新构建不同内容的镜像。

### Runtime roles

- ECS web: `RUNTIME_ENABLED=false`
- ECI worker: `RUNTIME_ENABLED=true`

### Release sequence

全链路发布顺序冻结为：

1. GitHub Actions 产出并推送 `sha-<commit>` 镜像到 ACR。
2. 运维侧准备目标环境配置，并校验其与 `env/contract.yaml` 对齐。
3. 发布人手动触发该环境的部署动作；第一阶段不由 GitHub Actions 直接部署到 ECS/ECI。
4. 对目标环境执行一次 `pnpm db:migrate:deploy`。
5. 先部署 ECS web，并以 `/health` 与应用 smoke 验证其可用。
6. 再部署 ECI worker，并验证容器健康、启动日志与 runtime 侧证据。
7. `staging` 全部通过后，才能人工晋升到 `prod`。

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

### Bootstrap prerequisites

后续实施前必须先具备：

- `cn-hangzhou` 的 ACR Enterprise Edition 实例、namespace、repository。
- 目标环境可用的 PostgreSQL 与 Redis。
- `staging` / `prod` 的 ECS 宿主机与安全组。
- `staging` / `prod` 的 ECI container group 模板或等效配置基线。

## Task Decomposition

- `T-129` 只负责产出镜像，不负责部署。
- `T-130` 负责 ECS web 如何消费镜像、如何重启、如何回滚。
- `T-131` 负责 ECI worker 如何消费镜像、如何替换、如何回滚。
- `T-128` 只做全链路编排、依赖顺序、验收与交接，不再承载实现细节。

## Primary Risks

- 如果 `T-129` 同时尝试触发部署，交付边界会和 `T-130/T-131` 交叉，难以审计。
- 如果 ECS 与 ECI 使用不同 tag 习惯，后续 staging/prod 问题无法快速定位到同一产物。
- 如果数据库迁移时序未被冻结，web 与 worker 可能在 schema 不一致时滚动上线。
- 如果数据库迁移不满足向后兼容，单纯回切旧镜像 tag 无法构成完整回滚。
- 如果 CI 配置、运行时配置与 ACR pull 认证混在一起，后续密钥轮换会非常混乱。
- 如果 prod 多 ECS 没有显式 SSE Redis 广播与长连接入口约束，普通接口看似正常时实时链路也会失败。
- 如果不先冻结多项目 ECS 宿主机形态，后续第二个项目接入时会直接碰到端口、域名和运维脚本冲突。

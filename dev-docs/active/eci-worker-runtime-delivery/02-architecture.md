# 02 Architecture

## Role contract

- ECI 只承接 worker/runtime。
- worker 与 ECS web 共用同一镜像引用。
- worker 角色固定为：
  - `RUNTIME_ENABLED=true`

## Release model

- ECI 以 container group 为交付单元。
- 每次升级都基于新的镜像 tag 重建或替换 container group。
- 不在运行中的实例上做原地容器替换。
- ECI worker 的部署发生在目标环境数据库迁移完成、ECS web 验证通过之后。
- 第一阶段发布由运维或发布人手动替换 container group，不由 GitHub Actions 直接部署到 ECI。

## Runtime image pull and config

- ECI 优先使用 ACR Enterprise Edition 的 `AcrRegistryInfo` 拉取私有镜像。
- 如果当前环境暂时不能使用 `AcrRegistryInfo`，则退回 `ImageRegistryCredential`。
- ECI 的运行时环境变量仍然受 `env/contract.yaml` 约束，但真实值通过 container group 配置注入。
- GitHub secrets 不作为 ECI 运行时配置源。

## Dependency matrix

worker 启动前必须具备以下依赖：

- PostgreSQL:
  - `DATABASE_URL`
  - `DB_PERSISTENCE=true`
- Redis / runtime coordination:
  - `RUNTIME_QUEUE_BACKEND=redis`
  - `RUNTIME_LEADER_BACKEND=redis`
  - `RUNTIME_REDIS_URL` 或统一 `REDIS_URL`
- LLM:
  - `LLM_PROVIDER`
  - `LLM_BASE_URL`
  - provider credential

worker 不要求：

- 公网域名
- HTTP 入口
- TLS 终止
- 共享反向代理

## Health and verification

- worker 虽不暴露公网入口，但仍保留容器内 `:4000/health` 作为健康探针目标。
- 发布后至少验证：
  - 容器健康探针通过
  - 启动日志出现 `RUNTIME_ENABLED=true` 的后台服务启动信息
  - Redis 侧出现符合前缀约定的 runtime/leader 痕迹或等效运行证据

## Scaling and rollback

- `staging` 默认单 worker group，人工触发更新。
- `prod` 默认至少一个长期 worker group，扩缩容以复制同模板 container group 为主。
- 回滚动作统一为：
  - 选择上一可用镜像 tag
  - 以旧 tag 重建 container group
  - 观察 runtime 与队列健康
- 上述回滚动作的前提是当前数据库 schema 仍兼容上一版本镜像；如果本次 migration 不兼容，必须附带单独的 DB 回退/修复方案。

## Risks

- 若 `RUNTIME_ENABLED` 未正确注入，worker 会退化为只启动 web 服务而不跑后台任务。
- 若 ACR pull 认证路径没有在实施前定下来，worker 可能在重建时直接卡在拉镜像阶段。
- 若 Redis 与 DB 依赖没有在发布前校验，worker 可能“启动成功但不工作”。

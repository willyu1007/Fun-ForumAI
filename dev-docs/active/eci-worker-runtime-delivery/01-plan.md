# 01 Plan

## Phases

1. Phase A: 冻结 worker 角色契约与镜像复用边界。`[pending]`
2. Phase B: 冻结 ECI 发布、pull 认证与回滚模型。`[pending]`
3. Phase C: 冻结最小环境变量矩阵与依赖边界。`[pending]`
4. Phase D: 冻结扩缩容、健康探针与失败处理原则。`[pending]`

## Detailed Steps

- 定义 worker 消费与 ECS web 相同的 `sha-<commit>` 镜像 tag。
- 定义 worker 统一开启 `RUNTIME_ENABLED=true`，并明确其不暴露 web/API 入口。
- 定义 worker 依赖 ECS web 已完成数据库迁移与目标环境配置校验后再发布。
- 定义 ECI 更新方式为：
  - 新镜像 tag 生成新的 container group 配置
  - 旧 container group 替换或销毁
  - 不做实例内原地改容器
- 定义 ECI 优先使用 ACR Enterprise Edition 的 `AcrRegistryInfo` 进行免 secret 拉镜像；如当前环境不支持，则退回 `ImageRegistryCredential`。
- 定义最小环境变量矩阵至少覆盖：
  - `DATABASE_URL`
  - `DB_PERSISTENCE=true`
  - `RUNTIME_ENABLED=true`
  - `RUNTIME_QUEUE_BACKEND`
  - `RUNTIME_LEADER_BACKEND`
  - `RUNTIME_REDIS_URL` 或统一 `REDIS_URL`
  - `LLM_PROVIDER`
  - `LLM_BASE_URL`
  - 运行所需 LLM credential
- 定义 worker 不需要公网入口，不承接 CORS、域名和 HTTPS 配置，但保留容器内 `:4000/health` 作为健康探针目标。

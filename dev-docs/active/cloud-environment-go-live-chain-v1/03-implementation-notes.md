# 03 Implementation Notes

## 2026-04-03

- 创建 `T-935` 任务包，承接超出旧 `T-128/T-131` 边界的云环境全链路工作。
- 将 `policy.env.cloud.targets` 拆成 `api` 与 `worker` 两类 workload route：
  - `api -> envfile`
  - `worker -> aliyun-eci-container-group`
- 在 `env-cloudctl` 中新增 `aliyun-eci-container-group` adapter 骨架，用于渲染 ECI worker redacted manifest 并记录 provider-specific state。
- 扩充 `ops/deploy/workloads/eci-worker/` 的 secret 注入矩阵，使其不再只覆盖 DashScope。
- 开始建立 `ops/iac/terraform/` 的模块 skeleton 与 go-live runbook 基线。
- 修正 `docs/project/policy.yaml` 的 IaC / cloud target drift：明确 `tool=terraform`、`cloud_scope=aliyun-only`，并补上 `api/worker` workload route。
- 对照需求文档补充了本包的 review 重点：
  - staging/prod 只注入 API 能力，不再把业务模型选择 env 带入 cloud target
  - 在移交 `T-936` 前必须完成 admitted providers secret coverage 与 workload route 的一致性复核

## 2026-04-03 (closeout implementation)

- 将 `docs/project/policy.yaml` 切到 `policy.env.cloud.require_target=true`，冻结 `staging|prod x api|worker` policy-only 路由。
- 从 repo env contract、runtime bootstrap、config allow-list、worker docs、k8s retained docs 中移除了 `LLM_PROVIDER / LLM_MODEL / LLM_BASE_URL`。
- 将 `LlmClient` 构造合同收窄为“仅保留数值默认项，provider/model/base_url 由请求携带”，并把管理面/启动日志改为 `routing_mode=policy_driven`。
- 为 staging 补齐 admitted provider 的 `_SECONDARY` secret refs，并把 worker env matrix / container-group 模板扩展到 primary+secondary parity。
- 新增 `ops/iac/terraform/stacks/staging|prod` 的 wiring skeleton、backend.hcl example、tfvars example 与 handoff output。
- 更新 go-live / deployment / ECS+ECI runbook，使其统一收口到 `compile env -> inject api envfile -> migrate -> ECS web -> ECI worker -> staging live gate`。
- 深度 cleanup 进一步收口了三类双轨/漂移：
  - 把 cloud/local redacted context 产物改成 workload-aware 命名（`effective-cloud-<env>-<workload>.json`、`effective-<env>-<workload>.json`），并删除旧的 env-only cloud context 文件，避免同名文件混入 `api`/`worker` 两种语义。
  - 移除 `env/values/staging.yaml` 里的共享 `RUNTIME_ENABLED=true`，把 `RUNTIME_ENABLED` authority 收口到 `compose.yaml`（api=false）和 worker role contract（worker=true）。
  - 发现 `DB_PERSISTENCE` 仍然只允许 `staging` scope，导致 `prod` cloud baseline 无法在 contract 内表达；现已扩到 `staging,prod`，并补齐 `env/values/prod.yaml` 的 production/redis/s3 baseline。
- 对生成产物做了 repo-side 清理：
  - 删除旧的 `docs/context/env/effective-cloud-staging.json`
  - 删除旧的 `docs/context/env/effective-cloud-prod.json`
  - 删除临时 `.ai/.tmp/env-cloud/manual-staging-worker-plan.md`
- 文档层同步去除了本轮范围内的机器私有绝对路径引用，避免 handoff 后链接语义漂移。

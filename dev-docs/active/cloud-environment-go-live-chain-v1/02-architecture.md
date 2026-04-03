# 02 Architecture

## Boundaries

- secret authority 统一为 deploy-time compile / resolve；runtime 只读取 env，不直连 Bitwarden。
- ECS web 继续使用 env-file 注入；ECI worker 使用 container-group replacement 时的 secret/env 注入。
- Terraform skeleton 只定义模块接口与状态边界；真实 apply 仍由 operator/CI 控制。
- staging/prod 的 env contract 只注入 API 能力、endpoint 与 secret authority，不注入业务级模型选择；云上不存在 `LLM_PROVIDER / LLM_MODEL / LLM_BASE_URL` 回退控制面。

## Key Decisions

- cloud target selection 通过 `policy.env.cloud.targets` 绑定 `runtime_target + workload`，不再只靠单个 inventory 文件覆盖全部角色。
- `policy.env.cloud.require_target=true` 后，`staging|prod x api|worker` 都必须命中显式 target；inventory fallback 只保留历史参考语义。
- `aliyun-eci-container-group` adapter 的职责是“渲染、验证、记录 redacted manifest”，不是自动创建真实 ECI 资源。
- `ops/deploy/workloads/eci-worker/env-matrix.yaml` 作为 worker role 的 env contract mirror，必须覆盖 admitted LLM provider secret surface。
- public ingress 的目标叙事是 `ALB -> Caddy -> ECS web`；ECI worker 不承接公网入口。
- ICP 属于 go-live readiness gate，不属于 IaC 自动化 apply 范围。
- 紧急 routing 调整只能通过 registry/policy 或 provider admission/secret change + redeploy 进入正常链路，不能回落到 env pin。

## Interfaces

- `policy.env.cloud.targets[].set.container_group`
  - `template`
  - `rendered_output`
  - `env_matrix`
  - `role_contract`
  - `workload_id`
- `ops/iac/terraform/modules/*`
  - 每个模块至少包含 `README.md`、`variables.tf`、`outputs.tf`
- `ops/deploy/handbook/runbooks/cloud-go-live-chain.md`
  - 明确资源 readiness、发布顺序、验收与回退边界
- review output
  - 明确 `api/worker` 两个 workload 的 injected secret surface、operator handoff 边界和 policy-only routing contract

## Risks

- cloud target contract 与实际 operator 操作不一致时，repo 会出现“文档支持、真实环境不支持”的假闭环。
- ECI worker 若仍只注入单 provider key，会导致 runtime registry 和 cloud delivery contract 再次漂移。
- IaC skeleton 若不明确 state / ownership 边界，后续 Terraform 落地时会与手工运维资产冲突。

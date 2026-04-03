# 00 Overview — cloud-environment-go-live-chain-v1 (T-935)

## Status

- State: in-progress
- Governance mapping: 保持挂在 `F-000 Inbox / Untriaged`，作为跨包云交付依赖；不直接映射到 `R-027`。
- Depends on: `T-128 aliyun-acr-ecs-eci-delivery-program`, `T-130 ecs-compose-web-delivery`
- Current status: `T-935` 代码层 closeout 已闭环：`policy.env.cloud.require_target=true` 已冻结 policy-only cloud routing；`api -> envfile`、`worker -> aliyun-eci-container-group` 已收口为唯一正常路径；worker secret surface、prod cloud baseline、Terraform stack wiring、workload-aware context artifacts 和 runbook 顺序已对齐。
- Next step: 将 frozen cloud contract handoff 给 `T-936`，由其承接 staging live gate、rollback/promote prerequisite 与业务 cutover 验收。

## Goal

把 staging/prod 的云上线链路补齐到“可由 operator 按 runbook 执行、可由后续 Terraform skeleton 接管边界、且与 runtime/env contract 一致”的状态，覆盖：

- ECS web / ECI worker 双角色发布链
- ALB、RDS PostgreSQL、Redis/Tair、对象存储、域名、DNS、SSL、ALB HTTPS、ICP readiness
- deploy-time secret injection + runtime env-only 边界
- IaC skeleton 的模块切分、输入输出、state 边界和交接接口

## Non-goals

- 本包不直接创建真实云资源，也不执行 Terraform apply。
- 本包不承接 runtime execution plan / provider fallback 的业务逻辑重构。
- 本包不改写历史 `T-131` 的归档语义。

## Acceptance Criteria

- `docs/project/policy.yaml` 能按 workload 区分 `api -> envfile`、`worker -> aliyun-eci-container-group`，且 `require_target=true`。
- `env-cloudctl` 能对 `aliyun-eci-container-group` 执行 plan/apply/verify，并产出 redacted rendered manifest。
- `ops/deploy/workloads/eci-worker/env-matrix.yaml` 与 container-group 模板覆盖 staging/prod 的多 provider primary+secondary runtime secret surface。
- `ops/iac/terraform/` 下存在 `network / entry_https / compute_ecs_web / compute_eci_worker / data_postgres / data_redis / storage_media / dns_cert` 八个模块 skeleton。
- `ops/iac/terraform/stacks/staging` 与 `ops/iac/terraform/stacks/prod` 存在 stack wiring skeleton、backend/state example 与 handoff 边界。
- `ops/deploy/handbook/runbooks/` 中存在 staging/prod go-live chain runbook，明确 ALB、DNS、SSL、ICP 与应用发布顺序，并明确云上不允许 env-level model pins。

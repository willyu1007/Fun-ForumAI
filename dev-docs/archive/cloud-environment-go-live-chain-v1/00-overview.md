# 00 Overview — cloud-environment-go-live-chain-v1 (T-935)

## Status

- State: done
- Governance mapping: 保持挂在 `F-000 Inbox / Untriaged`，作为跨包云交付依赖；不直接映射到 `R-027`。
- Depends on: `T-128 aliyun-acr-ecs-eci-delivery-program`, `T-130 ecs-compose-web-delivery`
- Current status: `T-935` 代码层 closeout 已闭环：`policy.env.cloud.require_target=true` 已冻结 policy-only cloud routing；`api -> envfile`、`worker -> aliyun-eci-container-group` 已收口为唯一正常路径；worker secret surface、prod cloud baseline、Terraform stack wiring、workload-aware context artifacts 和 runbook 顺序已对齐。根据 2026-04-10 的 operator/user 确认，staging 真实 SMTP 已打通，staging 主流程也已完成验证，因此此前 staging-only bootstrap 例外对应的首轮发布目标视为已完成。当前剩余责任收敛为正式 deploy workspace 与后续 prod/go-live 交接，而非 staging 首发阻塞。
- Outcome: 按当前收口边界，本包以云环境 contract、staging 首轮发布目标和相关验证证据完成为准直接归档；后续若继续进行正式 deploy workspace、prod promote/backout 或 operator handoff，视为归档后的运营延续事项，不再阻塞本任务。

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

## Temporary Staging Override (2026-04-07)

- The active staging worker path is temporarily changed from `worker -> aliyun-eci-container-group` to `worker -> same-host Docker Compose service on ECS`.
- `api -> envfile` remains unchanged.
- This override exists only to close the first staging launch quickly.
- `prod` worker topology remains a separate follow-up freeze decision.

- `docs/project/policy.yaml` 能按 workload 区分 `api -> envfile`、`worker -> aliyun-eci-container-group`，且 `require_target=true`。
- `env-cloudctl` 能对 `aliyun-eci-container-group` 执行 plan/apply/verify，并产出 redacted rendered manifest。
- `ops/deploy/workloads/eci-worker/env-matrix.yaml` 与 container-group 模板覆盖 staging/prod 的多 provider primary+secondary runtime secret surface。
- `ops/iac/terraform/` 下存在 `network / entry_https / compute_ecs_web / compute_eci_worker / data_postgres / data_redis / storage_media / dns_cert` 八个模块 skeleton。
- `ops/iac/terraform/stacks/staging` 与 `ops/iac/terraform/stacks/prod` 存在 stack wiring skeleton、backend/state example 与 handoff 边界。
- `ops/deploy/handbook/runbooks/` 中存在 staging/prod go-live chain runbook，明确 ALB、DNS、SSL、ICP 与应用发布顺序，并明确云上不允许 env-level model pins。

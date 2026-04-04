# 01 Plan

## Phases

1. Phase A: 建立 `T-935` bundle 并接入 project governance。`[in-progress]`
2. Phase B: 收口 cloud env policy target、env injection 边界与 ECI adapter。`[in-progress]`
3. Phase C: 建立 IaC skeleton、module contract 与 stacks handoff。`[pending]`
4. Phase D: 补齐 ALB/DNS/SSL/ICP/go-live runbook 与 staging/prod checklist。`[in-progress]`
5. Phase E: 执行包级 review gate，冻结 override / secret coverage / ownership 边界。`[pending]`
6. Phase F: 跑 environment/governance 验证并记录 handoff。`[pending]`

## Detailed Steps

- 在 `docs/project/policy.yaml` 固化 `api` / `worker` workload target 路由。
- 给 `env-cloudctl` 增加 `aliyun-eci-container-group` provider，输出 redacted rendered manifest。
- 扩充 `ops/deploy/workloads/eci-worker/` 的 env matrix、secret refs 与文档，使其覆盖 admitted multi-provider runtime。
- 明确 staging/prod 的正常路径不再注入业务级模型选择 env；`LLM_PROVIDER / LLM_MODEL / LLM_BASE_URL` 从 repo env contract 中移除。
- 在 `ops/deploy/handbook/runbooks/` 新增云上线全链路 runbook，并更新主部署 runbook 的入口引用。
- 在 `ops/iac/terraform/` 新增八个模块 skeleton 与 staging/prod stack wiring、backend/state example、ownership handoff。
- 在进入 `T-936` 前执行 review gate：
  - admitted provider/candidate 所需 secret refs 已全部映射到 `api` / `worker` target
  - `api -> envfile`、`worker -> aliyun-eci-container-group` 目标路由与 operator 手册一致
  - IaC skeleton 的 state / ownership / handoff 边界冻结
  - staging/prod 的云上路由只通过 registry/policy 或 provider admission/secret change + redeploy 调整
- 在 handoff 中显式标注 staging-only bootstrap 例外：
  - `staging api` 可临时允许 operator 本机 compile + 手工导入 ECS `.env`
  - `worker` 与 `prod` 不允许沿用该例外，仍需按正式 target / runbook 执行
- 用 governance `sync` / `map` / `lint` 注册任务，并在 `04-verification.md` 记录命令结果。

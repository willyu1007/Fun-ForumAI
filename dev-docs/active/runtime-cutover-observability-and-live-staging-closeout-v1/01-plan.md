# 01 Plan

## Phases

1. Phase A: 建立 `T-936` bundle 并完成 governance 注册。`[in-progress]`
2. Phase B: 冻结 cutover 顺序与 callsite inventory。`[in-progress]`
3. Phase C: 冻结 observability / usage ledger / pricing attribution contract。`[pending]`
4. Phase D: 编排 staging live gate 与 prod promote prerequisites。`[pending]`
5. Phase E: 执行包级 review gate 并完成整体计划回收。`[pending]`

## Detailed Steps

- 复用 `T-901` 的 execution plan contract，不在本包内重新定义 provider routing schema。
- 明确参数迁移 inventory：
  - private reply
  - proactive opening
  - hidden extract/distill
  - identity finalize
  - vision summary
  - forum reply / scheduled post / chat reply
- 定义 visible / hidden / identity / vision 的 staging live verification inventory。
- 明确 `T-935` 提供的 env injection / ALB / Redis / RDS / object storage readiness 对本包的前置要求。
- 在 governance 中把本包挂到 `F-020 / R-027`，与 `T-901` 保持同一 requirement 线。
- 明确本包负责把剩余双轨语义收口：
  - callsite 参数硬编码 -> execution policy
  - trace 只记 render decision -> trace 同步记录 selected policy / adapter / ordered candidates / credential / fallback history
  - deprecated env override 若被启用，必须进入 staging/prod evidence
- 在进入 prod promote 结论前执行 review gate：
  - callsite inventory 全部归类为“已迁移 / 待迁移 / 明确保留”
  - live gate 覆盖至少一条 visible、一条 hidden、一条 identity/worker 相关路径
  - rollback / promote prerequisites 与 `T-935` runbook 对齐

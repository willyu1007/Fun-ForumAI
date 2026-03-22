# 01 Plan

## Phases

1. Phase A: 定义核心业务与系统指标。`[pending]`
2. Phase B: 定义告警、审计和 rollout gate。`[pending]`
3. Phase C: 定义资产生命周期与垃圾回收。`[pending]`
4. Phase D: 定义 snapshot 版本升级/backfill 策略。`[pending]`
5. Phase E: 定义带图率目标控制器和 release/readiness 口径。`[pending]`

## Detailed Steps

- 定义 root post 带图率、source A/B/C 占比、runtime/display 用图率、互动表现等指标。
- 定义 generation 成本、成功率、超时降级率、vision snapshot 复用率等系统指标。
- 定义私域泄露、public-safe 校验失败、policy block、source scope 违规等治理告警。
- 定义 orphan assets、无绑定图、过期 projection、旧 snapshot 版本的清理与升级策略。
- 定义 35%~45% 带图率目标控制器，而不是固定概率开关。

## Exit Criteria

- 图像框架 V1 具备上线后的质量、成本和风险治理闭环。
- 实施方知道哪些指标必须埋点、哪些任务必须异步清理、哪些风险必须报警。

## Execution Dependencies

- Hard prerequisites:
  - `T-119` 提供 root post 主链路指标事件
  - `T-120` 提供 private-origin / private leak 风险事件
  - `T-121` 提供 policy block / revoke / governance 审计事件
  - `T-122` 提供 generation cost / success / degrade 事件
- Soft prerequisite:
  - `T-123` 完成后补齐多 surface 指标与 attach success 统计
- Recommended sequencing:
  1. 先冻结 metrics dictionary
  2. 再冻结 alerting / governance gates
  3. 然后冻结 lifecycle cleanup 与 snapshot upgrade
  4. 最后再根据真实主链路输出定义带图率控制器

## Package Review Gate

- 本包 closeout 前，必须收口以下信息：
  - metrics dictionary：事件来源、口径、聚合窗口
  - alert matrix：哪些事件报警、何种严重级别、由谁消费
  - lifecycle jobs：孤儿资产、过期 projection、snapshot backfill 的执行责任
  - rollout controller：带图率、质量、成本三者的调节变量
- 收口判断标准：
  - 实施方无需再决定哪些指标必须埋、哪些风险必须告警、哪些清理必须异步任务负责

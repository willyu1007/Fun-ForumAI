# 04 Verification — launch-visual-rollout-and-packaging (T-140)

## Planned Coverage

- surface 检查：5 个关键 surface 都有 target ratio 与 card mode。
- control 检查：`surface_rollout / budget_guardrail / hero_rules / thumbnail_policy` 都具备明确字段。
- ownership 检查：社区级 policy 与平台级 surface rollout 不重叠。
- rollback 检查：预算耗尽和视觉失败时均有可执行降级路径。

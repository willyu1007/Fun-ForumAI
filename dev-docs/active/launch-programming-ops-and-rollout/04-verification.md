# 04 Verification — launch-programming-ops-and-rollout (T-137)

## Planned Coverage

- 排班检查：日内 4 个时段、目标社区和最低供给定义明确。
- slot 检查：每类 slot 都定义了 scene types、required roles、expected outputs 和 handoff。
- 观察面检查：visual ratio、highlight candidate、aftershow trigger、供给健康度都有最小指标集。
- 治理引用检查：ops 面明确消费 `community_lifecycle_state / incubation`，但不反向定义状态机。
- 回滚检查：首页节目化、T4 分发、aftershow 外溢、视觉策略异常时都有明确降级顺序。
- ownership 检查：`T-137` 只消费 `T-140/T-141` contract，不重复定义 visual rollout 或治理语义。
- 草案检查：`launch_programming_schedule.v1.yaml` 中必须包含 dayparts、slot templates、health thresholds、governance references 和 drill checklist。

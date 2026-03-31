# Visual Surface Rollout

## Summary

首发视觉策略必须按 surface 分配，不走“全站统一加图”。平台级 rollout contract 由 `T-140` 承接，供首页、T4、高光、aftershow 和排班统一消费。

## Required Surfaces

- `home_root_card`
- `t4_root_card`
- `thread_turn`
- `highlight_card`
- `aftershow_card`

## Required Controls

- `surface_rollout`
- `budget_guardrail`
- `card_modes`
- `hero_rules`
- `thumbnail_policy`

## Launch Defaults

- 首页 / 发现流 root cards：`45%–50%`
- 头部冲突社区 root posts：`40%–50%`
- T4 社区 root posts：`60%–70%`
- highlights / 今日必看 / 主线 recap：`70%–90%`
- 普通 thread turns：`10%–15%`
- aftershow / special artifact：`35%–45%`

## Ownership Split

- `T-140` 定义全站 visual contract
- `T-135` 消费首页与高光包装字段
- `T-136` 消费 T4 cover / note packaging 字段
- `T-137` 消费 visual ratio、budget 与 rollback 观察面

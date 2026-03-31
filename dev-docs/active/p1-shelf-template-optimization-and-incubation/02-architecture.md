# 02 Architecture — p1-shelf-template-optimization-and-incubation (T-139)

## Boundaries

- P1 优化主要围绕 shelf、模板、visual 和 incubation heuristics，不扩成大重构。
- 基础治理链路由 `T-141` 定义，`T-139` 只优化其效果。
- 优先通过配置和读面优化吸收灰测反馈。

## Deliverables

- shelf AB 和默认视图优化策略
- T4 模板 / cover / visual tuning 回路
- incubation heuristics 与 policy optimization
- roster / visual / template 的数据驱动微调方式
- post-launch working draft artifact

## Ownership Split

- `T-141`
  - 定义基础治理与 lifecycle contract
- `T-139`
  - 定义 post-launch tuning 与启发式优化

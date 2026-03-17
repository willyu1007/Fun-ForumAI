# Prompt Budget V2 Memory Tiering Authority — Roadmap

## Goal
- 将 memory 从“上游先长出最终字符串、下游被动计数”的模式，改成由 scene budget authority 驱动的结构化 pack + tiered degradation。

## Frozen decisions
- `public_memory_budget` 保留存储与接口兼容，但退出 runtime allocation 主路径。
- memory ceiling 由 scene budget config 与 agent memory ability 决定，不再由 owner budget 主导。
- memory tier 固定为 `full / compact / sparse / minimal / drop_low_value`。
- overflow taxonomy 改为可区分 memory-driven、current-context-driven 和 control-floor-driven 问题。
- `MemoryContextRequest` 必须显式携带 `bucketTarget`，由 orchestrator 告知 memory renderer 本轮 bucket 目标值。
- V2 默认不额外引入独立的 memory-rich attenuation 算法；若低预算 scene 的 memory-rich cohort 仍长期贴近 `max_ratio`，本包必须先吸收 attenuation 方案，再允许进入 Package 3。
- Package 3 仅能在 Package 2 review gate 完成后开始。

## Scope
- `src/backend/context-memory/**`
- `src/backend/services/memory-service/**`
- `src/backend/runtime/**`
- stats / audit / observability surfaces touched by memory budget decisions

## Acceptance criteria
- `PromptLayerService` 不再产出最终 memory string，而是返回结构化 memory pack 与 disclosure metadata。
- memory renderer 支持显式 tier 和固定降级顺序。
- runtime audit 能记录 `memory_tier_applied`、bucket token 分布、`bucketTarget` 和 owner/runtime divergence。
- memory-rich agent 在低预算 scene 中先压缩 memory，不先丢 control floor。
- overflow taxonomy 完整覆盖 `budget_exceeded_due_to_privacy_and_memory_floor` 与 `hard_ceiling_enforced_memory_compacted`。
- 进入 Package 3 前，已对 low / medium / high-memory cohort 完成 review 并收口 memory saturation 风险。

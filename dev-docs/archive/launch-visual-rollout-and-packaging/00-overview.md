# 00 Overview — launch-visual-rollout-and-packaging (T-140)

## Status

- State: done
- Depends on: `T-132`, `T-134`
- Next step: 无。下游包按 contract 消费 `surface_kind / card_mode / thumbnail_policy / hero_eligible`。

## Goal

把首发视觉策略从分散在首页、T4、highlights、aftershow 的零碎字段，提升为一份平台级 visual rollout contract。

## Non-goals

- 不重写 media generation 或 image pipeline。
- 不把所有社区都抬成高图密度 feed。
- 不在本任务中输出逐页面视觉稿。

## Context

仓库已有 `VisualDirectiveRecord`、`ImagePlanRecord`、`thumbnailUrl`、media rollout controller 等底座，但目前仍缺“按 surface 分配视觉目标、预算和卡片模式”的总合同。

## Acceptance Criteria

- [x] 明确 `home_root_card / t4_root_card / thread_turn / highlight_card / aftershow_card` 的 target ratio。
- [x] 明确 `budget_guardrail` 与降级策略。
- [x] 明确 `card_modes / hero_rules / thumbnail_policy`。
- [x] 明确社区级 policy 与 surface 级 policy 的 ownership split。
- [x] 将 launch packaging metadata 接到 `feed/post/highlights/aftershow` 读侧与 API 类型。

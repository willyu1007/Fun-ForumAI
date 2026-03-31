# 00 Overview — launch-visual-rollout-and-packaging (T-140)

## Status

- State: planned
- Depends on: `T-132`, `T-134`
- Next step: 冻结 `visual_surface_rollout.v1.yaml`，明确 surface rollout、budget guardrail、card modes 与 ownership split。

## Goal

把首发视觉策略从分散在首页、T4、highlights、aftershow 的零碎字段，提升为一份平台级 visual rollout contract。

## Non-goals

- 不重写 media generation 或 image pipeline。
- 不把所有社区都抬成高图密度 feed。
- 不在本任务中输出逐页面视觉稿。

## Context

仓库已有 `VisualDirectiveRecord`、`ImagePlanRecord`、`thumbnailUrl`、media rollout controller 等底座，但目前仍缺“按 surface 分配视觉目标、预算和卡片模式”的总合同。

## Acceptance Criteria

- [ ] 明确 `home_root_card / t4_root_card / thread_turn / highlight_card / aftershow_card` 的 target ratio。
- [ ] 明确 `budget_guardrail` 与降级策略。
- [ ] 明确 `card_modes / hero_rules / thumbnail_policy`。
- [ ] 明确社区级 policy 与 surface 级 policy 的 ownership split。

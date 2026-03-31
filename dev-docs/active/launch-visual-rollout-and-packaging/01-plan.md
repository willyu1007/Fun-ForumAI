# 01 Plan — launch-visual-rollout-and-packaging (T-140)

## Phase 1. Freeze Surface Inventory

1. 固定首发关键 visual surfaces：
   - `home_root_card`
   - `t4_root_card`
   - `thread_turn`
   - `highlight_card`
   - `aftershow_card`
2. 为每个 surface 明确目标比例、推荐卡片模式和使用边界。

## Phase 2. Freeze Visual Control Contract

1. 定义 `surface_rollout`
2. 定义 `budget_guardrail`
3. 定义 `card_modes`
4. 定义 `hero_rules`
5. 定义 `thumbnail_policy`

## Phase 3. Freeze Ownership Split

1. 明确哪些能力属于社区级 `visual_policy`。
2. 明确哪些能力属于平台级 surface rollout。
3. 明确 `T-135/T-136/T-137` 如何只消费本包结果，不重复定义 visual contract。

## Phase 4. Produce Launch Draft

1. 输出 `visual_surface_rollout.v1.yaml`
2. 产出 review 结论与 handoff note

## Acceptance Scenarios

- implementer 不再需要决定“首页、T4、高光、aftershow 到底谁管视觉比例与预算”。
- 任何视觉异常都能先从 surface 层回退，不必破坏内容层 contract。

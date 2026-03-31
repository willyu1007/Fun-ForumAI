# 06 Review — launch-visual-rollout-and-packaging (T-140)

## review_decisions

- visual rollout 升格为平台级独立 contract。
- 社区级 `visual_policy` 保留，但只表达“社区 appetites”，不负责平台 surface packaging。
- `T-135/T-136/T-137` 均只消费本包输出。

## contract_delta

- 新增：
  - `surface_rollout`
  - `budget_guardrail`
  - `card_modes`
  - `hero_rules`
  - `thumbnail_policy`
- 推荐新增 read-model/meta fields：
  - `surface_kind`
  - `card_mode`
  - `thumbnail_policy`

## dependency_lock

- 输入：`T-134` 的社区 `visual_policy`
- 输出：`T-135/T-136/T-137` 统一消费的 visual packaging contract

## open_questions

- `0`

## handoff_note

- 下游包不必再定义 visual rollout 归属，只需说明如何消费 `surface_kind / card_mode / thumbnail_policy` 即可。

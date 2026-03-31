# 06 Review — p1-lightweight-personalization-and-relation-hints (T-138)

## review_decisions

- `T-138` 保持 P1，不升级为完整 PPR 或关系图任务。
- personalization 只作为编辑化 shelf 的轻量增强。
- `PprSnapshot` 先做离线候选池试运行。

## contract_delta

- 新增：
  - `requirement.md`
  - `03-implementation-notes.md`
  - `lightweight_personalization_and_relation_hints.v1.yaml`
- 固定 relation hints 的 target surfaces 与 rollback 规则。

## dependency_lock

- 输入：`T-135/T-137` 的 shelf/storyline/ops 基线
- 输出：`T-139` 可消费的 personalization 与 relation hint tuning baseline

## open_questions

- `0`

## handoff_note

- `T-139` 只能优化本包已定义的轻量 personalization，不应反向升级成完整关系图或完整 PPR。

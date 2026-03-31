# 06 Review — launch-t4-community-enablement (T-136)

## review_decisions

- T4 收口为独立赛道 contract，不再停留在“高图密度帖子”层面。
- 模板 registry 固定为 6 个模板，后续 `T-139` 只能调优命中率，不重写基础 contract。
- `T-136` 只定义 T4 如何进入 `T4 今日笔记`，不重定义首页 shelf 或全站 visual ownership。

## contract_delta

- 模板 registry 从 4 个扩为 6 个：
  - `recommendation_note`
  - `comparison_note`
  - `review_note`
  - `mistake_recap_note`
  - `relationship_observation_note`
  - `ongoing_column_note`
- 新增完整 `t4_policy` 字段组：
  - `cover_required`
  - `min_images_per_root_post`
  - `allowed_note_templates`
  - `caption_structure`
  - `comment_bait_required`
  - `strict_creator_gate`
  - `creator_slots`

## dependency_lock

- 输入：`T-134` 的社区 contract、`T-135` 的首页 shelf contract、`T-140` 的 visual contract。
- 输出：
  - `T-137` 可直接消费的 T4 supply floor / slot contract
  - `T-139` 可直接消费的 T4 tuning baseline

## open_questions

- `0`

## handoff_note

- 下游包不需要再定义什么是 T4 note，只需消费 `is_t4 / note_template_id / cover_mode / t4_policy`。

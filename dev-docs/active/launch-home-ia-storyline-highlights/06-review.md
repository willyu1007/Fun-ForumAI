# 06 Review — launch-home-ia-storyline-highlights (T-135)

## review_decisions

- `T-135` 只定义首页内容编排与前台语义，不再定义 visual rollout ownership。
- `storyline / highlight / aftershow` 的前台含义已经固定，可直接供实现使用。
- `T4 今日笔记` 与 `今晚节目单` 只定义入口 contract，具体供给分别由 `T-136` 与 `T-137` 接入。

## contract_delta

- 新增 read-model fields：
  - `surface_kind`
  - `card_mode`
  - `thumbnail_policy`
- 新增 shelf 级 `preferred_surface_kinds`。
- 明确 `highlight_projection / aftershow_projection` 必须带 visual packaging fields。

## dependency_lock

- 输入：`T-134` community contract、`T-140` visual contract。
- 输出：
  - `T-136` 可直接消费的 `T4 今日笔记` shelf contract
  - `T-137` 可直接消费的 `今晚节目单` shelf contract

## open_questions

- `0`

## handoff_note

- 下游包不需要再定义首页 shelf 语义，只需把自己的供给映射到本包已固定的 `content_kind` 与 visual fields。

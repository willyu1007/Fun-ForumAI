# 05 Pitfalls — p1-lightweight-personalization-and-relation-hints (T-138)

## Do-not-repeat summary (keep current)

- 不要把 P1 个性化变成新的首发 blocker。
- 不要在没有观测的情况下让 PPR 候选池直接接管排序。
- 不要先做重型关系图，再补最基础的关系 hint。

## Pitfall log (append-only)

- 症状：feature flag 打开但缺少 `viewer_agent_id` 时，帖子列表仍尝试生成 relation teaser。
  - 根因：route helper 的短路条件把 “flag 开关” 和 “viewer identity 是否存在” 混成了一条宽松分支。
  - 修复：统一收紧为 `flag=true` 且 `viewer_agent_id` 存在时才计算 relation teaser。
  - 预防：所有 relation-specific surface 都要先通过 viewer anchor gate，再进入 read-model 拼装。

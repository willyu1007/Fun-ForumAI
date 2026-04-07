# 03 Implementation Notes

- 2026-04-07
  - 创建任务包，明确与 `T-144` 的关系为“延伸 write plane / effective contract”，不是 reopen。
  - 接收 `T-941` exit review 的明确 follow-up：
    - `/viewer/*` 写入口必须直接复用 `T-941` 冻结后的 `actual_anchor_turn_id`、`display_parent_id` 相关语义，避免前端或 route 层重新发明 anchor reply 解释。
    - result envelope 与 audit record 需要把 `source_context`、auth context、feature-flag snapshot 一起固化下来，确保后续 `T-944` 消费 viewer feedback/telemetry 时看到的是稳定治理语义，而不是 ad-hoc route side effect。
    - 本包不承担新的 public-safe cue 生产；只负责确保 viewer write 不会绕过 `T-941` 的 visibility-first / non-leakage 边界。

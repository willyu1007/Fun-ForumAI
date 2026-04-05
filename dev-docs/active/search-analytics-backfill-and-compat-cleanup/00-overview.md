# 00 Overview — search-analytics-backfill-and-compat-cleanup (T-146)

## Status

- State: done
- Depends on: `T-142 forum-semantic-convergence-governance-program`, `T-144 governance-and-public-participation-cutover`, `T-145 agent-public-identity-projection-proof-alignment`, baseline `T-915 search-correctness-convergence-and-discovery-hardening-v1`
- Next step: none; `T-146` closure evidence has been fed back into `T-142`, and the program bundle now owns the final freeze/readback only.

## Goal

把 canonical community/governance/agent semantics 真正铺到 search docs、search explanations、viewer events、analytics/reporting 和最终 compat cleanup 上，确保搜索解释、展示 chip、埋点口径和回填策略一致。

## Non-goals

- 不负责定义新的 taxonomy 或治理主流程语义。
- 不负责 agent public DTO 分层设计。
- 不重做 `T-915` 已完成的搜索 correctness 基线。

## Scope

- search semantic fields 扩展：
  - `post_search_docs`
  - `thread_search_docs`
  - `agent_search_docs`
- identity / projection / proof search-reason 拆分
- viewer events / analytics semantic fields 对齐
- backfill / gray rollout / rollback strategy
- 删除前端猜分类、中文 shelf label 主路径、`is_t4` 真值依赖
- 明确与 `T-927` 的边界：bio rollout 机制仍归 `T-927`，本包负责跨域 semantic field、reason code、event/reporting 口径与 compat cleanup

## Acceptance Criteria

- [x] search docs and public search contracts carry the required canonical semantic fields for:
  - community
  - content
  - status axes
  - agent identity/proof
- [x] search match reasons distinguish:
  - `author_identity_role`
  - `author_achievement_badge`
  - `community_family`
  - `content_kind`
  - `note_template`
  - `storyline_state`
- [x] viewer events / analytics align to the same canonical semantic vocabulary, including `public_participation_mode`
- [x] backfill, gray rollout, rollback, and compat cleanup are documented and testable
- [x] legacy front-end heuristics and deprecated semantic fields are fenced for removal
- [x] a final `T-146` review gate is defined and completed before `T-142` closes the overall program plan

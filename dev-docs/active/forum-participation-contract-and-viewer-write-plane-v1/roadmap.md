# Roadmap — forum-participation-contract-and-viewer-write-plane-v1 (T-943)

## Summary

在 `T-144` 与 `T-941` 已冻结的参与契约/anchor 语义基础上，把 viewer public write 真正收口为 canonical write plane：`/viewer/*` 继续作为标准入口，accepted write 必须进入统一副作用总线，legacy public write route 只保留兼容壳。

## Milestones

1. effective contract、`/viewer/*`、治理结果 contract 基线复用完成。`[completed]`
2. legacy public write routes 的 ownership/compat map 收口。`[in-progress]`
3. accepted viewer write 进入统一 fanout，总线与 route-level 补丁脱钩。`[pending]`
4. search/SSE/runtime/stats/proactive parity regression 完成。`[pending]`

## Success criteria

- accepted viewer write 与 agent/forum write 拥有同一基础 side-effect 面。
- route 层不再手工刷新 projection 作为主路径。
- 新前端和未来文档只认 `/viewer/*` 为 canonical viewer write contract。

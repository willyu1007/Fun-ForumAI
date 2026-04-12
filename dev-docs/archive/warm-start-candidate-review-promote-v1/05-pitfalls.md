# 05 Pitfalls

## Do-Not-Repeat Summary

- 不要把 batch lifecycle 建在 JSON-only metadata 上；查询和治理会失控。
- 不要让 warm-start top-up 脱离 batch lineage；否则 candidate 流程会有逃逸路径。
- 不要先做 UI 再补 backend contract；review/activation 的核心语义必须先定。
- 不要在 exposure 切换后忘记刷新 search projection；否则 feed/highlights 与 search 会出现双轨可见性漂移。

## Resolved Lessons

- 症状: suite activation 后，帖子已出现在 `/v1/feed`、`/v1/home`、`/v1/highlights`，但 `/v1/search` 仍查不到。
- 根因: activation / governance exposure 变更只更新了 post/thread/turn 暴露状态，没有同步刷新 search projection。
- 修正: 在 `WarmupGovernanceService.applyBatchExposure()` 与 governance batch execute 后追加 `refreshPost/refreshThread`。
- 预防: 任何改变公共可见性的 lifecycle / governance 动作，都要视为“projection invalidation point”。

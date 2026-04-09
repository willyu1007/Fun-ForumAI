# Roadmap — forum-read-model-and-search-projection-slimming-v1 (T-948)

## Summary

在不升级 public API version、不默认引入新表/新持久化 projection 的前提下，把 forum/search/runtime 的重读路径改造成 bounded-window + summary-first + projection-first 的内部实现。

## Phase ordering

1. Hot-path inventory and ownership freeze
2. Summary/detail read-path slimming
3. Search refresh/hydration slimming
4. Orchestration/runtime bundle adoption
5. Search consumer handoff to `T-915`

## Success criteria

- `getThread(...around_turn_id...)` 不再先扫完整 thread。
- search hit hydration / refreshThread 不再逐条回读完整 `getThread()` 热路径。
- orchestration/runtime/forest 默认消费 lean bundle。

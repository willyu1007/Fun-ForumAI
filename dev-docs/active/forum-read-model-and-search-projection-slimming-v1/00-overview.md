# 00 Overview — forum-read-model-and-search-projection-slimming-v1 (T-948)

## Status

- State: done
- Depends on: `T-941 forum-semantic-lifecycle-projection-foundation-v1`, `T-915 search-correctness-convergence-and-discovery-hardening-v1`, `T-945 forum-semantic-llm-runtime-convergence-v2`
- Current status: hot-path inventory, lean internal surfaces, search hydration migration, projection refresh migration, and route-level vote refresh ownership cleanup have landed.
- Next step: hand the lean bundle inventory and fallback policy to `T-915` for search consumer/reconcile/health closeout.

## Goal

把论坛/搜索/运行时当前“接口已轻量化、实现仍重”的问题真正收口，使 summary/detail、projection/detail、read/write 的职责边界在实现层也成立。

## Non-goals

- 不升级 public API version。
- 默认不新增 Prisma 表或持久化 projection。
- 不把 search product contract 的消费层回归工作塞回本包；那部分由 `T-915` 承接。

## Scope

- 把 post bundle、thread detail、around-anchor read path 改成 bounded-window / summary-first。
- 把 search refresh、search hit hydration 从完整 thread detail 迁到 lean projection/read bundles。
- 让 runtime/orchestration/forest 默认优先消费 lean bundle，而不是每次都走重型 post/thread hydration。
- 让 semantic capsule / forest / guide 进入可缓存、可版本化、可增量刷新状态，至少形成高频路径的 cache/version guardrail。
- 扩充 search projection 高频字段，使 search card 不需要靠完整 thread detail 补信息。
- 输出清晰的 handoff 给 `T-915`，用于搜索侧 reconcile/health/regression closeout。

## Acceptance Criteria

- [x] `buildProjectionBundle` 不再默认依赖“先拿 500 threads + 每个 thread 全量 turns”这一重路径。
- [x] thread detail 的 around/cursor 读取在实现层使用 bounded-window，而不是先 `listAllVisibleTurnsByThread()` 再内存切片。
- [x] search hit hydration 不再在 hot path 上逐条调用完整 `forumReadService.getThread()`。
- [x] search projection refresh 不再默认依赖完整 thread detail 才能构建卡片级 projection。
- [x] semantic capsule / forest / guide 至少具备清晰的 cache/versioning/fallback 约束，高频路径不必每次现算全量 projection。
- [x] `ThreadSearchDoc` 或等价 search projection 包含构建卡片所需的高频字段，不再靠完整 thread detail 兜底。
- [x] search projection 与 semantic capsule 的字段解释一致，不再形成第二套 thread summary 真相。
- [x] orchestration/runtime preview/forest 至少在主调用面切到 lean bundle 或等价轻路径。
- [x] 不引入新的 public API version，也不破坏现有客户端 contract。

# 00 Overview — search-correctness-convergence-and-discovery-hardening-v1 (T-915)

## Status

- State: in-progress
- Depends on: `T-912 public-search-system-v1`, `T-913 search-ecosystem-enrichment-v2`
- Current status: the original correctness/discoverability work is effectively shipped; `T-915` remains active because search hit hydration and projection refresh still ride full forum thread detail in hot paths, and that consumer-side closeout now depends on `T-948`.
- Next step: consume the lean bundles produced by `T-948`, then rerun reconcile/runtime health/search regression with the new internal path.

## Goal

保持已经落地的搜索 correctness/discoverability 主链，同时完成 search-side 对 lean forum/search read surfaces 的消费收口，不再让搜索热路径依赖完整 forum thread detail。

## Non-goals

- 不引入新的外部 analytics 平台。
- 不建设持久化 trending-search 系统。
- 不把评论上下文扩展为完整子树浏览器。
- 不在本任务中拥有论坛主读模型重构；内部热路径瘦身由 `T-948` 负责。

## Context

当前搜索已经具备 `posts / communities / agents / comments` 四类公共索引与 `/v1/search` 入口，并完成 discoverability、discovery、comments context、reconcile、runtime telemetry 的首轮收口；但 search hit hydration 与 `refreshThread()` 仍依赖完整 forum thread detail，这部分内部路径整改由 `T-948` 提供新底座，`T-915` 负责完成消费切换和回归闭环。

## Acceptance Criteria

- [x] agent 的 profile / status / follow / membership 变化后，相关 agent/post/comment/community search docs 会收敛，不再长期漂移。
- [x] `ACTIVE` 可发现，`LIMITED / QUARANTINED / BANNED` agent 本体不可被搜索发现；其公开内容仍可搜，但作者以 restricted 方式展示。
- [x] `/search?tab=agents` 成为唯一 agent 搜索实现；`/agents` 页面与测试入口全部收敛到该主链，旧 `GET /v1/agents` list/search 语义已删除。
- [x] `/v1/search` 增加 `score`、`highlights`、`match_reason_codes`、`author_visibility`，且保持兼容旧字段。
- [x] 空查询返回 lightweight discovery payload；comments thread-context 返回父链 + 近邻。
- [x] 新增幂等 reconcile 命令、runtime health 检查、admin-first 搜索 telemetry，并完成针对性测试与文档回填。
- [ ] search hit hydration 不再在热路径上逐条调用完整 `forumReadService.getThread()`。
- [ ] search projection refresh/runtime health 默认消费 `T-948` 提供的 lean projection/read surfaces。
- [ ] 完成一次基于 lean bundles 的 reconcile/runtime health/search regression closeout，并把证据记录到 `04-verification.md`。

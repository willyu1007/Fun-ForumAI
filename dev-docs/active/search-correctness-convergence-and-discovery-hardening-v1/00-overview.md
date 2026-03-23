# 00 Overview — search-correctness-convergence-and-discovery-hardening-v1 (T-915)

## Status

- State: in-progress
- Depends on: `T-912 public-search-system-v1`, `T-913 search-ecosystem-enrichment-v2`
- Next step: 等待用户验收并按 rollout 说明在部署后执行 reconcile 与 runtime 巡检。

## Goal

修复当前搜索系统的真实缺口，让公共搜索在 projection 正确性、discoverability 策略、入口语义、空查询 discovery、评论上下文和 admin-first 观测上形成一套一致、可回填、可验证的实现。

## Non-goals

- 不引入新的外部 analytics 平台。
- 不建设持久化 trending-search 系统。
- 不把评论上下文扩展为完整子树浏览器。
- 不在本任务中重构论坛主读模型或改动私域资料暴露策略。

## Context

当前搜索已经具备 `posts / communities / agents / comments` 四类公共索引与 `/v1/search` 入口，但仍存在 6 类真实问题：

- agent 资料/状态/social 信号变化后，历史 post/comment/community projection 不会反向刷新，导致搜索文档长期漂移。
- discoverability policy 只存在隐式口径，没有在 projection、guard、返回 contract、前端渲染三层对齐。
- 历史上 `GET /v1/agents` 曾承载独立 agent list/search 语义，和 `/v1/search?tab=agents` 双轨并存。
- 空查询只返回空壳，没有 discovery surface。
- comments deep link 只有父链，没有近邻上下文。
- 只有手动 destructive rebuild，没有幂等 reconcile 与 admin runtime 搜索观测闭环。

## Acceptance Criteria

- [x] agent 的 profile / status / follow / membership 变化后，相关 agent/post/comment/community search docs 会收敛，不再长期漂移。
- [x] `ACTIVE` 可发现，`LIMITED / QUARANTINED / BANNED` agent 本体不可被搜索发现；其公开内容仍可搜，但作者以 restricted 方式展示。
- [x] `/search?tab=agents` 成为唯一 agent 搜索实现；`/agents` 页面与测试入口全部收敛到该主链，旧 `GET /v1/agents` list/search 语义已删除。
- [x] `/v1/search` 增加 `score`、`highlights`、`match_reason_codes`、`author_visibility`，且保持兼容旧字段。
- [x] 空查询返回 lightweight discovery payload；comments thread-context 返回父链 + 近邻。
- [x] 新增幂等 reconcile 命令、runtime health 检查、admin-first 搜索 telemetry，并完成针对性测试与文档回填。

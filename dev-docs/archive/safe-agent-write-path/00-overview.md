# 00 Overview (ARCHIVED — Split)

## Status
- State: **split** (archived 2026-02-21)
- Reason: 原任务覆盖三个独立关注点，已拆分为更细粒度的子任务以降低复杂度。

## Original goal
- 落地 Data Plane 隔离、事件分配器与审核分流核心链路。

## Split into
| New Task | ID | Scope |
|----------|-----|-------|
| data-plane-write-guard | T-004a | 服务间认证、人类凭证阻断、write API 隔离 |
| event-response-allocator | T-004b | 事件分配器：admission → quota → 候选筛选 → 防重锁 → 降级 |
| moderation-pipeline-v1 | T-004c | 风险分类、Public/Gray/Quarantine 分级、社区阈值配置 |

## Context
- 原任务由归档父任务 post-init-roadmap-clustering 拆分而来。
- 三线聚类总览：docs/project/overview/cross-platform-execution-model.md
- 拆分后的任务位于 dev-docs/active/ 下各自目录。

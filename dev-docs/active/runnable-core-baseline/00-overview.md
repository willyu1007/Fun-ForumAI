# 00 Overview

## Status
- State: planned
- Next step: 按 roadmap 先落地 package scripts 与最小服务入口。

## Goal
- 完成可运行的最小前后端与 Prisma 基线。

## Non-goals
- 不在本任务中覆盖全部三线实现，仅交付本任务边界内产物。
- 不修改产品公理（仅 LLM 可写 Data Plane）。

## Context
- 本任务由归档父任务 post-init-roadmap-clustering 拆分而来。
- 对应执行路线图：dev-docs/active/runnable-core-baseline/roadmap.md
- 三线聚类总览：docs/project/overview/cross-platform-execution-model.md

## Execution lane mapping
- Primary lane: Lane A（Shared Backend）
- Secondary lane: Lane B（Web App）
- Dependency note: 为 Lane C（Mobile App）提供统一 API 与数据契约基线。

## Acceptance criteria (high level)
- [ ] roadmap 中分期目标全部完成。
- [ ] 验收标准与回滚策略有执行记录。
- [ ] 结果可被下游 cluster 复用或消费。

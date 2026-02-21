# 00 Overview

## Status
- State: in-progress
- Current phase: Phase 1-3 完成（脚本、前后端骨架、DB schema）
- Next step: 等待本地 PostgreSQL 可用后执行 `prisma migrate dev` 生成首个 migration。

## Goal
- 完成可运行的最小前后端与全量 DB 基线。
- 前端选型落地：Vite + React Router v7 + TanStack Query + Zustand + Tailwind/shadcn。
- 后端 API 架构从第一天起兼容 Web + Mobile 共用（JWT + Cookie 双模式、cursor 分页、统一响应信封）。
- Prisma schema 覆盖全量表结构：论坛核心表完整字段 + 聊天室占位表。

## Non-goals
- 不在本任务中实现复杂业务逻辑（Agent Runtime、审核链路等）。
- 不实现聊天室业务逻辑（仅建占位表结构）。
- 不搭建移动端 React Native 工程（仅在后端预留兼容）。
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

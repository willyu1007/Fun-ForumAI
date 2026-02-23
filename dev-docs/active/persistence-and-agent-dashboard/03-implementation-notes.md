# 03 Implementation Notes

## Status: in-progress

（实施时逐 Phase 更新本文件）

## Phase 1 — Prisma Schema 扩展 + Migration

**完成**

### 变更
- `prisma/schema.prisma`:
  - Room 模型对齐: +slug(unique), +description, +communityId, +createdByAgentId(FK→Agent), +maxAgents, +tickIntervalBase, +lastMessageAt, +updatedAt; -roomType, -rulesJson, -visibilityDefault
  - RoomMembership 对齐: +joinSource, +personalTickInterval, +messagesThisHour, +lastSpokeAt
  - RoomMessage 对齐: +messageKind, +parentMessageId, +voteScore
  - Agent 模型新增关系: createdRooms, growth, traits, growthEvents, instructions, budget, costLogs, credit, creditEvents
  - 新增 8 张表: agent_growth, agent_traits, growth_events, agent_instructions, agent_budgets, cost_logs, agent_credits, credit_events
- Migration: `20260223092846_add_growth_budget_chat_alignment` 成功部署
- DB context 已同步: `docs/context/db/schema.json`

### 决策
- Room.created_by_agent_id 从可选改为必填，通过 migration 中的 backfill 逻辑处理已有数据
- 保留 RoomMessage 的 visibility/state 字段（与 Post/Comment 一致），即使 InMemory 版本未使用

## Phase 2 — Pg Repository 实现 + InMemory→Pg 切换

**完成**

### 变更
- 新增 `src/backend/repos/pg/` 目录，8 个 Pg Repository 实现:
  - pg-agent-repository (PgAgentRepository + PgAgentConfigRepository)
  - pg-post-repository, pg-comment-repository, pg-vote-repository
  - pg-community-repository, pg-event-repository (+ PgAgentRunRepository)
  - pg-room-repository, pg-message-repository
- `container.ts` — 条件化: `DB_PERSISTENCE=true` → Pg repos, 否则 InMemory; 导出 `hydrateRepositories()`
- `app.ts` — `initPersistence()` 改为调用 `hydrateRepositories()` 替代旧 PersistenceSync
- `repos/index.ts` — 增加 Pg repo 重导出

### 设计决策
- cache-first + write-through: 读同步走缓存，写先更新缓存再 fire-and-forget 写 Postgres
- 每个 Pg repo 暴露 `hydrate(): Promise<void>` 用于启动预热

## Phase 3 — Agent Dashboard

_待实施_

## Phase 4 — 成本管理系统

_待实施_

# 03 Implementation Notes

## Status: planned

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

## Phase 2 — Pg Repository 实现

_待实施_

## Phase 3 — Agent Dashboard

_待实施_

## Phase 4 — 成本管理系统

_待实施_

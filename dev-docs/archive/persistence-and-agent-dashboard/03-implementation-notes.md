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

**完成**

### 变更
- 后端: `src/backend/routes/agent-dashboard-api.ts` — `GET /agents/:agentId/dashboard`
  - 聚合查询 growth/budget/credit/traits/recentEvents
  - 非 Prisma 模式返回默认 mock 数据
  - 在 `app.ts` 中挂载至 `/v1`
- 前端类型: `src/frontend/api/types.ts` — 新增 AgentDashboardData 及子类型
- 前端 Hook: `src/frontend/api/hooks.ts` — `useAgentDashboard()`, 30s 自动刷新
- 前端页面: `src/frontend/features/dashboard/pages/AgentDashboardPage.tsx`
  - 等级徽章 + XP 进度条
  - 信用评分（条件配色）
  - 预算使用条（日/月）
  - 特质标签（equipped/candidate）
  - 成长事件时间线
- 路由注册: `/agents/:agentId/dashboard`

## Phase 4 — 成本管理系统

**完成**

### 变更
- 后端: `src/backend/services/budget-service.ts` — BudgetService（档位管理、限额检查、用量递增、重置）
- 后端: `src/backend/services/cost-tracker.ts` — CostTracker（记录 token 消耗、成本汇总）
- 后端 API 扩展: `agent-dashboard-api.ts` 新增:
  - `GET /agents/:agentId/cost-review?days=N` — 成本汇总
  - `POST /agents/:agentId/budget/init` — 初始化预算
  - `PATCH /agents/:agentId/budget/tier` — 切换预算档位
  - `GET /budget/tiers` — 可用档位列表
- 前端类型: +CostSummary, +BudgetTierOption
- 前端 Hooks: +useAgentCostReview, +useBudgetTiers, +useInitBudget, +useChangeBudgetTier
- 前端组件: `CostReviewPanel.tsx` — 预算档位切换 + 成本统计面板
- 集成: AgentDashboardPage 中嵌入 CostReviewPanel

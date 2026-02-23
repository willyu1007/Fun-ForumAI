# Roadmap — persistence-and-agent-dashboard (T-017)

## Goal
- 将全部业务数据从 InMemory 持久化到 PostgreSQL，构建 Agent Dashboard 和成本管理系统，为 T-018/T-019 养成和交互功能奠定基础。

## Planning-mode context and merge policy
- Runtime mode signal: Default
- User confirmation when signal is unknown: not-needed
- Host plan artifact path(s): (none)
- Requirements baseline: 用户在聊天中确认的需求
- Merge method: set-union
- Conflict precedence: latest user-confirmed > requirement.md > host plan artifact > model inference
- Repository SSOT output: `dev-docs/active/persistence-and-agent-dashboard/roadmap.md`
- Mode fallback used: non-Plan default applied: no

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | 聊天讨论 | 预算模型/多Agent限制/全量迁移 | highest | 全局池→免费+付费; 10 agents/人; Post/Comment 也迁移 |
| Existing codebase | prisma/schema.prisma, src/backend/repos/ | schema 基线 + repo 接口 | high | Room/RoomMessage 模型已存在但需对齐 |
| T-015 chat-room-v1 | dev-docs/archive/chat-room-v1/ | InMemory 实现参考 | high | 已完成并归档 |

## Non-goals
- XP/等级计算逻辑和升级事件（→ T-018）
- 特质系统业务逻辑（→ T-018）
- 信用体系业务逻辑（→ T-018，本任务只建表）
- 自定义指令匹配引擎（→ T-019）
- 风格/创建 UI（→ T-019）
- 用户付费网关
- 数据库集群/读写分离

## Open questions and assumptions
### Open questions (answer before execution)
- Q1: 是否需要数据库连接池配置调优？（当前 Prisma 默认即可）

### Assumptions (if unanswered)
- A1: 开发环境使用单节点 PostgreSQL，Prisma 默认连接池足够 (risk: low)
- A2: InMemory → Pg 切换通过环境变量控制，默认启用 Pg (risk: low)
- A3: 全局 token 池暂不设硬上限，仅做统计和展示 (risk: low)

## Scope and impact
- Affected areas/modules: prisma/schema.prisma, src/backend/repos/, src/backend/container.ts, src/backend/services/, src/frontend/
- External interfaces/APIs: 新增 Agent Dashboard API + Budget API; 现有 API 行为不变
- Data/storage impact: Prisma migration 新增 ~8 张表，修改 Room/RoomMessage 对齐
- Backward compatibility: InMemory repo 保留为 fallback，Pg 为默认

## Project structure change preview (may be empty)

### Existing areas likely to change
- Modify:
  - `prisma/schema.prisma` — 新增模型 + 对齐 Room/RoomMessage
  - `src/backend/repos/` — 新增 Pg 实现，修改 index.ts 导出
  - `src/backend/container.ts` — 切换到 Pg repos
  - `src/backend/services/chat-service.ts` — 接入 CostLog
  - `src/backend/runtime/runtime-loop.ts` — 接入 budget guard
  - `src/backend/services/conversation-clock.ts` — 接入 budget guard
  - `src/frontend/api/hooks.ts` — 新增 dashboard + budget hooks
  - `src/frontend/api/types.ts` — 新增 dashboard + budget 类型

### New additions (landing points)
- New module(s):
  - `src/backend/repos/pg/` — Pg repository 实现目录
  - `src/backend/services/budget-service.ts` — 预算管理服务
  - `src/backend/services/cost-tracker.ts` — 成本追踪服务
  - `src/backend/routes/agent-dashboard-api.ts` — Dashboard + Budget API 路由
  - `src/frontend/features/agents/components/AgentDashboard.tsx` — Dashboard 面板
  - `src/frontend/features/agents/components/CostReviewPanel.tsx` — 成本回顾面板

## Phases

1. **Phase 1**: Prisma Schema 扩展 + Migration
   - Deliverable: 完整的 schema 包含所有养成/成本/聊天模型，migration 成功运行
   - Acceptance criteria: `pnpm prisma migrate dev` 成功; schema 包含 AgentGrowth, AgentTrait, AgentInstruction, AgentBudget, CostLog, AgentCredit, CreditEvent, GrowthEvent 模型; Room/RoomMessage 对齐 T-015 InMemory 类型

2. **Phase 2**: Pg Repository 实现 + InMemory→Pg 切换
   - Deliverable: 所有实体的 Pg 仓库实现; Container 默认使用 Pg; 启动 hydration
   - Acceptance criteria: 现有功能（论坛 CRUD + 聊天室）在 Pg 模式下正常工作; 数据重启后持久

3. **Phase 3**: Agent Dashboard
   - Deliverable: activity-summary API + 前端 Dashboard 面板
   - Acceptance criteria: Dashboard 显示今日发言数/赞数/所在房间/论坛活动; SSE 推送状态更新

4. **Phase 4**: 成本管理系统
   - Deliverable: Budget/CostLog 服务 + 预算守卫 + 前端预算/成本面板
   - Acceptance criteria: 行动产生 CostLog 记录; 预算消耗到 90% 时降频; 100% 时停止主动发言; 成本回顾面板显示消耗分布

## Step-by-step plan (phased)

### Phase 1 — Prisma Schema 扩展 + Migration (~2h)
- Objective: 建立完整的持久化数据模型
- Deliverables:
  - 修改 `prisma/schema.prisma`: 新增 AgentGrowth, AgentTrait, GrowthEvent, AgentInstruction, AgentBudget, CostLog, AgentCredit, CreditEvent 模型
  - 对齐 Room 模型（新增 slug, description, community_id, created_by_agent_id, max_agents, tick_interval_base, last_message_at 字段）
  - 对齐 RoomMembership（新增 join_source, personal_tick_interval, messages_this_hour, last_spoke_at）
  - 对齐 RoomMessage（新增 message_kind, parent_message_id, vote_score）
  - 运行 `pnpm prisma migrate dev --name add-growth-budget-chat-models`
  - 更新 `docs/context/db/schema.json`
- Verification:
  - `pnpm prisma migrate dev` 零错误
  - `pnpm prisma generate` 成功
  - `pnpm tsc --noEmit` 通过
- Rollback: `pnpm prisma migrate reset` 回到上一版本

### Phase 2 — Pg Repository 实现 (~2.5h)
- Objective: 用 Prisma Client 实现所有实体的持久化仓库
- Deliverables:
  - `src/backend/repos/pg/pg-post-repository.ts`
  - `src/backend/repos/pg/pg-comment-repository.ts`
  - `src/backend/repos/pg/pg-room-repository.ts`
  - `src/backend/repos/pg/pg-message-repository.ts`
  - `src/backend/repos/pg/pg-agent-repository.ts`
  - `src/backend/repos/pg/pg-vote-repository.ts`
  - `src/backend/repos/pg/pg-event-repository.ts`
  - `src/backend/repos/pg/pg-community-repository.ts`
  - `src/backend/repos/pg/index.ts`
  - 修改 `src/backend/container.ts`: 按环境变量 `PERSISTENCE_MODE=pg|memory` 切换
  - 修改 `src/backend/app.ts`: 启动时初始化 Prisma Client
- Verification:
  - 启动服务, 创建帖子/评论/房间/消息, 重启后数据仍在
  - 论坛 + 聊天室全部现有功能正常
  - `pnpm tsc --noEmit` 通过
- Rollback: 切换 `PERSISTENCE_MODE=memory` 回退

### Phase 3 — Agent Dashboard (~2h)
- Objective: 让人类实时了解 Agent 当前状态和活动统计
- Deliverables:
  - `src/backend/routes/agent-dashboard-api.ts`:
    - `GET /v1/agents/:agentId/activity-summary` — 今日发言/赞/房间/论坛统计
    - `GET /v1/agents/:agentId/status` — 当前状态(在哪个房间/正在做什么)
  - `src/frontend/features/agents/components/AgentDashboard.tsx` — 活动面板
  - SSE 新增 AGENT_STATUS_CHANGED 事件类型
  - 修改 `src/frontend/features/agents/pages/AgentProfilePage.tsx` — 嵌入 Dashboard
- Verification:
  - Dashboard 显示聚合数据, 数值与实际行为一致
  - Agent 发言后 Dashboard 数据实时更新(SSE)
- Rollback: 删除新增路由和组件

### Phase 4 — 成本管理系统 (~2.5h)
- Objective: 追踪 Agent 行为成本，提供预算控制和成本回顾
- Deliverables:
  - `src/backend/services/budget-service.ts`:
    - 预算档位: 节能(20/天), 平衡(60/天), 全力(150/天), 自定义
    - `canAct(agentId)`: 返回 'allow' | 'soft-limit' | 'hard-limit'
    - `recordAction(agentId, actionType, tokensIn, tokensOut)`: 记录消耗
    - 每日/月自动重置
  - `src/backend/services/cost-tracker.ts`:
    - 在 AgentExecutor / ConversationClock 调用后记录实际 token 用量
    - 聚合统计(按天/按类型/按房间)
  - 修改 `src/backend/services/conversation-clock.ts`: handleTick 前检查 budgetGuard
  - 修改 `src/backend/runtime/runtime-loop.ts`: allocate 前检查 budgetGuard
  - `src/backend/routes/agent-dashboard-api.ts` (追加):
    - `GET /v1/agents/:agentId/budget` — 当前预算状态
    - `PATCH /v1/agents/:agentId/budget` — 调整预算档位
    - `GET /v1/agents/:agentId/cost-log` — 成本日志(分页+筛选)
    - `GET /v1/agents/:agentId/cost-summary` — 成本统计摘要
  - `src/frontend/features/agents/components/CostReviewPanel.tsx` — 消耗分布 + 趋势
  - `src/frontend/features/agents/components/BudgetTierSelector.tsx` — 预算档位选择器
- Verification:
  - Agent 发言后 CostLog 有记录
  - 达到日预算 90% 后 tick interval 翻倍
  - 达到 100% 后停止主动发言, SSE 广播"能量耗尽"
  - 成本面板显示正确分布
- Rollback: 移除 budget guard 检查回到无限制模式

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm tsc --noEmit` 零错误
  - `pnpm lint` 零回归
- Automated tests:
  - Pg Repository 基础 CRUD 测试
  - Budget guard 逻辑测试
- Manual checks:
  - 完整 seed → 重启 → 数据持久
  - Dashboard 数据与实际行为一致
  - 预算耗尽 → 降频 → 次日重置
- Acceptance criteria:
  - 所有 InMemory 数据可持久化到 Postgres
  - Agent Dashboard 实时展示活动状态
  - 成本预算系统工作（追踪 + 限制 + 回顾）
  - 现有功能零回归

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|:---:|:---:|---|---|---|
| InMemory→Pg 切换引入数据不一致 | medium | high | 接口不变, Pg 实现逐一对齐 InMemory 行为; 保留 InMemory fallback | typecheck + 手动 CRUD 测试 | PERSISTENCE_MODE=memory |
| Prisma migration 与现有数据冲突 | low | high | dev 环境先 migrate reset; 生产用 migrate deploy | migration 报错 | prisma migrate reset |
| Room schema 对齐遗漏字段 | medium | medium | 逐字段对比 InMemory types.ts 与 Prisma model | typecheck | 补充 migration |
| Budget guard 误拦正常行为 | low | medium | soft-limit 只降频不阻断; hard-limit 有手动追加入口 | 观察 Agent 行为 | 禁用 guard |

## Optional detailed documentation layout (convention)
```
dev-docs/active/persistence-and-agent-dashboard/
  roadmap.md
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

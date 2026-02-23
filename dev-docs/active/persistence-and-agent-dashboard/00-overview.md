# 00 Overview — persistence-and-agent-dashboard (T-017)

## Status
- State: planned
- Next step: 扩展 Prisma schema（Growth/Trait/Instruction/Budget/Credit/CostLog + Room/ChatMessage 对齐）并运行 migration

## Goal
将全部业务数据从 InMemory 迁移到 PostgreSQL 持久化存储，并构建 Agent Dashboard（活动面板）和成本管理系统。这是养成系统（T-018）和交互增强（T-019）的基础设施前置任务。

## Non-goals
- XP/等级计算逻辑（→ T-018）
- 特质获取/装备逻辑（→ T-018）
- 自定义指令 CRUD 和匹配引擎（→ T-019）
- 风格控制面板 UI（→ T-019）
- 引导式创建向导（→ T-019）
- 用户付费/计费网关集成（远期）
- WebSocket 升级

## Context
当前系统所有业务数据（Post/Comment/Room/ChatMessage/Agent 等）使用 InMemory Repository。Prisma schema 已存在基础模型（Agent, Post, Comment, Vote, Room, RoomMembership, RoomMessage），但：
- Room/RoomMessage 的 Prisma 模型是占位符，与 T-015 实现的 InMemory 类型不完全对齐
- 缺少 Growth、Trait、Instruction、Budget、CostLog、Credit 等养成/成本模型
- 缺少 Agent Dashboard API 和前端
- 没有成本追踪和预算控制机制
- AgentRun 已有 token_cost 字段，可以复用

## Acceptance criteria (high level)
- [ ] Prisma schema 包含所有养成/成本/聊天模型，migration 成功
- [ ] 所有 InMemory Repository 有对应的 Pg 实现，Container 可切换
- [ ] 服务重启后数据不丢失（Room/Message/Post/Comment/Growth/Budget）
- [ ] Agent Dashboard API 返回聚合活动数据（今日发言/赞/所在房间/论坛活动）
- [ ] Agent Dashboard 前端面板可显示当前状态和活动统计
- [ ] 成本预算系统工作：创建 Agent 时设定预算档位，行动消耗计入，达到上限时降频/停止
- [ ] 成本回顾面板可查看消耗分布和趋势
- [ ] typecheck + lint 零回归
- [ ] 现有论坛和聊天室功能不受影响（InMemory→Pg 透明切换）

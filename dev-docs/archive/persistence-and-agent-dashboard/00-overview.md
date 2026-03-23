# 00 Overview — persistence-and-agent-dashboard (T-017)

## Status
- State: done
- All 4 phases implemented, TypeScript compiles clean

## Goal
将全部业务数据从 InMemory 迁移到 PostgreSQL 持久化存储，并构建 Agent Dashboard（活动面板）和成本管理系统。这是养成系统（T-018）和交互增强（T-019）的基础设施前置任务。

## Non-goals
- XP/等级计算逻辑（→ T-018）
- 特质获取/装备逻辑（→ T-018）
- 自定义指令 CRUD 和匹配引擎（→ T-019）
- 风格控制面板 UI（→ T-019）

## Outcome Snapshot
- Prisma schema 包含所有养成/成本/聊天模型，migration 成功
- 所有 InMemory Repository 有对应的 Pg 实现，Container 可切换
- 服务重启后数据不丢失（Room/Message/Post/Comment/Growth/Budget）
- Agent Dashboard API 返回聚合活动数据（今日发言/赞/所在房间/论坛活动）
- Agent Dashboard 前端面板可显示当前状态和活动统计

# 00 Overview

## Status
- State: done
- All acceptance criteria met; typecheck + lint + 252 tests pass.

## Goal
- 构建 Service + Repository 层，将 13 个 501 路由端点替换为可工作的 CRUD 实现。
- 串联 T-007（写入守卫）、T-008（事件分配器）、T-009（审核管线）进入真实写入路径。
- 使整个后端 API 从"脚手架"升级为"可功能测试的服务"。

## Non-goals
- 不对接 PostgreSQL / Prisma Client（本任务使用 InMemory Repository；DB 对接为后续任务）。
- 不实现 Agent Runtime（LLM 调用）。
- 不实现前端页面。
- 不实现聊天室业务逻辑（rooms/messages 端点保留 501）。

## Context
- 前置任务已完成：路由脚手架(T-003)、认证中间件(T-007)、事件分配器(T-008)、审核管线(T-009)。
- 当前所有业务路由返回 501；本任务填充实现使 API 可端到端工作。
- 遵循 T-003 architecture 中定义的分层原则：Routes → Services → Repositories。

## Execution lane mapping
- Primary lane: Lane A（Shared Backend）
- Dependency: T-003 + T-007 + T-008 + T-009（全部已完成）

## Acceptance criteria (high level)
- [x] Repository 接口定义 + InMemory 实现覆盖 6 个实体（Post, Comment, Vote, Agent, Community, Event/AgentRun）。
- [x] Service 层覆盖：ReadService（feed/post/comments）、WriteService（create post/comment/vote + moderation）、AgentService（CRUD + config）、GovernanceService（治理动作 + 审核队列）。
- [x] Read API 6 个端点全部返回真实数据（非空数组或 501）。
- [x] Data Plane 3 个核心端点（posts/comments/votes）经过 moderation 后落库。
- [x] Control Plane 7 个端点全部可工作（5 implemented, 2 remain 501 for membership + achievements）。
- [x] 端到端集成测试：HTTP → route → service → moderation → repository。
- [x] typecheck ✓, lint ✓, 全量测试通过（252 tests across 28 files）。

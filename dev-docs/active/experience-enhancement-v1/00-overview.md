# 00 Overview

## Status
- State: planned
- Next step: Phase 1 — Agent 自主发帖调度

## Goal
- 提升 AI 论坛的自主性和用户体验：Agent 能主动发起话题、前端实时展示 Runtime 状态、新内容实时推送、数据持久化不丢失。

## Non-goals
- 不实现多 LLM provider 路由（Qwen 兼容 API 已足够）。
- 不实现用户自定义 Agent（仍由管理员通过 Control Plane 管理）。
- 不实现生产级消息队列（InMemory EventQueue 继续使用）。
- 不实现移动端适配（Web 优先）。

## Context
- Agent Runtime v1 已完成：事件 → 分配 → LLM 调用 → 内容写入全链路跑通。
- 当前 Agent 仅能**响应事件**（新帖/新评论），不能主动发帖。
- 前端已有 Feed/帖子/评论展示，但无 Runtime 状态可视化。
- 所有数据存储在 InMemory，重启即丢失。

## Acceptance criteria (high level)
- [ ] Agent 可按调度计划自主发帖（不依赖外部事件触发）。
- [ ] 前端可查看 Runtime 运行状态（队列大小、最近执行、成功/失败率）。
- [ ] 新内容产生时前端自动刷新（无需手动刷新页面）。
- [ ] 服务重启后 seed 数据和 Agent 生成内容不丢失（PostgreSQL 持久化）。
- [ ] typecheck + lint 零回归。

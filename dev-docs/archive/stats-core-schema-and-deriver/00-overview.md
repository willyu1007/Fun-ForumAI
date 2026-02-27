# 00 Overview — stats-core-schema-and-deriver (T-040)

## Status
- State: done
- Next step: archive

## Goal
建立 Stats 中枢基础层：独立数据模型、不可重置加点、统一派生参数服务和 owner-only API。

## Non-goals
- 不接入 allocator/chat/relation/vote 行为层
- 不做 Web 面板
- 不改 Runtime action 协议

## Context
现有成长/特质/指令/记忆/关系能力已存在，但缺统一的 Stats Base/State/Derived 中枢。

## Acceptance criteria (high level)
- [x] Prisma 模型与迁移完成（AgentStats/AgentState/AgentStatEvent）
- [x] owner-only Stats API 可用（读/预览/分配/事件/派生）
- [x] 加点不可重置，且支持 idempotency_key 防重放
- [x] 分段步长（4/3/1）与能力步长（2）生效
- [x] flags 关闭时零行为变化

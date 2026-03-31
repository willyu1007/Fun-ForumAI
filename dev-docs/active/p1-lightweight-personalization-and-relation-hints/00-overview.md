# 00 Overview — p1-lightweight-personalization-and-relation-hints (T-138)

## Status

- State: planned
- Depends on: `T-135`, `T-137`
- Next step: 冻结轻量 PPR 候选池、relation hints 与首发后 1-2 周的最小个性化范围。

## Goal

在不等待完整 PPR 的前提下，为首发后 1-2 周补上“不同用户看到的世界略有区别”的最小能力。

## Non-goals

- 不做完整个性化探索系统。
- 不在本任务中推出完整关系图前台。

## Context

发布文档已明确：首发先靠编辑化 shelf 与 relation hints 工作，PPR 候选池和关系显性化在首发后快速补齐。

## Acceptance Criteria

- [ ] 明确 `viewer_agent_id / follow / relation context` 的最小分发使用方式。
- [ ] 明确 Agent 卡片关系 hint、主线关系变化标签、aftershow 关系摘要。
- [ ] 明确离线候选池试运行与上线门槛。

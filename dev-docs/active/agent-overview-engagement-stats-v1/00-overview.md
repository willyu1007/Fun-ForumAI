# 00 Overview — agent-overview-engagement-stats-v1

## Status

- State: in-progress
- Governance mapping: 主项目临时实现任务；本轮只覆盖 agent 概览页统计区的真实互动数据扩展和样式收紧。
- Current status: 已扩展 `public_stats`，现在会真实聚合该 agent 名下公开 `post / thread / turn` 收到的 agent/human 点赞与点踩；概览统计区已接入新增数据，并把数值字号从偏大的展示收回到更紧凑的层级。
- Next step: 根据实际页面再判断统计区是否需要进一步重排，尤其是 7 项数据在不同宽度下的阅读密度。

## Goal

让 agent 概览页统计区展示真实互动反馈，而不是只展示发言和关注关系。

## Non-goals

- 不改动点赞/点踩写入链路。
- 不新增独立接口；优先复用现有 `/v1/agents/:agentId/profile` 的 `public_stats`。
- 不在本轮重做统计区整体布局，只做必要的显示调整。

## Acceptance Criteria

- `public_stats` 新增 agent/human vote up/down 聚合字段。
- `/v1/agents/:agentId/profile` 返回真实票数。
- 概览统计区接入真实票数，并下调当前过大的数字字号。
- 相关测试和 typecheck 通过。

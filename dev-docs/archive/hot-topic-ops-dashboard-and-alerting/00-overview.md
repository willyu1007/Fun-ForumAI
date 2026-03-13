# 00 Overview — hot-topic-ops-dashboard-and-alerting (T-093)

## Status
- State: done
- Next step: 已归档；若后续要做更复杂的运营工作流或告警持久化，另开 follow-up。

## Goal
补齐热点运营面板与告警，让管理员可以直接看到热度、漂移、举报量、linked case，并对帖子和房间执行热点分发控制。

## Non-goals
- 不重写热点策略判定；这些仍归 `T-091`。
- 不做告警 ack/历史持久化。
- 不把社区级配置提案绕过现有 config proposal/apply 链路。

## Context
- `forum-audit.md` Phase 3 还要求热点后台、推荐控制和指标式运营面。
- repo 在本轮前缺热点 dashboard / alerts API，也没有针对帖子/房间的热度控制入口。

## Acceptance criteria (high level)
- [x] 新增 dashboard / alerts / post distribution / room control API。
- [x] dashboard 返回 `topic_domain`、`hot_score`、`drift_risk_score`、`report_count_24h`、`distribution_state`、`restriction_state`、`sampled_review_required`、`linked_case_id`。
- [x] `AdminPanel` 新增 hot-topic tab、告警列表、帖子 `NO_RECOMMEND` 切换与房间控制。
- [x] 告警严重度与热度阈值按固定规则派生，并有 API/UI 测试与 UI gate 证据。

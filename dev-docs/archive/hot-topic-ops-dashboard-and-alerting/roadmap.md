# Roadmap — hot-topic-ops-dashboard-and-alerting (T-093)

## Goal
- 为热点治理提供可操作的运营后台与实时告警，不再依赖手填对象 ID 的裸治理流。

## Planning baseline
- Milestone: `M-010 Mainland Launch Safety`
- Feature: `F-050 Risk Control & Review Launch Track`
- Requirement: `R-053 Hot Topic Policy and User Transparency`

## Scope
- `GET /v1/admin/hot-topic/dashboard`
- `GET /v1/admin/hot-topic/alerts`
- `POST /v1/admin/hot-topic/posts/:postId/distribution`
- `POST /v1/admin/hot-topic/rooms/:roomId/control`
- `AdminPanel` hot-topic tab、告警列表、帖子/房间控制

## Locked decisions
- 告警按实时派生实现，不做 ack/已读历史。
- 帖子折叠/隔离继续复用既有 moderation action；本任务只负责热度相关 control。
- 布局必须通过 UI governance gate。

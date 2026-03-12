# 03 Implementation Notes

## Current status
- 状态：implemented-in-repo
- 说明：
  - 新增 `ReviewService`、`ComplaintAppealService` 与治理仓储
  - `POST/GET /v1/reports`、`POST/GET /v1/appeals` 已可用
  - admin moderation queue / case detail / assign / resolve / reopen / identity review 已接 API 与最小前端
  - governance action log、policy snapshot、evidence snapshot 已持久化
  - review fix：`reports/appeals` 现在只接受 allowlist target type，并在建 ticket/case 前校验 target 是否存在

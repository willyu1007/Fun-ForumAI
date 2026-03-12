# 00 Overview — review-case-and-complaint-foundation (T-089)

## Status
- State: in-progress
- Next step: 补投诉/申诉状态变更通知、更多 case 操作与更细粒度 evidence 展示；最小闭环已落 repo。

## Goal
建立最小可运营的 review/case/complaint 基础设施，让高风险判定、被举报内容和身份审核都进入统一 case 模型。

## Acceptance criteria (high level)
- [x] `policy_snapshots`、`moderation_cases`、`review_tasks`、`complaint_tickets`、`appeal_requests` 落地。
- [x] `POST /v1/reports` 与 `POST /v1/appeals` 可用。
- [x] admin queue / case detail / manual identity review 最小 UI/API 可用。

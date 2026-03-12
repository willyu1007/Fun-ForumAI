# 00 Overview — review-case-and-complaint-foundation (T-089)

## Status
- State: done
- Next step: `T-089` 的 shared foundation 已完成；后续 launch track 仅继续推进 `T-090` / `T-091`，若再追加 bulk tooling 则另立 follow-up。

## Goal
把 T-089 重定为大陆首发 shared foundation：以 case 为中心承载 review、complaint、appeal、deletion/privacy request、identity review 与后续 operator workflow，使投诉、申诉、删除请求和人工复核都进入统一治理域。

## Non-goals
- 不承载 provenance、`public_disclosure_cap`、config review 与 agent risk profile，这些归 `T-090`。
- 不承载 hot-topic policy、kill switch、推荐降权与用户透明文案编排，这些归 `T-091`。
- 不重写 `T-088` 的 channel enforcement 主链路；`T-089` 只消费其产出的 policy/risk evidence 并向后续治理流收敛。

## Context
- repo 已落 `policy_snapshots`、`moderation_cases`、`review_tasks`、`complaint_tickets`、`appeal_requests`、`ReviewService`、`ComplaintAppealService`、`POST/GET /v1/reports`、`POST/GET /v1/appeals` 与 admin moderation queue/case detail 最小 UI/API。
- 现状仍是 MVP：case 缺 queue/SLA/claim/resolution contract，evidence 仍偏 `snapshot_type + payload`，`reports/appeals` 仍是 generic facade，删除/隐私/冒充/误标诉求和状态通知未进入统一 typed workflow。
- 审计文档要求 `T-089` 作为 shared foundation 覆盖 `case layer + review task + action log + complaint/appeal/delete/privacy`，并与 `T-090` / `T-091` 保持边界。

## Acceptance criteria (high level)
- [x] repo baseline 已提供最小 case/review/complaint/appeal 闭环与治理仓储、接口、最小 queue/case UI。
- [x] 文档已冻结“每次 moderation outcome 独立 `policy_snapshot`，不得跨对象复用审计实体”的原则。
- [x] `ModerationCase` / `ModerationCaseTarget` / `ModerationEvidenceSnapshot` / `ReviewTask` 的 full-foundation 合同落定并实现：queue、SLA、claim/lock、resolution metadata、`relation_type`、structured evidence package。
- [x] `ComplaintTicket` / `AppealRequest` 升级为 typed workflow，覆盖 content report、privacy/deletion、impersonation、mislabel 等首发诉求；`/v1/reports`、`/v1/appeals` 仅作为兼容 facade。
- [x] admin moderation surfaces 升级到队列分类、claim/transfer/reopen/resolve、complaint/appeal panel、case detail tabs、evidence export。
- [x] user surfaces 覆盖 post/comment/chat/private/proactive 举报入口、Safety Center 状态时间线、治理状态变更通知。
- [x] open-case uniqueness、complaint-driven reopen、appeal reversal、delete/privacy request case 化、action log 强制落库有测试和验收证据。

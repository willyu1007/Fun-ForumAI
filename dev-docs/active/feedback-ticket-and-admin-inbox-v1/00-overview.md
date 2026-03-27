# 00 Overview — feedback-ticket-and-admin-inbox-v1 (T-919)

## Status

- State: in-progress
- Depends on: `T-089 review-case-and-complaint-foundation`
- Next step: 建立 `FeedbackTicket` 独立数据域与 API/页面骨架，随后补管理员处理、通知和受保护截图读取。

## Goal

新增一条独立于举报/申诉的“意见反馈”产品链路：用户可提交反馈和截图，管理员可在 `/admin` 查看并处理，用户可在 `/feedback` 与 bell 通知中看到反馈状态与公开处理结论。

## Non-goals

- 不把意见反馈并入 `/safety` 或 complaint / appeal / moderation case 主流程。
- 不支持匿名或游客提交。
- 不做双向对话线程、管理员指派/SLA、邮件/短信推送。
- 不复用 agent media 生命周期，也不让反馈截图进入公开媒体展示链路。

## Context

仓库中已经存在完整的举报/申诉/管理员审核链路：

- 用户侧：`/v1/reports`、`/v1/appeals`、`/safety`
- 管理侧：`/v1/admin/moderation/*`、`/admin`
- 数据层：`ComplaintTicket`、`AppealRequest`、`ModerationCase`

但这些能力都围绕 target-based 的治理语义，不适合作为产品意见箱直接复用。本任务锁定以下产品口径：

- 独立 `/feedback` 页面，不并入 `/safety`
- 独立 `FeedbackTicket` 域模型，不复用 complaint/case 主流程
- 登录用户可提交，分类固定为 `PRODUCT_SUGGESTION | BUG_REPORT | UX_ISSUE | OTHER`
- 支持最多 3 张截图，仅限图片类型，用户可见状态与公开处理结论
- 管理员通过 `/admin` 新 top-level tab 查看和处理
- 导航入口常驻资源区，并补到账户菜单、帮助页和首页快捷入口
- 状态变化进入页内历史与 bell 通知

## Acceptance Criteria

- [ ] 登录用户可从 `/feedback` 提交反馈，支持分类、标题、正文和截图。
- [ ] 用户只能读取自己的反馈及附件，admin 可读取全部并修改状态/公开结论/内部备注。
- [ ] bell 在反馈状态或公开处理结论变化时产生 `FEEDBACK` 通知，并跳转到 `/feedback?ticketId=<id>`。
- [ ] `/admin` 新增独立“意见箱”tab，可按状态/分类查看反馈并完成处理。
- [ ] `/safety`、举报申诉和 moderation queue 不被混入 FeedbackTicket 语义。

# Roadmap — feedback-ticket-and-admin-inbox-v1 (T-919)

## Summary

为论坛补齐独立的用户意见反馈链路：登录用户可在 `/feedback` 提交产品建议 / Bug / UX 问题并附截图，管理员可在 `/admin` 的独立“意见箱”tab 查看、处理并回写公开结论，用户再通过历史页与通知中心收到状态更新。

## Milestones

1. 任务与治理建包：`[in-progress]`
2. 数据模型、附件链路、用户/管理员 API 与通知语义：`[pending]`
3. `/feedback` 页面、导航入口、用户历史与通知跳转：`[pending]`
4. `/admin` 意见箱 tab、状态流转、回归与 polish：`[pending]`

## Risks

- 该功能跨 Prisma schema、受保护附件读写、站内通知、前后端导航与 admin UI，任何一层复用错现有 complaint/media 链路都会把反馈语义污染成举报或 agent media。
- 附件是用户上传截图，必须在类型、大小、数量、权限和读取路径上 fail-closed，否则会引入未授权文件读取或公开泄露。
- `/admin` 已有 moderation/runtime 入口，本轮必须新增独立 top-level tab，而不是把意见箱塞进已有 case queue，避免产品心智混淆。

## Rollback

- `/feedback` 独立为新路由和新 API；如回退，仅需移除新入口与新表访问，不影响 `/safety`、投诉申诉和 moderation queue 既有链路。
- 新通知类型保持 additive；若 bell 展示异常，可单独降级 `FEEDBACK` 渲染，而不影响现有 `GOVERNANCE` 与系统通知。
- 数据层使用独立 `FeedbackTicket` / `FeedbackAttachment`，不污染 complaint/case 既有表结构，便于局部回退。

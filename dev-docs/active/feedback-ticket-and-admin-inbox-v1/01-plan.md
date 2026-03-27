# 01 Plan

## Phases

1. Phase A: 建立 `T-919` 任务包并同步 project governance。`[in-progress]`
2. Phase B: 新增 `FeedbackTicket` / `FeedbackAttachment` schema、repo、service、受保护附件链路与用户/admin API。`[pending]`
3. Phase C: 新增 `/feedback` 页面、导航入口、用户历史和 bell 通知跳转。`[pending]`
4. Phase D: 扩展 `/admin` 新 top-level tab、状态流转与公开处理结论编辑。`[pending]`
5. Phase E: 跑 schema/type/tests/gov sync，更新任务文档并整理残余风险。`[pending]`

## Detailed Steps

- 先建立标准 dev-docs bundle，运行治理 `sync --apply` / `lint --check`，把任务注册到 `M-000 > F-000`。
- 在 `prisma/schema.prisma` 新增 `FeedbackCategory`、`FeedbackStatus`、`FeedbackTicket`、`FeedbackAttachment` 及必要关联字段，并生成 migration 预览与 DB context 刷新。
- 增加 feedback repository / service / route：提交、我的反馈列表、详情、受保护附件读取、管理员列表/详情/更新。
- 新增 `FEEDBACK` notification type，并确保只有 `status` 或 `public_resolution_note` 变化时才给用户发通知。
- 新增 `/feedback` 页面，拆成“提交反馈”和“我的意见”，并接入账户菜单、左侧资源区、首页右侧快捷区、帮助页入口。
- 为 `/admin` 新增“意见箱”tab，采用列表 + 详情布局，支持筛选、查看截图、更新状态/公开结论/内部备注。
- 运行 targeted tests、typecheck、schema validation、前端页面测试与 governance lint，并把结果记入 `04-verification.md`。

## Acceptance Scenarios

- 用户从帖子页打开“意见反馈”，提交一条 `UX_ISSUE` + 2 张截图，随后在“我的意见”里看到 `RECEIVED`。
- admin 在 `/admin` 将其改为 `PLANNED` 并填写公开结论“已纳入下个迭代”。
- 用户在 bell 和 `/feedback` 历史里都看到状态更新与结论。
- `/safety` 仍只显示举报申诉，不出现 FeedbackTicket。

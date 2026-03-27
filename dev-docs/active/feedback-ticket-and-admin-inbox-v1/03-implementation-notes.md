# 03 Implementation Notes

## Status

- Current status: `feature-implemented`
- Last updated: 2026-03-27

## What changed

- 建立并注册 `T-919` 标准任务包，完成 governance sync/lint。
- Prisma schema 新增 `FeedbackTicket`、`FeedbackAttachment`、`FeedbackTicketHistoryEntry` 及配套枚举，并把 `NotificationType` 扩展为 `FEEDBACK`。
- 后端新增 feedback repo/service/user admin routes，覆盖：
  - 登录用户提交反馈
  - 当前用户查看自己的列表/详情
  - 受保护附件读取
  - admin 列表/详情/状态更新
- 用户侧新增 `/feedback` 页面，包含：
  - 提交表单
  - 我的意见列表
  - 详情、截图、处理时间线
- 管理员侧在 `/admin` 新增“意见箱”tab，包含：
  - 列表与筛选
  - 详情、截图、公开结论、内部备注
  - 状态流转与保存
- 导航与入口完成接入：
  - 账户菜单
  - 左侧资源区
  - 首页右侧快捷区
  - 帮助中心
  - `/safety` cross-link
- bell 已支持 `FEEDBACK` 类型图标、排序和 `/feedback?ticketId=...` 跳转。

## Files/modules touched (high level)

- `prisma/schema.prisma`
- `docs/context/db/schema.json`
- `src/backend/repos/feedback-repository.ts`
- `src/backend/repos/pg/pg-feedback-repository.ts`
- `src/backend/services/feedback-service.ts`
- `src/backend/routes/read-api.ts`
- `src/backend/routes/admin-api.ts`
- `src/backend/validation/schemas.ts`
- `src/frontend/features/user/pages/FeedbackPage.tsx`
- `src/frontend/features/admin/pages/admin-panel/FeedbackInboxTab.tsx`
- `src/frontend/widgets/shell/*`
- `src/frontend/features/help/pages/PolicyPages.tsx`
- `src/frontend/features/user/pages/SafetyCenterPage.tsx`
- `src/backend/services/__tests__/feedback-service.test.ts`
- `src/frontend/features/user/pages/__tests__/FeedbackPage.test.tsx`
- `src/frontend/features/admin/pages/admin-panel/__tests__/FeedbackInboxTab.test.tsx`
- `src/frontend/widgets/shell/__tests__/*`

## Decisions & Tradeoffs

- Decision:
  - 反馈截图走独立受保护附件链路，而不是复用现有 media 域。
  - Rationale:
    - 现有 media 写路径围绕 agent/private session 生命周期设计，直接复用会引入错误权限和错误领域语义。
  - Alternatives considered:
    - 复用 complaint 附件或 agent media 上传；都会造成领域与权限边界混淆。
- Decision:
  - V1 将附件落在 feedback 专用 DB blob 存储，而不是单独引入文件系统/S3 适配层。
  - Rationale:
    - 更快闭合权限、读取和测试链路，且不会误接入公开 media 生命周期。
  - Alternatives considered:
    - 新建独立对象存储适配层；长期更灵活，但超出本轮 MVP 所需范围。
- Decision:
  - admin 详情时间线返回完整 history，不过滤 `ADMIN_ONLY` 事件。
  - Rationale:
    - 内部备注如果不进入 admin 时间线，管理员无法审计自己的处理轨迹。

## Deviations from Plan

- 附件存储实现没有拆出单独 `FeedbackAttachmentStorage` 服务，而是由 repo/service 组合落到 feedback 专用 DB 表内完成。
- Prisma 迁移没有通过一次干净的 `migrate dev --create-only` 生成，而是通过修复历史 migration replay 问题后，补了一条 schema reconciliation migration：`20260327111000_feedback_ticket_and_schema_reconciliation`。

## Known issues / follow-ups

- 全仓 `pnpm exec tsc -b --pretty false` 仍有一批与 feedback 无关的历史错误；本次已确认无 feedback 相关诊断残留。
- 当前 repo migration 链已可在 shadow DB cleanly replay，并与 `prisma/schema.prisma` 对齐；当前本地 `llm_forum_dev` 仍然落后于后续 33 条 pending migrations，因此本地环境若要继续 `migrate dev`，需要先把数据库迁移到当前链头或重建 dev DB。
- 若后续要把附件迁到对象存储，可保留现有 `storage_key` 对外契约并在 repo 层替换读取实现。

## Pitfalls / dead ends (do not repeat)

- Keep the detailed log in `05-pitfalls.md` (append-only).

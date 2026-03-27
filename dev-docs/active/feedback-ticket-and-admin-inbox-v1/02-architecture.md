# 02 Architecture

## Context & Current State

- 现有投诉/申诉链路基于 `ComplaintTicket` / `AppealRequest` / `ModerationCase`，依赖 target-based 治理语义，不适合承载泛产品反馈。
- 现有 agent/private media 上传链路与 agent owner / private channel 生命周期耦合，不能直接复用来存用户反馈截图。
- bell 已有 `GOVERNANCE` / `SYSTEM` 等站内通知类型，但没有独立的 feedback 语义与跳转逻辑。
- `/admin` 现有 top-level tab 聚焦治理操作、Hot Topic 与 Runtime，没有独立的用户意见处理入口。

## Proposed Design

### Components / modules

- `FeedbackTicket` / `FeedbackAttachment`
  - 独立 persisted model，和 complaint/case 完全分离。
  - `FeedbackTicket` 存提交人与管理员处理元数据。
  - `FeedbackAttachment` 存受保护截图元数据、存储键与 DB 内二进制内容。
- `FeedbackTicketHistoryEntry`
  - 独立保存用户可见与管理员私有时间线事件。
  - 用于驱动 `/feedback` 历史和 `/admin` 处理轨迹。
- `FeedbackRepository`
  - 提供用户侧列表/详情、admin 列表/详情、状态更新与附件读取。
- `FeedbackService`
  - 负责创建反馈、附件校验、状态流转约束、详情组装和用户可见变更判定。
- Protected attachment storage
  - V1 直接由 feedback repo 负责 DB-backed 受保护附件读写，不挂到现有 media 领域。
- `NotificationService`
  - 扩展 `FEEDBACK` 语义，只有用户可见字段变化时发通知。
- Frontend `/feedback`
  - 提交表单 + 我的意见历史 + ticket detail focus。
- Frontend `/admin`
  - 新 top-level “意见箱”tab，列表 + 详情 + 编辑区。

### Interfaces & Contracts

- User API:
  - `POST /v1/feedback`
  - `GET /v1/feedback`
  - `GET /v1/feedback/:id`
  - `GET /v1/feedback/attachments/:attachmentId`
- Admin API:
  - `GET /v1/admin/feedback`
  - `GET /v1/admin/feedback/:id`
  - `PATCH /v1/admin/feedback/:id`
- Shared types:
  - `FeedbackCategory`
  - `FeedbackStatus`
- `FeedbackTicketSummary`
- `FeedbackTicketDetail`
- `AdminFeedbackTicketDetail`
- `FeedbackHistoryEntry`

### Boundaries & Dependency Rules

- feedback 不接入 complaint / appeal / moderation case 主流程，也不复用其 status 语义。
- 反馈截图采用独立受保护读写，不进入 agent media 的生成、审计、公开展示或语义摘要路径。
- 业务层保持 Prisma-free；repo 负责 Prisma ↔ domain 的映射。
- `FEEDBACK` 通知只复用 bell 渲染与私有通知存储，不复用 `GOVERNANCE` 类型和跳转语义。

## Data Model

- `FeedbackCategory`
  - `PRODUCT_SUGGESTION | BUG_REPORT | UX_ISSUE | OTHER`
- `FeedbackStatus`
  - `RECEIVED | UNDER_REVIEW | PLANNED | CLOSED`
- `FeedbackTicket`
  - `id`
  - `created_by_user_id`
  - `category`
  - `title`
  - `body`
  - `entry_surface`
  - `source_route`
  - `status`
  - `public_resolution_note`
  - `internal_note`
  - `updated_by_user_id`
  - `created_at`
  - `updated_at`
- `FeedbackAttachment`
  - `id`
  - `feedback_ticket_id`
  - `storage_key`
  - `mime_type`
  - `file_size_bytes`
  - `width`
  - `height`
  - `blob_data`
- `FeedbackTicketHistoryEntry`
  - `id`
  - `feedback_ticket_id`
  - `actor_user_id`
  - `visibility`
  - `event_type`
  - `from_status`
  - `to_status`
  - `message`
  - `created_at`

## Data Migration

- Prisma SSOT 改动仅新增枚举与表，不修改 complaint/case 既有结构。
- 通过 `prisma migrate dev --create-only` 生成 reviewable migration 预览；真实 DB apply 需单独审批。
- schema 更新后同步刷新 `docs/context/db/schema.json`。

## Non-functional Considerations

- Security/auth/permissions:
  - 创建反馈需要登录。
  - 用户只能读自己的 ticket 与附件。
  - admin 才能列出全部反馈、查看全部附件和更新状态。
- Performance:
  - 附件读取走按 id 的受保护端点；列表接口返回缩略元数据，不返回大体积二进制。
  - admin 列表默认按 `status != CLOSED` 优先，再按 `updated_at desc`。
- Observability:
  - 关键状态流转和附件拒绝原因写入服务日志。
  - 验证阶段覆盖通知触发和权限分支。

## Open Questions

- 无。产品决策与首版边界已锁定。

# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)

- 反馈链路不能复用 complaint/case 的 target-based 语义，也不能把 `/feedback` 混入 `/safety`。
- 截图上传不能复用 agent/private media 生命周期；权限和读取路径必须独立 fail-closed。
- `FEEDBACK` 通知只能在用户可见字段变化时触发，不能因为内部备注更新而打扰用户。

## Pitfall log (append-only)

### 2026-03-27 - Task bootstrap before code
- Symptom:
  - 需求同时跨 Prisma schema、受保护附件、通知、导航和 admin UI，若先写代码再补文档，范围很容易漂移。
- Context:
  - 本任务满足 `dev-docs` complex-task gate，且用户先明确要求“完整任务包”再实施。
- What we tried:
  - 在编码前先建立标准 bundle，把边界、状态流转、验证口径和非目标写死。
- Why it failed (or current hypothesis):
  - N/A
- Fix / workaround (if any):
  - 保持标准 task bundle 在先，后续每个 phase 完成后及时更新 implementation notes 与 verification。
- Prevention (how to avoid repeating it):
  - 继续以 `00-overview / 01-plan / 02-architecture / 04-verification` 作为实现边界，不在代码阶段临时发散到双向工单、SLA 或匿名反馈。
- References (paths/commands/log keywords):
  - `dev-docs/AGENTS.md`
  - `dev-docs/active/feedback-ticket-and-admin-inbox-v1/*`

### 2026-03-27 - Admin detail accidentally filtered out admin-only history
- Symptom:
  - `PATCH /v1/admin/feedback/:id` 写入了 `INTERNAL_NOTE_UPDATED`，但 admin 详情时间线里看不到对应记录。
- Context:
  - `toAdminDetailView()` 复用了用户侧 detail 组装逻辑，而用户侧会过滤 `visibility !== USER` 的历史项。
- What we tried:
  - 先在服务层测试里断言 admin detail 应包含内部备注事件，随后定位到 `toUserDetailView()` 被错误复用。
- Why it failed (or current hypothesis):
  - admin detail 和 user detail 的历史可见性边界不一样，不能共用同一层过滤结果。
- Fix / workaround (if any):
  - `toAdminDetailView()` 改为从 summary view 出发，单独映射完整 history。
- Prevention (how to avoid repeating it):
  - 后续凡是存在 `visibility` / `audience` 字段的 detail DTO，都要分别测试 user/admin 两种视图。
- References (paths/commands/log keywords):
  - `src/backend/services/feedback-service.ts`
  - `src/backend/services/__tests__/feedback-service.test.ts`

### 2026-03-27 - Prisma create-only migration blocked by existing shadow-db failure
- Symptom:
  - `pnpm exec prisma migrate dev --create-only --name feedback-ticket-and-admin-inbox-v1` 返回 `P3006`。
- Context:
  - 本次 feedback schema 已可 `format/validate/generate`，但 shadow DB 在重放历史 migration `20260323230500_t917_thread_turn_search_column_cleanup` 时失败。
- What we tried:
  - 先正常执行 `migrate dev --create-only`，再尝试 `prisma migrate diff` 获取 SQL 预览。
- Why it failed (or current hypothesis):
  - 问题来自历史 migration 链，不是 feedback 表定义本身；因此 create-only 也无法继续。
- Fix / workaround (if any):
  - 先保留 schema + context + 代码实现，等历史 migration 问题修复后再补正式 migration 文件。
- Prevention (how to avoid repeating it):
  - 在大 schema 任务开始前，先验证当前 migration 链是否还能在 shadow DB cleanly replay。
- References (paths/commands/log keywords):
  - `pnpm exec prisma migrate dev --create-only --name feedback-ticket-and-admin-inbox-v1`
  - `P3006`
  - `20260323230500_t917_thread_turn_search_column_cleanup`

### 2026-03-27 - Enum replacement can fail if partial indexes still reference the old enum type
- Symptom:
  - `prisma migrate diff --from-migrations ... --to-schema ... --script --exit-code` 在 replay `20260327111000_feedback_ticket_and_schema_reconciliation` 时失败，报错 `operator does not exist: "ForumSceneMetadataTargetType_new" = "ForumSceneMetadataTargetType"`。
- Context:
  - `forum_scene_metadata_post_target_unique_idx` 是一个 partial unique index，predicate 里硬编码了 `target_type = 'POST'`，它仍绑定旧 enum 类型。
- What we tried:
  - 先按自动生成 SQL 原样回放，再查看失败点与 `forum_scene_metadata` 历史 migration 定义。
- Why it failed (or current hypothesis):
  - 在 `ALTER TABLE ... ALTER COLUMN target_type TYPE ...` 之前，partial index predicate 还持有旧 enum 类型；PostgreSQL 需要比较新旧 enum 时找不到对应 operator。
- Fix / workaround (if any):
  - 把 `DROP INDEX "forum_scene_metadata_post_target_unique_idx"` 提前到 enum 替换前，再执行整条 reconciliation migration。
- Prevention (how to avoid repeating it):
  - 后续遇到 enum type replacement 时，先检查是否存在 partial indexes / expression indexes / defaults 显式引用该 enum 常量，必要时提前 drop 再重建。
- References (paths/commands/log keywords):
  - `prisma/migrations/20260313164000_t095_forum_scene_metadata_sidecar/migration.sql`
  - `prisma/migrations/20260327111000_feedback_ticket_and_schema_reconciliation/migration.sql`
  - `ForumSceneMetadataTargetType_new`

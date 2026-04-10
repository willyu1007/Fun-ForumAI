# 04 Verification

## Automated checks

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - Result: passed
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed
  - Note: repo 里仍有 `T-918` 的历史 state warning，不影响本任务注册。
- `pnpm exec prisma format`
  - Result: passed
- `pnpm exec prisma validate`
  - Result: passed
- `pnpm exec prisma generate`
  - Result: passed
- `pnpm install`
  - Result: passed
  - Note: postinstall `prisma generate` 已恢复正常，不再被 `prisma/schema.prisma` 的失效 relation 阻塞。
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
  - Result: passed
  - Output: `docs/context/db/schema.json` 已刷新
- `pnpm vitest run src/backend/services/__tests__/feedback-service.test.ts src/frontend/features/user/pages/__tests__/FeedbackPage.test.tsx src/frontend/features/admin/pages/admin-panel/__tests__/FeedbackInboxTab.test.tsx src/frontend/features/user/pages/__tests__/SafetyCenterPage.test.tsx src/frontend/features/help/pages/__tests__/PolicyPages.test.tsx src/frontend/widgets/shell/__tests__/ShellLeftRail.test.tsx src/frontend/widgets/shell/__tests__/ShellTopBarContainer.test.tsx src/frontend/widgets/shell/__tests__/ShellRightRail.test.tsx src/frontend/widgets/shell/__tests__/ShellNotificationBell.test.tsx`
  - Result: passed
  - Coverage summary: 9 files, 36 tests passed
- `pnpm exec tsc -b --pretty false`
  - Result: failed
  - Scope: failures are pre-existing unrelated repo errors in moderation/search/forum-scene/runtime/relation modules; no feedback-related diagnostics remain.
- `pnpm exec prisma migrate dev --create-only --name feedback-ticket-and-admin-inbox-v1`
  - Result: failed
  - Error: `P3006` from historical migration `20260323230500_t917_thread_turn_search_column_cleanup` failing on shadow DB (`representative_stage_entry_text` missing)
- `SHADOW_DATABASE_URL='postgresql://phoenix@localhost:5432/llm_forum_shadow' pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script --exit-code`
  - Result: passed
  - Output: `-- This is an empty migration.`
  - Meaning: 当前 `prisma/migrations` 链已能 cleanly replay，并与 `prisma/schema.prisma` 对齐。
- `pnpm exec prisma migrate status`
  - Result: failed
  - Scope: 当前本地 `llm_forum_dev` 仍落后于后续 33 条 pending migrations；这是本地数据库状态问题，不是 feedback migration 链不一致。
- Local browser E2E via Playwright runtime script on running dev servers
  - Result: passed
  - Coverage:
    - 从帖子页进入 `/feedback`，保留 `feedbackSourceRoute`
    - 用户提交 `UX_ISSUE` + 截图
    - 管理员在 `/admin` 的“意见箱”按来源路由筛选并更新为 `PLANNED`
    - 用户在 bell 中收到 `FEEDBACK` 通知并点击跳回 `/feedback?ticketId=<id>`
- Deep cleanup pass
  - Result: passed
  - Cleanup:
    - 删除了本地生成环境中重复的无效缓存文件，主要位于 `node_modules/.prisma/client/* 2.*` 与 `node_modules/.vite/deps/* 2.*`
    - 未发现 repo 内仍需删除的 tracked 废弃文件或测试产物

## Manual checks

- By code inspection + component tests:
  - `/feedback` 与 `/safety` 保持独立链路，只通过低干扰 cross-link 互相引导。
  - `/admin` 独立“意见箱”tab 未复用 moderation queue 组件。
  - bell 中 `FEEDBACK` 点击跳转 `/feedback?ticketId=<id>`。
  - 入口已落在账户菜单、左侧资源区、首页右侧快捷区、帮助中心。
- By local browser E2E:
  - 用户从帖子页进入反馈页时，来源路由会进入 ticket 元数据，不会因为首条历史自动选中而丢失。
  - admin 更新公开结论后，用户侧时间线与 bell 都能看到更新。

## Planned coverage

- `pnpm exec prisma format`
- `pnpm exec prisma validate`
- `pnpm exec prisma generate`
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
- `pnpm exec vitest run` for targeted backend route/service and frontend page/admin tests
- `pnpm exec tsc -b --pretty false`
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`

# 03 Implementation Notes — director-report-history-lifecycle-and-segmentation

## Actual touch points
- `prisma/schema.prisma`
- `prisma/migrations/20260314150000_t101_director_history_lifecycle/migration.sql`
- `scripts/lib/director-history-shared.mjs`
- `scripts/director-history-maintenance.mjs`
- `scripts/director-closure-report.mjs`
- `src/backend/runtime/director-history-maintenance-scheduler.ts`
- `src/backend/repos/pg/pg-room-watchability-repository.ts`
- `dev-docs/active/director-report-history-lifecycle-and-segmentation/*`

## Actual changes
- task bundle 已重命名为 `director-report-history-lifecycle-and-segmentation`，并已在本轮完成 archive / summary / report 闭环验证后重新收口为 `done`。
- Prisma SSOT 已加入 archive / summary / maintenance-run 表，并补正式 migration SQL。
- 新增共享脚本库 `director-history-shared.mjs`，archive / summary refresh / report 规则集中在同一处维护。
- 新增 `scripts/director-history-maintenance.mjs`，支持 `dry-run / archive / backfill / refresh-summary / run-daily`。
- `scripts/director-closure-report.mjs` 已切到 summary-first；`--use-raw` 只用于对账。
- room program event 的按 id 读取已补 archive fallback，保证历史消息投影不因冷热迁移断链。
- backend 新增 `DirectorHistoryMaintenanceScheduler`，通过单一 maintenance script 执行每日维护。

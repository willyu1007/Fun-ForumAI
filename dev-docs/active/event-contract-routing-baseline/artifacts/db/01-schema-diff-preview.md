# 01 Schema Diff Preview

- Date: 2026-03-05
- Command:
  - `DATABASE_URL='postgresql://phoenix@localhost:5432/llm_forum_dev' SHADOW_DATABASE_URL='postgresql://phoenix@localhost:5432/llm_forum_shadow' pnpm -s prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script > dev-docs/active/event-contract-routing-baseline/artifacts/db/01-schema-diff-preview.sql`
- Output artifact:
  - `dev-docs/active/event-contract-routing-baseline/artifacts/db/01-schema-diff-preview.sql`
- Coverage:
  - `events` 扩列与索引
  - `aftershow_artifacts/aftershow_callouts`
  - `community_config_versions/community_config_patches/community_config_approvals`
  - `role_assignments`
  - `NotificationType.AFTERSHOW_CALLOUT`

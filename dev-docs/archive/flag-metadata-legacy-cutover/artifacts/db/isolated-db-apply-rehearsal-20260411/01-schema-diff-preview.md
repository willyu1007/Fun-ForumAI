# 01 Schema Diff Preview

## Result

- A versioned Prisma migration was generated with `--create-only`:
  - `/Volumes/DataDisk/Project/Fun-ForumAI/prisma/migrations/20260411043037_t952_flag_metadata_legacy_cutover/migration.sql`

## Why this was needed

- The first Docker-backed isolated rehearsal proved that all previously committed migrations applied cleanly, but the runtime then failed with missing-column errors.
- That established a repo gap: the cutover changes in `prisma/schema.prisma` had preview SQL, but not a committed versioned migration consumable by `prisma migrate deploy`.

## Scope captured by the generated migration

- removes the final live `meta_json` / `metadata_json` / `moderation_metadata_json` columns that were cut from runtime code
- drops `legacy_growth_events_archive`
- adds the explicit typed columns introduced during the cutover
- reconciles the remaining schema drift so the migrated database matches current Prisma client expectations

## Supporting evidence

- canonical versioned migration:
  - `/Volumes/DataDisk/Project/Fun-ForumAI/prisma/migrations/20260411043037_t952_flag_metadata_legacy_cutover/migration.sql`
- note:
  - raw create-only command output was dropped during archive compaction; this summary is the retained evidence artifact

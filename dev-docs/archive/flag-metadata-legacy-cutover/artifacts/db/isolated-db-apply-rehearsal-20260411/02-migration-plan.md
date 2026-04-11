# 02 Migration Plan

## Rehearsed path

1. Generate Prisma client against repo SSOT.
2. Apply all committed migrations to a fresh isolated database via `pnpm db:migrate:deploy`.
3. Run persistent read-path E2E:
   - `src/backend/routes/__tests__/e2e-read-api.test.ts`
4. Run persistent control-plane suites:
   - `src/backend/routes/__tests__/e2e-agents-control-plane.test.ts`
   - `src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
   - `src/backend/routes/__tests__/e2e-incubation-control-plane.test.ts`
   - `src/backend/routes/__tests__/e2e-community-config-control-plane.test.ts`
   - `src/backend/routes/__tests__/e2e-role-assignment-control-plane.test.ts`
   - `src/backend/routes/__tests__/e2e-inference-profile-control-plane.test.ts`
5. Run the two additional targeted assertions already encoded in `scripts/e2e-pg-isolated.mjs`:
   - role-assignment create/update
   - post aside-seats read
6. Drop the isolated database and isolated shadow database.

## Repo adjustments required to make the rehearsal pass

1. Commit the versioned migration:
   - `/Volumes/DataDisk/Project/Fun-ForumAI/prisma/migrations/20260411043037_t952_flag_metadata_legacy_cutover/migration.sql`
2. Fix persistent E2E fixtures / assertions that still assumed:
   - non-persisted agent creation was sufficient for membership writes
   - `/v1/admin/runtime/features` returned `data.flags` instead of `data.launch_capabilities`
   - the vote projection failure test could reject post projection during post creation without producing an unhandled rejection

## Not part of this rehearsal

- no target-environment DB writes
- no packaging build
- no launch-readiness run
- no deploy rollout

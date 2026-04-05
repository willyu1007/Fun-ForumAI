# 04 Verification — search-analytics-backfill-and-compat-cleanup (T-146)

## Bootstrap Verification

- Registration covered by `T-142` bootstrap verification.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-146`
  - Result: passed; task registered as `planned` under `M-030 > F-100 > R-105`.

## 2026-04-05 — governance sync

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: passed; registry, changelog, dashboard, feature map, and task index regenerated for the `T-146` kickoff.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed after the registry picked up `T-144` / `T-145` / `T-146` as `in-progress`.

## 2026-04-05 — schema/context verification

- `pnpm prisma validate`
  - Result: passed; updated `prisma/schema.prisma` remains valid after the search/event semantic expansion.
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
  - Result: passed; `docs/context/db/schema.json` refreshed from the Prisma SSOT after adding the `T-146` fields.
- `pnpm prisma migrate diff --from-schema .ai/.tmp/t146-db/schema.before.prisma --to-schema prisma/schema.prisma --script > dev-docs/active/search-analytics-backfill-and-compat-cleanup/artifacts/db/01-schema-diff-preview.sql`
  - Result: passed; generated a preview-only SQL diff without applying schema changes to a database.
- Schema apply status
  - Result: intentionally held. `T-146` produced the migration artifact under `prisma/migrations/20260405150000_t146_search_analytics_semantic_cutover/`, but no DB apply was run because the repo workflow requires explicit approval before schema writes.

## 2026-04-05 — regression verification

- `pnpm exec vitest run src/backend/services/search/__tests__/search-snippet.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/backend/services/search/__tests__/search-service.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/backend/services/__tests__/viewer-public-view-service.test.ts src/backend/services/__tests__/home-programming-service.test.ts src/backend/services/__tests__/public-agent-relation-summary-service.test.ts`
  - Result: passed (`7` files / `23` tests). Covers canonical search explanations, search projection writes, human thread indexing, viewer recent signals, and note-template explainability.
- `pnpm exec vitest run src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/widgets/shell/__tests__/TopBarSearch.test.tsx src/frontend/features/forum/components/__tests__/PostCard.test.tsx src/frontend/features/forum/components/__tests__/PostCompact.test.tsx src/frontend/features/forum/pages/__tests__/HomePage.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - Result: passed (`7` files / `38` tests). Confirms the UI consumes canonical note semantics and structured search explanations while still tolerating legacy flat reason-code payloads.
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-read-api.test.ts`
  - Result: passed (`1` file / `38` tests). Covers `/v1/home`, `/v1/highlights`, `/v1/posts/:id`, `/v1/posts/:id/aftershow`, `/v1/search`, and public open-reply routes on the updated semantic/event contract.
- `pnpm exec tsc --noEmit`
  - Result: passed.

## Deferred Verification

## 2026-04-05 — deep isolated E2E

- `pnpm db:local:up`
  - Result: passed; local PostgreSQL container brought online for isolated database creation.
- First run: `pnpm test:e2e:pg:isolated`
  - Result: failed during the migrated PostgreSQL read-api suite because the local Prisma Client was stale and did not include the new `agent_search_docs` fields (`identityRoleId`, `identityVisibilityRoleId`, `formatCapabilities`, `achievementBadgesText`).
- Fix applied
  - `pnpm db:generate`
  - `scripts/e2e-pg-isolated.mjs` updated to run `pnpm db:generate` before `pnpm db:migrate:deploy`
- Second run: `pnpm test:e2e:pg:isolated`
  - Result: passed end to end.
  - Coverage:
    - migration apply on isolated PostgreSQL databases
    - `src/backend/routes/__tests__/e2e-read-api.test.ts` (`38` tests)
    - governance / incubation / community-config / role-assignment / inference-profile control-plane suites (`47` tests)
    - focused reruns for role-assignment and aside-seat PostgreSQL paths

## 2026-04-05 — final quality gate

- `pnpm lint`
  - First result: failed on `src/backend/container/infra.ts`, `src/backend/repos/community-proposal-repository.ts`, and `src/backend/services/community-governance-service.ts`.
  - Fixes:
    - preserved `cause` on Redis bootstrap errors
    - removed an unused import
    - removed redundant boolean casts
  - Final result: passed.
- `pnpm exec vitest run src/backend/services/__tests__/community-governance-service.test.ts`
  - Result: passed (`1` file / `2` tests).
- `pnpm exec tsc --noEmit`
  - Result: passed after the final lint cleanup as well.

## 2026-04-05 — semantic cleanup regression gate

- `pnpm exec vitest run src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/backend/services/search/__tests__/search-service.test.ts src/frontend/features/forum/pages/__tests__/HomePage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/backend/services/__tests__/home-programming-service.test.ts`
  - Result: passed (`5` files / `32` tests). Confirms canonical search explanations and canonical creator-note detection across forum/home surfaces.
- `pnpm exec tsc --noEmit`
  - Result: passed after the cleanup-only refactors.
- `pnpm lint`
  - Result: passed after removing the stale search alias path and note-surface dual-track reads.
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-read-api.test.ts`
  - First result: failed on an outdated assertion that still expected a non-native creator note to remain inside a shelf.
  - Fix: updated the E2E contract to assert the note stays out of `notes_today` but remains present in `hot_feed_continuation`.
  - Final result: passed (`1` file / `38` tests).
- `pnpm test:e2e:pg:isolated`
  - Result: passed after the cleanup pass as well.
  - Coverage:
    - isolated PostgreSQL migrate + client generate
    - public read API suite
    - governance/incubation/community-config/role-assignment/inference-profile control-plane suites
    - focused post-run reruns for role-assignment and aside-seat database paths

## 2026-04-05 — final closeout readback

- `pnpm exec vitest run src/backend/routes/__tests__/e2e-community-proposals-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/services/__tests__/community-governance-service.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - Result: passed as the final downstream smoke after the corrective `T-143` source-config canonicalization pass.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-146`
  - Result: passed; task now reads back as `done` under `M-030 > F-100 > R-105`.
- Source-config dependency readback
  - Result: passed; `notes_today`, `note_root_card`, `creator_note_templates`, `launch_wave`, and canonical identity fields remain stable upstream owners, and no new `T-146` field ownership overlap was introduced with `T-927`.

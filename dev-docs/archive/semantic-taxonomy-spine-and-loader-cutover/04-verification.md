# 04 Verification — semantic-taxonomy-spine-and-loader-cutover (T-143)

## Bootstrap Verification

- Registration covered by `T-142` bootstrap verification.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-143`
  - Result: passed; task registered as `planned` under `M-030 > F-100 > R-102`.

## Implementation Verification

- `pnpm eslint src/shared/semantic-taxonomy.ts src/backend/launch/semantic-taxonomy-registry.ts src/backend/launch/community-rules.ts src/backend/launch/programming-projection.ts src/backend/launch/system-roster.ts src/backend/identity/agent-identity.ts src/backend/services/forum-read-service.ts src/backend/services/global-highlights-service.ts src/backend/services/public-scene-selector-service.ts src/backend/routes/read-api.ts src/frontend/api/types.ts src/frontend/shared/utils/community-shell-meta.ts src/frontend/features/forum/lib/launch-surface-labels.ts src/shared/public-search.ts`
  - Result: passed.
- `pnpm vitest run src/backend/launch/__tests__/semantic-taxonomy-registry.test.ts src/backend/launch/__tests__/programming-contracts.test.ts src/backend/launch/__tests__/system-roster.test.ts src/backend/services/__tests__/public-scene-selector-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - Result: passed; canonical taxonomy, projection, roster, scene selector, and read API contracts all green.
- `pnpm vitest run src/backend/routes/__tests__/e2e-community-config-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-incubation-control-plane.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/backend/routes/__tests__/e2e-role-assignment-control-plane.test.ts src/backend/routes/__tests__/e2e-inference-profile-control-plane.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-community-proposals-control-plane.test.ts src/backend/routes/__tests__/e2e-data-plane.test.ts src/backend/routes/__tests__/e2e-full-flow.test.ts src/backend/routes/__tests__/e2e-agents-control-plane.test.ts src/backend/routes/__tests__/e2e-multimodal.test.ts`
  - Result: passed; 13 files / 111 tests.
- `pnpm typecheck`
  - Result: passed.

## Environment Verification Notes

- `pnpm test:e2e:pg:isolated`
  - Result: passed after restoring the local PostgreSQL + Docker runtime; the isolated runner created temp databases, applied all Prisma migrations, ran the read/control-plane suites plus targeted follow-up reruns, and dropped the temp databases cleanly.
- `pnpm vitest run src/frontend/features/forum/pages/__tests__/HomePage.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - Result: passed; creator-note UI copy now renders through the canonical shelf label path instead of hardcoded `T4 今日笔记`.
- `docker version --format '{{.Server.Version}}'`
  - Result: passed; Docker daemon reachable and reported server version `27.4.0`.
- `/opt/homebrew/opt/postgresql@17/bin/pg_isready -h localhost -p 5432`
  - Result: passed; local PostgreSQL listener is accepting connections on `localhost:5432`.
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: passed; project hub regenerated after archiving `T-143` and refreshing the final verification notes.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed; no remaining state/path mismatch after moving the task bundle to `dev-docs/archive/`.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-143`
  - Result: passed; returned `status=archived`, confirming the task pack status and dev-doc path are aligned across archive docs and project hub.

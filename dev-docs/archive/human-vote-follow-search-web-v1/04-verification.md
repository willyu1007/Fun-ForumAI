# 04 Verification

| Time | Command | Result |
| --- | --- | --- |
| 2026-02-28 | `pnpm -s prisma generate` | pass |
| 2026-02-28 | `pnpm -s typecheck` | pass |
| 2026-02-28 | `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts src/backend/services/__tests__/forum-read-service.test.ts` | pass |
| 2026-02-28 | `pnpm -s test` | pass (47 files, 338 tests) |
| 2026-02-28 | `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` | pass |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass |
| 2026-02-28 | `pnpm -s vitest run src/backend/services/__tests__/forum-read-service.test.ts` | pass |
| 2026-02-28 | `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts` | pass (33 tests) |
| 2026-02-28 | `pnpm -s typecheck` | pass |
| 2026-02-28 | `pnpm -s test` | pass (48 files, 347 tests) |

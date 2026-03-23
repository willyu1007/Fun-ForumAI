# 04 Verification

## Key Checks
- `pnpm -s vitest run src/backend/runtime/__tests__/event-queue.test.ts src/backend/runtime/__tests__/leader-elector.test.…` — pass (2 files, 8 tests)
- `pnpm -s eslint src/backend/container.ts src/backend/server.ts src/backend/lib/config.ts src/backend/runtime/event-queue…` — pass
- `pnpm -s test` — pass (30 files, 262 tests)
- `pnpm -s typecheck` — fail (existing baseline issues outside T-023 scope: frontend unused symbol, allocator config event …
- `node scripts/runtime-staging-smoke.mjs --help` — pass (CLI usage and args rendered correctly)
- `node scripts/runtime-staging-smoke.mjs --node1-url http://127.0.0.1:4101 --node2-url http://127.0.0.1:4102 --admin-toke…` — pass (execution plan rendered without network side effects)

## Coverage
- Automated checks
- Manual smoke checks
- Rollout / Backout (if applicable)
- Verification runs (2026-02-25)
- Phase 3 local rollout rehearsal (2026-02-25)

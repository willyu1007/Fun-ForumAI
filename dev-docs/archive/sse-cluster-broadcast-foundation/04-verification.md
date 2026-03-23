# 04 Verification

## Key Checks
- `pnpm -s vitest run src/backend/sse/__tests__/hub.test.ts` — pass (4 tests)
- `pnpm -s eslint src/backend/container.ts src/backend/lib/config.ts src/backend/routes/control-plane.ts src/backend/route…` — pass
- `pnpm -s eslint src/frontend/api/use-sse.ts src/frontend/app/sse-context.ts src/frontend/app/sse-provider.tsx src/fronte…` — pass
- `pnpm -s test` — pass (31 files, 266 tests)
- `pnpm smoke:t025:k8s` — pass
- `node scripts/t023-t025-k8s-smoke-suite.mjs` — PASS

## Coverage
- Automated checks
- Manual smoke checks
- Rollout / Backout (if applicable)
- Verification runs (2026-02-25)
- Coverage: 本地全局广播、本地房间广播、跨实例全局 fanout、跨实例房间 fanout + 去重

# 04 Verification

## Key Checks
- `pnpm -s db:generate` — pass
- `pnpm -s typecheck` — pass
- `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts src/backend/services/__tests__/agent-community-membership-s…` — fail once（调整 chronicle_entries 口径后复测通过）
- `pnpm -s vitest run src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/routes/__tests__/e2e.te…` — pass
- `pnpm -s vitest run src/backend/repos/__tests__/agent-signal-log-repository.test.ts src/backend/repos/__tests__/communit…` — pass
- `pnpm -s test` — pass

## Coverage
- Functional verification map
- Pending staging evidence
- Staging evidence snapshot (2026-03-02)
- Environment
- Measured results

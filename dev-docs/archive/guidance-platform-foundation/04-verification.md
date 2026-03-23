# 04 Verification

## Key Checks
- `pnpm -s db:generate` — pass
- `pnpm -s typecheck` — pass
- `pnpm -s vitest run src/backend/routes/__tests__/*guidance*.test.ts src/backend/services/__tests__/*guidance*.test.ts` — pass
- `pnpm -s vitest run src/backend/routes/__tests__/private-channel-memory-auth.test.ts` — pass
- `pnpm -s vitest run src/backend/routes/__tests__/*read*.test.ts src/backend/routes/__tests__/*control-plane*.test.ts` — pass
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — pass

## Coverage
- Scenario checklist
- Execution log
- 2026-03-10 | `pnpm exec vitest run src/frontend/api/hooks/__tests__/guidance.test.tsx src/backend/guidance/__tests__/fe…

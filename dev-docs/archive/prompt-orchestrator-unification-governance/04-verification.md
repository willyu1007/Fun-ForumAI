# 04 Verification

## Key Checks
- `pnpm -s typecheck` — pass
- `pnpm -s vitest run src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/runtime/__tests__/context-bui…` — pass
- `pnpm -s vitest run src/backend/services/__tests__/private-channel-service*.test.ts src/backend/services/__tests__/proac…` — pass
- `pnpm -s vitest run src/backend/routes/__tests__/dev-prompts-render.test.ts src/backend/routes/__tests__/e2e.test.ts` — pass
- `pnpm -s test` — pass
- `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out .ai/.t…` — fail

## Coverage
- Scenario snapshot checklist
- Execution log
- Real LLM suite (local dev)
- Execution constraints
- Command

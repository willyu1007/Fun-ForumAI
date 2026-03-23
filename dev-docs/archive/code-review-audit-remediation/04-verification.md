# 04 Verification

## Key Checks
- `pnpm exec vitest run src/backend/app.test.ts src/backend/lib/config.test.ts src/backend/routes/__tests__/dev-prompts-re…` — pass
- `pnpm exec vitest run src/backend/routes/__tests__/auth-api.test.ts src/backend/services/__tests__/agent-community-membe…` — pass
- `pnpm eslint src/backend/lib/config.ts src/backend/routes/auth-api.ts src/backend/middleware/human-auth.ts src/backend/r…` — pass
- `pnpm typecheck` — pass
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — pass
- `pnpm lint` — pass

## Coverage
- 2026-03-17 | `pnpm typecheck` | fail (unrelated existing baseline errors in `src/backend/context-memory/__tests__/memor…

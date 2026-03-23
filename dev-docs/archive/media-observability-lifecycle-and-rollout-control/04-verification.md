# 04 Verification

## Key Checks
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` — Pass
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — Pass
- `pnpm db:validate` — Pass
- `pnpm db:generate` — Pass
- `pnpm typecheck` — Pass
- `pnpm vitest run src/backend/media/__tests__ src/backend/routes/__tests__/admin-media-api.test.ts src/frontend/features/…` — Pass

## Coverage
- Pass: `pnpm vitest run src/backend/services/__tests__/chat-service.nurture.test.ts src/backend/services/__tests__/chat-…
- Pass: `rg --files -g 'coverage/**' -g '.vitest/**' -g '.vitest-cache/**' -g 'test-results/**' -g 'playwright-report/**'…

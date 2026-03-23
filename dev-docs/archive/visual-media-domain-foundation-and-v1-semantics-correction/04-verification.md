# 04 Verification

## Key Checks
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` — Pass
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — Pass
- `pnpm db:validate` — Pass
- `pnpm db:generate` — Pass
- `pnpm typecheck` — Pass
- `pnpm test -- src/backend/services/__tests__/inclination-asset-service.test.ts src/backend/routes/__tests__/e2e-multimod…` — Pass

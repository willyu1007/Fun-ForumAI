# 04 Verification — T-073

## Key Checks
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` — pass
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — pass
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — pass
- `pnpm prisma format` — pass
- `pnpm db:validate` — pass
- `pnpm db:generate` — pass

## Coverage
- `find . -maxdepth 4 \\( -name 'coverage' -o -name '.vitest' -o -name '*.tsbuildinfo' -o -name 'vitest-report*' -o -name…

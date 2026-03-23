# 04 Verification

## Key Checks
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` — pass
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — pass
- `pnpm exec prisma validate` — pass
- `pnpm exec tsc -p tsconfig.app.json` — pass
- `pnpm exec tsc --noEmit` — pass
- `pnpm vitest run src/backend/services/__tests__/governance-adapter.test.ts src/backend/services/__tests__/hot-topic-poli…` — pass

## Coverage
- Governance checklist
- Audit cross-check
- [x] `provenance/config governance`：public disclosure cap、prompt provenance、agent config risk review 已落地。
- [x] `hot-topic policy`：default-deny、kill switch、gray/deny override、sampled review 与 `HOT_TOPIC` case 已落地。
- [x] `public policy/help center`：公开规则与说明页已上线且登录前可访问。

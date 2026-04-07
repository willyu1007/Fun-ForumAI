# 04 Verification — badge-semantic-sot-and-surface-usage-governance-v1

- `node .ai/scripts/ctl-project-governance.mjs map --project main --task T-940 --milestone M-030 --feature F-100 --requirement R-106 --apply`
  - Result: passed; task mapped under `M-030 > F-100 > R-106`.
- `pnpm exec tsc --noEmit`
  - Result: passed.
- `pnpm vitest run src/backend/identity/__tests__/public-display-badges.test.ts src/backend/routes/__tests__/dev-badge-debug.test.ts src/backend/services/__tests__/global-highlights-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/frontend/shared/utils/__tests__/public-author.test.ts src/frontend/widgets/dev/__tests__/DevBadgeDebugPanel.test.tsx src/shared/badges/__tests__/surface-policy.test.ts --reporter=dot`
  - Result: passed (`8` files, `48` tests).
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - Result: passed after implementation/doc updates.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed.

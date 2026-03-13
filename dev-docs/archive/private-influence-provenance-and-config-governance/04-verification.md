# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm prisma generate` | pass |
| `pnpm exec tsc --noEmit` | pass |
| `pnpm vitest run src/backend/services/__tests__/public-disclosure-cap-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/agent-config-lint-service.test.ts src/backend/services/__tests__/agent-service.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx src/frontend/api/hooks/__tests__/admin.test.tsx` | pass |

## Executed verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm prisma format` | pass | 重新格式化 Prisma schema |
| `pnpm prisma generate` | pass | 更新 Prisma Client 以包含 `public_disclosure_cap_overrides` |
| `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` | pass | 刷新 `docs/context/db/schema.json` |
| `pnpm exec tsc --noEmit` | pass | 类型检查通过 |
| `pnpm vitest run src/backend/services/__tests__/public-disclosure-cap-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/agent-config-lint-service.test.ts src/backend/services/__tests__/agent-service.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx src/frontend/api/hooks/__tests__/admin.test.tsx` | pass | 覆盖 disclosure cap 解析、spillover auto-cap、semantic config reject、prompt provenance 与 AdminPanel/operator hooks |
| `pnpm exec tsc --noEmit` | pass | review fixes 后重新跑类型检查 |
| `pnpm vitest run src/backend/services/__tests__/public-disclosure-cap-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts` | pass | 覆盖 hot-topic flag gating、shadow mode 不落 auto-cap、owner-reflection 不误判、override duplicate healing |
| `pnpm vitest run src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/services/__tests__/agent-service.test.ts` | pass | 确认 prompt/runtime 路径未被 disclosure fix 回归打坏 |
| `pnpm exec tsc --noEmit` | pass | `T-087` closeout 收口后 provenance / policy types 仍通过静态编译 |

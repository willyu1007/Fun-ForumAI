# 04 Verification

## Automated checks
- 2026-04-15:
  - `pnpm vitest src/backend/lib/config.test.ts src/frontend/shared/config/__tests__/frontend-flags.test.ts src/frontend/shared/config/__tests__/frontend-capabilities.test.ts src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx`
    - Result: passed (`4` files, `21` tests)
  - `npx eslint src/backend/lib/config.ts src/backend/lib/config.test.ts src/frontend/shared/config/frontend-flags.ts src/frontend/shared/config/frontend-capabilities.ts src/frontend/shared/config/__tests__/frontend-flags.test.ts src/frontend/shared/config/__tests__/frontend-capabilities.test.ts src/frontend/features/agents/components/modal/TabIntro.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx`
    - Result: passed
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
    - Result: passed; registry/dashboard/task-index/feature-map regenerated
- 2026-04-15:
  - `pnpm vitest src/backend/lib/config.test.ts src/frontend/shared/config/__tests__/frontend-flags.test.ts src/frontend/shared/config/__tests__/frontend-capabilities.test.ts src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/frontend/features/agents/components/__tests__/StyleControlPanel.test.tsx`
    - Result: passed (`5` files, `24` tests)
  - `npx eslint src/backend/lib/config.ts src/backend/lib/config.test.ts src/frontend/shared/config/frontend-flags.ts src/frontend/shared/config/frontend-capabilities.ts src/frontend/shared/config/__tests__/frontend-flags.test.ts src/frontend/shared/config/__tests__/frontend-capabilities.test.ts src/frontend/features/agents/components/modal/TabIntro.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/frontend/features/agents/components/StyleControlPanel.tsx src/frontend/features/agents/components/__tests__/StyleControlPanel.test.tsx`
    - Result: passed
  - `pnpm tsc --noEmit --pretty false`
    - Result: passed

## Manual smoke checks
- 未执行浏览器手工 smoke。
- 仍建议在下一轮联调时验证：
  - `VITE_FF_AGENT_STATS_UI=false` 时 `塑造` 不渲染 `StatsPanel`
  - `VITE_FF_AGENT_STATS_UI=true` 且 backend `FF_AGENT_STATS_V1=true` 时 `塑造` 展示 Stats 能力区并可访问 owner-only stats API

## Rollout / Backout (if applicable)
- Rollout:
  - 打开 frontend `VITE_FF_AGENT_STATS_UI=true`
  - 打开 backend `FF_AGENT_STATS_V1=true` 以及需要的 stats 子能力开关
- Backout:
  - 将上述 flags 恢复为 `false`

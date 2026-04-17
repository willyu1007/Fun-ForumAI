# 04 Verification

## Automated checks
- 2026-04-17:
  - `pnpm exec eslint src/frontend/features/agents/components/modal/TabIntro.tsx src/frontend/features/agents/components/StatsPanel.tsx src/frontend/features/agents/components/StyleControlPanel.tsx src/frontend/features/agents/components/OwnerLifeOverviewPanel.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/frontend/features/agents/components/__tests__/StatsPanel.test.tsx src/frontend/shared/config/frontend-capabilities.ts src/frontend/shared/config/__tests__/frontend-capabilities.test.ts src/frontend/features/forum/components/CommunityHoverCard.tsx src/frontend/widgets/shell/ShellRightRail.tsx`
    - Result: passed
  - `pnpm exec vitest run src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/frontend/features/agents/components/__tests__/StatsPanel.test.tsx src/frontend/features/agents/components/__tests__/StyleControlPanel.test.tsx src/frontend/features/forum/components/__tests__/CommunityHoverCard.test.tsx src/frontend/shared/config/__tests__/frontend-capabilities.test.ts`
    - Result: passed (`5` files, `26` tests)
  - `pnpm exec tsc --noEmit`
    - Result: passed
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
  - backend `FF_AGENT_STATS_V1=true` 时 `塑造` 中的 `性格底色` 可正常读取 owner-only stats API
  - backend `FF_AGENT_STATS_V1=false` 或当前用户无 owner 权限时，`StatsPanel` 仅展示一次准确的不可用原因

## Rollout / Backout (if applicable)
- Rollout:
  - 打开 backend `FF_AGENT_STATS_V1=true` 以及需要的 stats 子能力开关
- Backout:
  - 将上述 backend stats flags 恢复为 `false`

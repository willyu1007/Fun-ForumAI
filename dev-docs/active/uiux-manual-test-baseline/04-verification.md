# 04 Verification — uiux-manual-test-baseline (T-909)

## Latest Baseline Checks

- `pnpm vitest run src/frontend/widgets/shell/__tests__/ShellIconHint.test.tsx src/frontend/widgets/shell/__tests__/ShellLeftRail.test.tsx src/frontend/widgets/shell/__tests__/ShellRightRail.test.tsx src/frontend/widgets/shell/__tests__/ShellTopBar.test.tsx src/frontend/widgets/shell/__tests__/ShellTopBarContainer.test.tsx src/frontend/app/shell/__tests__/AppShellContainer.test.tsx src/frontend/features/forum/pages/__tests__/CommunityFeedPage.test.tsx src/frontend/features/forum/pages/__tests__/FeedPage.test.tsx src/frontend/features/auth/pages/__tests__/AuthPageRedirect.test.tsx src/frontend/features/auth/components/__tests__/AuthRedirectForms.test.tsx src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts`
  - pass
- `pnpm exec tsc --noEmit`
  - pass
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode minimal --run-id uiux-quality-review-v1 --evidence-root .ai/.tmp/ui`
  - pass
- `node .ai/tests/run.mjs --suite ui`
  - pass
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - pass
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - pass
- `git diff --check`
  - pass

## Focused UI Checks

- Community header:
  - tooltip、动作色态、banner/头像/标题层级已实测。
- Home right rail:
  - 探索开关、最近登场、footer shortcuts 已实测。
- Auth:
  - 标题/输入框间距与 placeholder 字号已实测。

## 2026-04-04 — Hover Card / Badge Hover Checks

- `pnpm exec vitest run src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/backend/routes/__tests__/e2e-agents-control-plane.test.ts`
  - pass
- `pnpm exec tsc --noEmit`
  - pass
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - pass
- `node .ai/tests/run.mjs --suite ui`
  - pass

## 2026-04-05 — Hover Card Owner Action + Stats Rebalance

- `pnpm exec vitest run src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - pass
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - pass

## 2026-04-05 — Owner CTA Shape Root Cause

- `pnpm exec vitest run src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx`
  - pass
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - pass
- 浏览器实测：
  - owner CTA 移除 `data-ui="button"` 后，计算样式 `borderRadius` 已变为满圆角极大值，不再受 contract 的 `radius-md` 覆盖

## 2026-04-05 — Button Contract `shape=pill`

- `pnpm run ui:contract:build`
  - pass
- `pnpm run ui:contract:check`
  - pass
- `pnpm exec vitest run src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx`
  - pass
- `pnpm exec tsc --noEmit`
  - pass
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py approval-approve --request .ai/.tmp/ui/20260404T234614Z-21564/approval.request.json --approved-by user`
  - pass
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - pass
  - report: `.ai/.tmp/ui/20260404T234654Z-24539/ui-gate-report.md`
- `node .ai/tests/run.mjs --suite ui`
  - pass

## 2026-04-05 — Badge Debug Panel

- `pnpm exec vitest run src/backend/routes/__tests__/dev-badge-debug.test.ts src/frontend/widgets/dev/__tests__/DevBadgeDebugPanel.test.tsx src/frontend/widgets/dev/__tests__/DevAuthToolbar.test.tsx`
  - pass
- `pnpm exec tsc --noEmit`
  - pass
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - pass
- `node .ai/tests/run.mjs --suite ui`
  - pass

## 2026-04-05 — Quality Sweep

- `pnpm exec vitest run src/backend/identity/__tests__/public-display-badges.test.ts src/backend/routes/__tests__/dev-badge-debug.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/widgets/dev/__tests__/DevBadgeDebugPanel.test.tsx src/frontend/widgets/dev/__tests__/DevAuthToolbar.test.tsx`
  - pass
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-agents-control-plane.test.ts`
  - pass
- `pnpm exec eslint src/backend/identity/agent-identity.ts src/backend/identity/badge-debug-catalog.ts src/backend/routes/read-api.ts src/backend/routes/__tests__/dev-badge-debug.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts src/frontend/features/forum/lib/author-identity.ts src/frontend/features/forum/lib/author-badge-icons.ts src/frontend/features/forum/components/AuthorBadgeRail.tsx src/frontend/features/agents/components/AgentHoverCard.tsx src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx src/frontend/features/forum/pages/PostDetailPage.tsx src/frontend/widgets/dev/DevBadgeDebugPanel.tsx src/frontend/widgets/dev/DevAuthToolbar.tsx src/frontend/api/types.ts src/shared/badges/catalog.ts src/shared/badges/debug-catalog.ts`
  - pass
- `pnpm exec tsc --noEmit`
  - pass
- `git diff --check`
  - pass
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - pass
- `node .ai/tests/run.mjs --suite ui`
  - pass

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

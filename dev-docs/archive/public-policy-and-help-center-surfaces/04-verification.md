# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec tsc --noEmit` | pass |
| `pnpm vitest run src/frontend/features/help/pages/__tests__/PolicyPages.test.tsx src/frontend/shared/components/__tests__/Layout.test.tsx src/frontend/features/forum/pages/__tests__/CommunityFeedPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/private-chat/pages/__tests__/PrivateChatPage.test.tsx src/frontend/features/user/pages/__tests__/SafetyCenterPage.test.tsx` | pass |
| `pnpm exec eslint src/frontend/features/help/pages/PolicyPages.tsx src/frontend/app/route-components.tsx src/frontend/app/router.tsx src/frontend/shared/components/Layout.tsx src/frontend/features/forum/pages/CommunityFeedPage.tsx src/frontend/features/forum/pages/PostDetailPage.tsx src/frontend/features/private-chat/pages/PrivateChatPage.tsx src/frontend/features/user/pages/SafetyCenterPage.tsx` | pass |
| `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --repo-root . --run-id t087-closeout-20260313c --evidence-root .ai/.tmp/ui --mode full --fail-on errors` | pass |

## Executed verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm exec tsc --noEmit` | pass | 路由与页面合并后静态编译通过 |
| `pnpm vitest run src/frontend/features/help/pages/__tests__/PolicyPages.test.tsx src/frontend/shared/components/__tests__/Layout.test.tsx src/frontend/features/forum/pages/__tests__/CommunityFeedPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/private-chat/pages/__tests__/PrivateChatPage.test.tsx src/frontend/features/user/pages/__tests__/SafetyCenterPage.test.tsx` | pass | 覆盖所有公开帮助页渲染与前台入口发现性 |
| `pnpm exec eslint src/frontend/features/help/pages/PolicyPages.tsx src/frontend/app/route-components.tsx src/frontend/app/router.tsx src/frontend/shared/components/Layout.tsx src/frontend/features/forum/pages/CommunityFeedPage.tsx src/frontend/features/forum/pages/PostDetailPage.tsx src/frontend/features/private-chat/pages/PrivateChatPage.tsx src/frontend/features/user/pages/SafetyCenterPage.tsx` | pass | T-092 触达前端文件 lint clean |
| `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --repo-root . --run-id t087-closeout-20260313c --evidence-root .ai/.tmp/ui --mode full --fail-on errors` | pass | 报告见 `.ai/.tmp/ui/t087-closeout-20260313c/ui-gate-report.md` |

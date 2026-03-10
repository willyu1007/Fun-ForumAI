# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm -s typecheck` | pass |
| `pnpm -s vitest run src/frontend/features/**/__tests__/*.test.tsx src/frontend/shared/components/**/__tests__/*.test.tsx` | pass |
| `pnpm -s vitest run src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx` | pass |

## Scenario checklist
- [x] 匿名首访首页能看到双主线，不出现“先选模式”阻断
- [ ] 登录后 guidance 状态延续，不重复 Day 0 体验
- [x] inbox 未读数、列表页和首页模块状态一致
- [ ] 帖子页 / Agent 页 follow payoff 能把用户带入 highlights 或 following feed payoff
- [x] 私聊 receipt 从 pending 自动升级到 ready
- [ ] memories / chronicle / achievements 页面存在来源说明与下一步 CTA
- [x] Day 0 时 owner 高级控制被延后揭示，first success 后才展开
- [x] CTA 深链与 action 上报正确
- [x] 首页 `following_only` query 能正确驱动 following feed 状态
- [x] 首屏 guidance 曝光不会在 rerender / summary refresh 时重复上报
- [x] Agent 页 owner payoff 卡不会串到其他 agent

## Execution log
- 2026-03-10 | `pnpm exec tsc -p tsconfig.app.json` | pass
- 2026-03-10 | manual review of `/`, `/inbox`, `/agents/:agentId`, `/agents/:agentId/chat` against frozen guidance contract | pass
- 2026-03-10 | `pnpm exec vitest run src/frontend/features/forum/pages/__tests__/FeedPage.test.tsx` | pass
- 2026-03-10 | `pnpm exec vitest run src/backend/services/__tests__/guidance-orchestrator.test.ts src/backend/routes/__tests__/guidance-api.test.ts src/backend/sse/__tests__/hub.test.ts src/frontend/features/forum/pages/__tests__/FeedPage.test.tsx` | pass
- 2026-03-10 | `pnpm typecheck` | fail（仍是既有 room / pg Prisma typing 问题，与本轮 guidance 修复无关）

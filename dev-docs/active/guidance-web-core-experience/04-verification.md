# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm -s typecheck` | pass |
| `pnpm -s vitest run src/frontend/features/**/__tests__/*.test.tsx src/frontend/shared/components/**/__tests__/*.test.tsx` | pass |
| `pnpm -s vitest run src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx` | pass |

## Scenario checklist
- [ ] 匿名首访首页能看到双主线，不出现“先选模式”阻断
- [ ] 登录后 guidance 状态延续，不重复 Day 0 体验
- [ ] inbox 未读数、列表页和首页模块状态一致
- [ ] 帖子页 / Agent 页 follow payoff 能把用户带入 highlights 或 following feed payoff
- [ ] 私聊 receipt 从 pending 自动升级到 ready
- [ ] memories / chronicle / achievements 页面存在来源说明与下一步 CTA
- [ ] Day 0 时 owner 高级控制被延后揭示，first success 后才展开
- [ ] CTA 深链与 action 上报正确

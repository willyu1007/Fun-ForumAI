# 03 Implementation Notes

## Status
- Current status: `done`
- Last updated: 2026-04-15

## What changed
- `prisma/schema.prisma`: 新增 `HumanCommunityFollow` 和 `HumanThreadFollow` 模型。
- `src/backend/services/following-feed-service.ts`: 新增 Feed 聚合服务，提供社区、智能体、帖子三种维度的 Feed。
- `src/backend/routes/read/read-feed-routes.ts`: 新增 `/me/feed/communities`, `/me/feed/agents`, `/me/feed/threads` 接口。
- `src/frontend/widgets/shell/ShellLeftRail.tsx`: 左侧导航栏“我的关联”改为“关注”。
- `src/frontend/features/user/pages/MyActivityPage.tsx`: 重写为全宽列表流 UI，移除 Card，接入新的 Feed 接口。
- **(Phase 4 Pivot)**: `src/backend/services/following-feed-service.ts` 补充 `listFollowingAgents`, `listFollowingCommunities`, `listFollowingThreads` 接口。
- **(Phase 4 Pivot)**: `src/frontend/features/user/pages/MyActivityPage.tsx` 重构为响应式布局：移动端保持单列聚合流，桌面端采用左右分栏（Master-Detail）布局，左侧为关注列表，右侧嵌入 `CommunityFeedPage`、`PostDetailPage` 或自定义的智能体动态历史。

## Files/modules touched (high level)
- `prisma/schema.prisma`
- `src/backend/services/following-feed-service.ts`
- `src/backend/routes/read/read-feed-routes.ts`
- `src/frontend/widgets/shell/ShellLeftRail.tsx`
- `src/frontend/features/user/pages/MyActivityPage.tsx`
- `src/frontend/api/hooks/user.ts`
- `src/frontend/features/forum/pages/CommunityFeedPage.tsx` (允许传入 overrideSlug)
- `src/frontend/features/forum/pages/PostDetailPage.tsx` (允许传入 overridePostId)

## Decisions & tradeoffs
- Decision: 智能体精彩回复标准定为 `upvotes + downvotes > 5`。
  - Rationale: 用户确认的简单明确规则，无需依赖复杂的高光标记。
- Decision: 帖子进展聚合展示，只展示最近的一条回复，并提示“有 X 条新回复”。
  - Rationale: 避免信息流被同一个帖子刷屏，提升阅读体验。
- Decision: 桌面端采用 Master-Detail 左右分栏布局。
  - Rationale: 减少页面跳转，提升信息获取效率。右侧直接复用现有的社区/帖子详情页面组件。

## Deviations from plan
- 增加了 Phase 4（桌面端左右分栏重构），从纯信息流转变为列表-详情结构。

## Known issues / follow-ups
- 智能体精彩回复的 DB 层过滤（点赞+踩>5）目前在 Schema 中没有直接的聚合字段，可能需要在应用层或通过复杂查询实现。目前为了快速跑通流程，先拉取了最新回复。后续可以考虑在 `PublicStageTurn` 表加冗余字段 `voteScore` 或 `totalVotes`。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).

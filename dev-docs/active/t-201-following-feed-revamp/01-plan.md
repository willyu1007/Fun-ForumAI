# 01 Plan

## Phases
1. Phase 1: 数据库与上下文更新
2. Phase 2: 后端 Feed API 实现
3. Phase 3: 前端 UI 重构
4. Phase 4: 桌面端左右分栏重构 (Pivot)

## Detailed steps
- 修改 `prisma/schema.prisma`，增加 `HumanCommunityFollow` 和 `HumanThreadFollow`。
- 运行同步脚本更新 DB Context。
- 实现 `src/backend/services/following-feed-service.ts`。
- 实现 `src/backend/routes/me-feed.ts`。
- 更新 `ShellLeftRail.tsx`，修改文案和图标。
- 重写 `MyActivityPage.tsx`，移除 Card，使用全宽的 `div` 列表项和 `Divider`。
- 接入 Phase 2 提供的 API hooks。
- **(Phase 4)** 后端补充 `GET /api/me/following/*` 接口，提供关注列表。
- **(Phase 4)** 前端重构 `MyActivityPage.tsx`，桌面端采用 Master-Detail 左右分栏，移动端保持单列聚合流。
- **(Phase 4)** 右侧嵌入现有的社区/帖子详情组件，或渲染智能体动态历史。

## Risks & mitigations
- Risk: Feed 查询性能问题
  - Mitigation: 在 DB 层添加合适的复合索引 (userId, createdAt)，并在接口层面进行分页或限制返回数量。

# 02 Architecture

## Context & current state
目前系统支持用户关注智能体（`HumanAgentFollow`），但不支持关注社区和帖子。前端“我的关联”页面展示的是静态的列表，缺乏动态信息流。

## Proposed design

### Components / modules
- **Database**: 新增 `HumanCommunityFollow` 和 `HumanThreadFollow` 模型。
- **Backend Service**: 新增 `following-feed-service.ts` 负责聚合查询。
- **Backend Route**: 新增 `/api/me/feed/*` 路由。
- **Frontend UI**: 重构 `MyActivityPage.tsx` 为全宽列表流，更新导航栏。

### Interfaces & contracts
- API endpoints:
  - `GET /api/me/feed/communities`
  - `GET /api/me/feed/agents`
  - `GET /api/me/feed/threads`
- Data models / schemas:
  - `HumanCommunityFollow` (userId, communityId)
  - `HumanThreadFollow` (userId, threadId)

### Boundaries & dependency rules
- Allowed dependencies: Feed Service 可以依赖 Prisma Client 进行聚合查询。
- Forbidden dependencies: 前端 UI 不应直接耦合具体的业务逻辑，应通过 API hooks 获取数据。

## Data migration (if applicable)
- Migration steps: 运行 `prisma db push` 或 `prisma migrate dev`。
- Backward compatibility strategy: 原 `/my/activity` 路由保持不变，但内容完全替换。

## Non-functional considerations
- Security/auth/permissions: Feed 接口需要用户登录认证。
- Performance: 聚合查询需要合适的索引支持。

## Open questions
- 无（已在 roadmap 中对齐）。

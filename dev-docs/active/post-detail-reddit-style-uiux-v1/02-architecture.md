# 02 Architecture

## Context & current state
- 讨论森林与时间线以 `<Tabs>` 平级展示（[PostDetailPage.tsx](../../../src/frontend/features/forum/pages/PostDetailPage.tsx) L1054–1136）。
- 顶部 composer 同时服务于 "发起公开分支"（`createPublicThread`）与 "沿节点继续"（`createPublicTurn`），通过 `composerAnchorNodeId` + `selectedForestNodeId` 双轨锚点 state 驱动（L939–1053）。
- `MyActivityPage` 使用 `hideDiscussionArea=true`（[MyActivityPage.tsx](../../../src/frontend/features/user/pages/MyActivityPage.tsx) L924–930），实际却仍渲染 `ThreadList` 作为简化讨论区。
- 后端同时提供 `/posts/:postId/threads-summary` 与 `/threads/:threadId` HTTP 端点支持 timeline；`forumReadService.getThreadSummaries` 为 timeline HTTP 独立分支；`home-programming-service.resolveNextJumpTargetForPost` 用 `getThreadSummaries` 首选、`getThreads` 兜底。
- Telemetry 枚举 `timeline_open`、`discovered_via=timeline` 分布在 `shared/forum-orchestration.ts` + `backend/validation/schemas.ts` + `backend/services/forum-watch-telemetry-service.ts`。

## Proposed design

### Components / modules

#### 新增
- `src/frontend/features/forum/components/StageToolbar.tsx`
  - Props：`participationContract: PostParticipationContract | null`、`sortMode: 'recommended' | 'latest_activity'`、`onSortModeChange(mode)`。
  - 子组件 `ParticipationChips`（同文件或独立文件，二选一；本任务内联以控制面）。
- `DiscussionForest` 内新增 `InlineNodeReplyComposer` 子组件（不改动外部导入 surface）。

#### 修改
- `PostDetailPage.tsx` 大面积瘦身（删除 timeline state / 顶部 composer / Tabs）。
- `DiscussionForest.tsx` 增加节点级 Reply 展开行为；新增 `sortMode` / `turnReplyEnabled` / `onReplyOpen` props；移除 `replyActionLabel`。

#### 删除
- `ThreadList.tsx`、`ThreadList.test.tsx`、`useThreadSummaries`、`useThread`、`useThreads` hooks。
- timeline-only 类型 `PublicStageThreadSummaryData`、`PublicStageThreadDetailData`。
- 后端 HTTP 路由 `/posts/:postId/threads-summary`、`/threads/:threadId`。
- `forumReadService.getThreadSummaries` 方法。
- `timeline_open` telemetry 枚举；`discovered_via=timeline` 枚举值。
- OpenAPI 对应 operation + schemas。

### Interfaces & contracts

#### API endpoints（本次改动）
- **移除（公开 HTTP）**：
  - `GET /v1/posts/:postId/threads-summary`
  - `GET /v1/threads/:threadId`
- **保留不变**：
  - `GET /v1/posts/:postId/threads`（被 `home-programming-service` 内部 fallback 使用；frontend 已无消费）
  - `GET /v1/posts/:postId/discussion-forest`
  - `GET /v1/posts/:postId/reading-guide`
  - `POST /v1/posts/:postId/watch-telemetry`（枚举缩减 `timeline_open`）

#### Data models / schemas
- **移除**：
  - `PublicStageThreadSummaryData`、`PublicStageThreadDetailData`（TS 前端）。
  - `DiscoveredVia` 等联合类型中 `'timeline'` 成员。
  - `ForumWatchTelemetryEventType` 中 `'timeline_open'`。
  - OpenAPI `PublicStageThreadSummary` / `PublicStageThreadSummaryList` / `PublicStageThreadDetail` 及其 response envelopes。
- **新增**：无（`PostParticipationContract` 已有，直接消费）。

#### Events / jobs
- 本次不动 SSE / job。

### Boundaries & dependency rules
- `PostDetailPage` → `StageToolbar`、`DiscussionForest`、`(audience/aftershow)`；**禁止** 再引入 `ThreadList` 或 `useThreadSummaries`。
- `DiscussionForest` → 内部 `InlineNodeReplyComposer` → `useCreatePublicTurn`；**禁止** 使用 `useCreatePublicThread`（Agent-only 契约）。
- `ParticipationChips` 只读 `participationContract`，不触发 mutation。
- 后端：`home-programming-service` 只通过 `forumReadService.getThreads()` 获取线程；**禁止** 反向引入 `getThreadSummaries`。

## Data migration
- 不涉及 DB migration。
- Telemetry 枚举缩减对历史 event log 无影响（going-forward-only）。`timeline_open` 历史记录会在聚合维度无视，下游 dashboard 若有依赖按 "deprecated 枚举" 处理。

## Rollout plan
- 单 PR（含前后端 + OpenAPI + 测试），因为前端已不依赖 timeline HTTP，后端删除不会造成前端运行时断裂。
- 部署顺序可自由（前后端并行，不存在 request-contract 断档）。

## Non-functional considerations

### Security / auth / permissions
- `ParticipationChips` 仅展示已签 contract 的公开字段，不泄漏 orchestration 内部权重。
- `InlineNodeReplyComposer` 沿用既有 `useCreatePublicTurn` 的鉴权链路（cookies + CSRF 中间件），不引入新鉴权面。

### Performance
- 前端移除 `useThreadSummaries` lazy query 后，详情页请求数在非深链场景减少 1 条；深链 `?stage=timeline` 不再触发任何额外请求（参数被忽略）。
- 后端 HTTP 表面积收缩；冷启动 bundle 大小略减（ThreadList + 相关类型约 35KB 源码）。

### Observability
- `reply_anchor_select` 事件保留，`source_shelf` 固定为 `'forest'`。
- `timeline_open` 从枚举中移除后，遥测服务内部若尝试写入该事件会在 Zod 校验处被拒（安全行为，期望 0 发生）。
- 增加一次 CI 用的 `rg` root-out 检查保护未来漂移（建议进 `04-verification.md` 而非 CI，首次落地不扩张 CI）。

## Open questions
- OpenAPI `getForumThreadList`（`/posts/:postId/threads`）是否也应废弃？
  - 当前仅 `home-programming-service` 内部调用（不走 HTTP），且 `public-observation-digest-service` 也用 `getThreads`。后端服务方法必须保留；HTTP 端点是否留待下一轮"observation/home 清理任务"拍板。本任务 **保留**。
- `ParticipationChips` "查看规则" 链接目标页：
  - 一期挂 `/help/report-appeal-delete`；后续若新建 `/help/participation-rules`，按 follow-up 任务替换。

## Iteration 5 — Audience rail Reddit-ization

### Components / modules
- 新增 `src/frontend/features/forum/components/AudiencePanel.tsx`：单一、自包含的观众席面板；内嵌 `AudienceComposer / AudienceMessageItem / AudienceMessageHeader / AudienceQuoteChip / AudienceActionRow / AudienceReplyComposer`。接口精简为 `{ postId, isAuthenticated, canPost, viewerUserId?, composePrefill?, onConsumePrefill?, onNavigateToTurn?, focusedMessageId? }`。
- 修改 `DiscussionForest.tsx`：新增 `audiencePostingEnabled / onDiscussInAudience` props；在节点动作栏渲染"观众席讨论"入口。
- 修改 `PostDetailPage.tsx`：移除 `useAftershow / useAsideSeats / aftershowContent / railPlaceholder / audienceDraft*`；仅根据 `participationContract.audience_lane.enabled` 条件渲染 `AudiencePanel`；新增 `audience_compose_for / audience_compose_excerpt / audience_compose_author` 深链参数。

### Interfaces & contracts
- **新增 HTTP**：
  - `DELETE /v1/viewer/audience-messages/:messageId` → `{ message_id, deleted_at }`
  - `POST /v1/viewer/audience-messages/:messageId/likes` → `{ message_id, like_count, viewer_has_liked }`
  - `DELETE /v1/viewer/audience-messages/:messageId/likes` → 同上
  - `GET /v1/posts/:postId/audience-thread?sort=latest|top` → `{ thread, sort, messages: AudienceMessageWithReplies[] }`
  - `POST /v1/viewer/posts/:postId/audience-messages` 扩参 `parent_message_id?, quoted_turn?`
- **Schema**：新增 `AudienceThreadSort / AudienceMessage / AudienceMessageWithReplies / AudienceQuotedTurnRef / AudienceMessageLikeResult / AudienceMessageDeleteResult / CreateAudienceMessageInput`。

### Data models / schemas
- Prisma：`AudienceMessage` 扩 `parent_message_id / quoted_turn_id / quoted_turn_excerpt / quoted_turn_author_name / deleted_at / like_count`；新 `AudienceMessageLike(message_id, user_id, created_at)` unique `(message_id, user_id)`。
- DB SSOT：`docs/context/db/schema.json` 同步；内存 repo 与 pg repo 双实现。

### Boundaries & dependency rules
- `AudiencePanel` 严禁消费 aftershow / reading-guide / aside_seats 字段；严禁从前端 join 用户信息（`author` 必须来自后端 `AudienceService.authorLookup`）。
- 主线程（`DiscussionForest`）严禁消费观众席信号（`like_count` / 留言数量）做排序或徽标展示。
- `DELETE` 只能由消息作者本人触发（`AudienceService.softDeleteMessage` 做 ACL）。
- 回复深度严格 1 层；服务端对两层回复直接抛 `ValidationError`。

### Rollout
- 单 PR 覆盖 DB schema + repo + service + routes + OpenAPI + frontend，按任务包 Iteration 5 决策边界（C1-C8）落地。
- 部署顺序：先出 DB migration，再推 service/route/前端；回滚只需把 OpenAPI 和前端拆卸，数据库新字段保持向下兼容（皆为 nullable / 默认值）。

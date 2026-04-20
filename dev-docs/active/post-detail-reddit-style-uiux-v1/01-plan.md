# 01 Plan

## Phases
1. **Phase 0 — Dev-docs bundle**（本文件 + overview + architecture + pitfalls + governance sync）。
2. **Phase 1 — 帖子详情页重写**：删除顶部 composer / Tabs / timeline state；新增 `StageToolbar` + `ParticipationChips` + `Sort by`。
3. **Phase 2 — 节点内就地回复**：DiscussionForest 新增 `InlineNodeReplyComposer`；`active_route.cta` 替换 Reply；`reply_anchor_select` telemetry 迁移。
4. **Phase 3 — `hideDiscussionArea` 回归本义**：`hideDiscussionArea=true` 完全不渲染讨论区；MyActivityPage 嵌入验证。
5. **Phase 4 — 前端 timeline 代码删除**：`ThreadList`、相关 hooks、类型、query-keys。
6. **Phase 5 — 后端 timeline 代码删除**：HTTP 路由、`getThreadSummaries` 服务方法、telemetry 枚举、`discovered_via` 枚举、OpenAPI。
7. **Phase 6 — 测试更新**：`PostDetailPage.test` 重写、`DiscussionForest.test` 扩展、删除 `ThreadList.test`、更新 `e2e-read-api.test`、更新 Playwright。
8. **Phase 7 — 验证**：`pnpm typecheck/lint/test`、`ctl-openapi-quality verify`、`ctl-api-index generate`、root-out grep、Chrome DevTools MCP 手测、`04-verification.md` 记录。

## Detailed steps

### Phase 1 — PostDetailPage.tsx
- 删除 imports：`useCreatePublicThread`、`useCreatePublicTurn`（下沉）、`useThreadSummaries`、`ThreadList`、`Tabs/TabsContent/TabsList/TabsTrigger`（讨论区用途）。
- 删除 state/handlers：`stageView`、`preferredStageView`、`previousStageViewRef`、`composerAnchorNodeId`、`explicitComposerAnchorNode`、`composerAnchorNode`、`canClearComposerAnchor`、`selectedForestWriteability`、`selectedForestRouteCtaLabel`、`isThreadReplyable`、`handleSubmitStageReply`、`publicReplyDraft/Error/Notice`。
- 删除 telemetry 发送点 `timeline_open`。
- 删除 `?stage=timeline` 读取。
- 新增 state：`sortMode: 'recommended' | 'latest_activity'`，读/写 `?sort=`。
- 新增组件使用：`<StageToolbar participationContract={...} sortMode={...} onSortModeChange={...} />`。
- `DiscussionForest` prop：新增 `sortMode`，移除 `replyActionLabel` 按旧语义（改为 DiscussionForest 内部根据 `turn_reply_enabled` 与节点 writeability 决定）。
- `hideDiscussionArea=true` 路径：直接 `return null`（连 `NewContentBanner` 和 `ThreadList` 一并移除）。
- `useDiscussionForest` / `useAudienceThread` / `useAftershow` / `useAsideSeats` 的 `enabled` gating 维持现状。

### Phase 2 — DiscussionForest.tsx
- 新增子组件 `InlineNodeReplyComposer`（同文件，避免重构量放大）：
  - Props：`postId`、`node`、`onSuccess(result)`、`onCancel()`。
  - 内部 hook：`useCreatePublicTurn`。
  - Payload：`anchor_turn_id / focused_turn_id / actual_anchor_turn_id` 取自 node；`quoted_excerpt = node.body.slice(0, 180)`；`idempotency_key = \`viewer-stage:${postId}:${Date.now()}\``；`source_context.source_shelf = 'forest'`。
  - UI：引用预览 + Textarea + [取消] [发送回应]；错误/成功就地文字。
- 新增 props 到 `DiscussionForest`：`sortMode?: 'recommended' | 'latest_activity'`（默认 `recommended`）、`turnReplyEnabled?: boolean`（页面层透传）。
- 节点渲染按钮规则：
  - `turnReplyEnabled === false` → 不渲染 Reply / CTA（CTA 仍是导航性质，非回复；保持现有 handoff CTA 行为独立于 turnReplyEnabled）。重新审视后 decision：**handoff CTA 独立于 turnReplyEnabled**，即使帖子不允许主线程回复，CTA 仍展示（否则 "去 @agent-x 继续" 会丢）。→ 规则：`turnReplyEnabled=false && !activeRouteCta` 无按钮；`turnReplyEnabled=false && activeRouteCta` 仅展示 CTA；`turnReplyEnabled=true` 时按 writeability 决定 Reply / CTA。
  - `allowsDirectThreadReply(writeability)=false` 且存在 `active_route.cta` → 展示 CTA 替换 Reply。
  - `allowsDirectThreadReply(writeability)=true` → 展示 "回应这里"，点击展开 InlineNodeReplyComposer（组件内本地展开状态 via `activeReplyNodeId`）。
- Sort 实现：在 `buildClusterViews` 排序阶段接入 `sortMode`；`recommended` 保留 reading_guide 顺序；`latest_activity` 按 `group.latest_activity_at` 降序。
- Telemetry：移除 `replyActionLabel` prop（不再由外部决定），`reply_anchor_select` 在 "回应这里" 点击时由 DiscussionForest 通过回调或直接 `useRecordForumWatchTelemetry` 发送。为避免耦合，保留 `onBranchExpand`/`onSelectNode` 回调，通过新回调 `onReplyOpen(node)` 让 PostDetailPage 发送 telemetry（更少破坏面）。

### Phase 3 — hideDiscussionArea
- PostDetailPage 中 `hideDiscussionArea=true` 分支直接 `return null` 替代现有 `<section>...<ThreadList/></section>`。
- 确认现有 `enabled: !hideDiscussionArea` 对 `useDiscussionForest`、`useAudienceThread`、`useAftershow`、`useAsideSeats` 的 gating 已到位；`usePostParticipationContract` 同样已 gate。
- `useThreadSummaries` 调用完全移除（见 Phase 4）。
- MyActivityPage 代码不变；视觉验证 `hideDiscussionArea` prop 真实语义。

### Phase 4 — 前端 timeline 代码删除
- 删除文件：
  - `src/frontend/features/forum/components/ThreadList.tsx`
  - `src/frontend/features/forum/components/__tests__/ThreadList.test.tsx`
- 修改 `src/frontend/api/hooks/forum.ts`：删除 `useThreadSummaries`、`useThread`、`useThreads`；删除对应 import。
- 修改 `src/frontend/api/hooks/index.ts`（如有 re-export）：移除对应导出。
- 修改 `src/frontend/api/types.ts`：删除 `PublicStageThreadSummaryData`、`PublicStageThreadDetailData` 类型及对应 ThreadListResponse / ThreadResponse（需确认命名）。
- 修改 `src/frontend/api/query-keys.ts`：删除 `threadSummaries`、`thread` key。

### Phase 5 — 后端 timeline 代码删除
- `src/backend/routes/read/read-discussion-routes.ts`：删除 `GET /posts/:postId/threads-summary`、`GET /threads/:threadId` 两条 handler。
- `src/backend/services/forum-read-service.ts`：
  - 删除 `getThreadSummaries` 方法。
  - 删除 `getThread` 中仅服务 timeline 深链的 `around_turn_id` / `turn_cursor` / `turn_limit` 等参数支持（确认仅 timeline HTTP 在用后再删；后端内部 `getThread(id)` 不传这些参数，保持）。
- `src/backend/services/home-programming-service.ts`（第 820 行附近）：简化为 `await this.deps.forumReadService.getThreads(postId, { limit: 20 }, viewerUserId)`；删除 `typeof ... === 'function'` 分支。
- `src/backend/services/forum-watch-telemetry-service.ts`：`FORUM_WATCH_TELEMETRY_EVENT_TYPES` 删除 `'timeline_open'`；默认计数 map 删除同键。
- `src/backend/validation/schemas.ts`：`forumWatchTelemetrySchema` 的 enum 删除 `timeline_open`；`discovered_via` 或相关 enum 删除 `timeline`（通过 grep 检查）。
- `src/shared/forum-orchestration.ts`：`discovered_via` 枚举删除 `'timeline'`；相关 TS 联合类型同步。
- `docs/context/api/openapi.yaml`：
  - 删除 operation `getForumThreadSummaries`、`getForumThreadDetail`。
  - 删除对应 request/response schema（仅 timeline 使用）：`PublicStageThreadSummary`、`PublicStageThreadSummaryList`、`PublicStageThreadDetail` 相关（按 grep 确认）。
  - `discovered_via.enum` 删除 `timeline`。
  - `ForumWatchTelemetryRequest.event_type.enum` 删除 `timeline_open`。
- 运行：
  - `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict`
  - `node .ai/scripts/ctl-api-index.mjs generate --touch`

### Phase 6 — 测试更新
- `PostDetailPage.test.tsx` 重写：
  - 移除 `useThreadSummaries` mock / `threadListMock` / `?stage=timeline` / `timeline_open` / `useCreatePublicThread` 相关用例。
  - 新增（按 acceptance criteria）：顶部 composer 不渲染 / Sort 切换 / ParticipationChips 状态 / 节点 Reply 就地展开 / `hideDiscussionArea=true` 无讨论 DOM。
- `DiscussionForest.test.tsx` 扩展：`InlineNodeReplyComposer` 交互、`active_route.cta` 替换 Reply、`sortMode='latest_activity'` 重排。
- 删除 `ThreadList.test.tsx`。
- `e2e-read-api.test.ts`：删除 `threads-summary` / `/v1/threads/:threadId` e2e 用例；删除 `timeline_open` telemetry 用例。
- `forum-read-service.test.ts`：删除 `getThreadSummaries` 测试；保留 `getThread` 基础测试（针对其他消费者）。
- Playwright `forum-orchestration.e2e.spec.ts`：移除 "时间线" tab 断言；替换为 forest 默认 + sort 切换断言。

### Phase 7 — 验证
见 `04-verification.md`（完成后填写）。

## Iteration 5 — 观众席 Reddit 化 + 社交能力

### Scope
产品意图：**观众席 = 人类 ↔ 人类的独立讨论空间**。视觉与主舞台区隔但去剧场化；唯一允许的跨区链路是"留言引用主线程某个 turn"的单向 chip。所有导演层内容（aftershow / reading-guide UI / aside_seats 的前端消费）继续保持下线。

### 决策清单（已与用户确认）
- C1 空间形态：**C1-a**（桌面保留右栏，彻底去卡片化；移动端保留 Tab，标签 `主线程 / 观众席`）。
- C2 引用链路：**C2-a**，从 forest 节点 "在观众席讨论这条" 入口 → 通过 URL state 预填 composer，引用单向（主线程节点不感知被引用）。
- C3 社交能力：**点赞 + 1 层回复 + 删除自己 + 举报**；不做无限嵌套 / 编辑 / 置顶 / @mentions。
- C4 排序：**最新（默认降序）/ 热门**（按 `like_count desc, created_at desc`）。
- C5 作者契约：后端 `AudienceMessage` 升级为 `{ id, thread_id, author: { id, display_name, avatar_url }, body, like_count, viewer_has_liked, parent_message_id, quoted_turn, replies, created_at, deleted_at }`。
- C6 composer：**常驻克制**——单行高度 input 风格 placeholder，focus 后展开为 2-3 行 Textarea + 发送按钮。
- C7 深链：`?audience_message_id` 保留；`?audience_compose_for=<turn_id>` 新增（从 forest 节点触发预填）；aftershow callout → audience_message_id 的老桥已随 aftershow UI 下线一并清理。
- C8 "观众席内部高光"：**不做独立板块**，完全交给排序选项的 "热门" 承载。

### 详细步骤

#### Phase 1 — DB schema & repo
1. `prisma/schema.prisma`
   - `AudienceMessage` 追加：`parentMessageId String? @map("parent_message_id")`、`quotedTurnId String? @map("quoted_turn_id")`、`quotedTurnExcerpt String? @map("quoted_turn_excerpt")`、`quotedTurnAuthorName String? @map("quoted_turn_author_name")`、`deletedAt DateTime? @map("deleted_at")`。
   - 自引用 `parent AudienceMessage? @relation("AudienceMessageReplies", fields: [parentMessageId], references: [id])` + `replies AudienceMessage[] @relation("AudienceMessageReplies")`。
   - 新增 `AudienceMessageLike` 模型：`{ id, messageId, userId, createdAt }`，`@@unique([messageId, userId])`。
   - Migration: `pnpm prisma migrate dev --name audience_reply_like_quote`（repo-prisma SSOT，走 `sync-db-schema-from-code` skill）。
2. `src/backend/repos/types/audience.ts` 扩充 `AudienceMessage` 字段、新增 `AudienceMessageWithAggregates` / `AudienceMessageLike` 类型与 input 类型（`CreateAudienceMessageInput` 增 parent/quote、`ToggleAudienceMessageLikeInput`、`SoftDeleteAudienceMessageInput`）。
3. `src/backend/repos/audience-repository.ts`
   - 新增接口方法：`listMessagesWithAggregates(threadId, viewerUserId?)`、`findMessageById(id)`、`softDeleteMessage(id)`、`likeMessage(input)`、`unlikeMessage(input)`、`countLikesForMessages(ids)`、`listLikesByViewer(messageIds, userId)`。
   - `InMemoryAudienceRepository` 同步实现全部方法；旧 `listMessagesByThread` 继续可用给 `buildAudienceSignalCapsule` 等消费者（只读 body/created_at/author_user_id）。
4. `src/backend/repos/pg/pg-audience-repository.ts` 同步新字段映射与新方法；`listMessagesWithAggregates` 用 `audience_message_likes` GROUP BY + LEFT JOIN viewer like + JOIN `human_user` 拿 display_name/avatar_url。

#### Phase 2 — Service + 路由 + 校验
1. `src/backend/services/audience-service.ts`：`createAcceptedMessage` 接受 `parent_message_id` + `quoted_turn`；父记录不存在 / 父记录已 soft-delete / 父记录自身也是 reply（防嵌套）时返回 domain error。新增 `softDeleteMessage(viewerUserId, messageId)` / `toggleLike(userId, messageId, liked)`。
2. `src/backend/services/viewer-public-write-service.ts`：`createAudienceMessage` 接收新字段；新增 `deleteAudienceMessage` / `toggleAudienceMessageLike`（都走 idempotency / governance）。
3. `src/backend/services/forum-read-service.ts`：帖子 audience thread 读取改走 `listMessagesWithAggregates`；返回结构改为嵌套（top-level list，每个带 `replies: AudienceMessage[]`），排序参数 `sort: 'latest' | 'top'` 默认 `'latest'`。
4. `src/backend/routes/viewer-write-api.ts`
   - 已有：`POST /viewer/posts/:postId/audience-messages`（扩 body）。
   - 新增：`DELETE /viewer/audience-messages/:messageId`、`POST /viewer/audience-messages/:messageId/likes`、`DELETE /viewer/audience-messages/:messageId/likes`。
5. `src/backend/routes/read/read-discussion-routes.ts`：`GET /posts/:postId/audience-thread` 增加 `?sort=` query + 响应加 `viewer_has_liked / like_count / replies / quoted_turn / author / deleted_at`。
6. `src/backend/validation/schemas.ts`：`createAudienceMessageSchema` 增 `parent_message_id` / `quoted_turn`；新 `toggleAudienceMessageLikeSchema` / `deleteAudienceMessageSchema`。

#### Phase 3 — OpenAPI + api-index
1. `docs/context/api/openapi.yaml`：升级 `AudienceMessage` schema；新增 3 个 operations（delete / like / unlike）；`getAudienceThread` 增 `sort` query 参数。
2. `ctl-openapi-quality.mjs verify` + `ctl-api-index.mjs generate --touch`。

#### Phase 4 — Frontend types + hooks
1. `src/frontend/api/types.ts`：`AudienceMessage` 升级（author / like_count / viewer_has_liked / parent_message_id / quoted_turn / replies / deleted_at）。
2. `src/frontend/api/hooks/forum.ts`：
   - `useAudienceThread` 接受 `{ sort?: 'latest' | 'top' }`。
   - `useCreateAudienceMessage` 支持 `parent_message_id / quoted_turn`。
   - 新增 `useDeleteAudienceMessage / useToggleAudienceMessageLike`。
3. `src/frontend/api/query-keys.ts`：`audienceThread(postId, sort)`。

#### Phase 5 — AudiencePanel 抽组件 + Reddit 化
1. 新文件 `src/frontend/features/forum/components/AudiencePanel.tsx`：承担观众席所有 UI，props `{ postId, composerPrefillFromTurn?, audienceMessages, composerEnabled, sort, onSortChange, authViewer }`。
2. 视觉规则：
   - 顶栏：`留言` 小 label + sort 下拉 `最新 / 热门`（同 `StageToolbar` 风格，12px muted）。
   - composer：常驻克制，faux input → focus 展开，不在未登录 / 关闭时渲染。
   - 列表：每条 top-level 留言显示 avatar(size-6) · display_name · 相对时间 · 正文 · 操作行 `赞(N) · 回复 · [更多]`；自己的留言 `[更多]` 里出现 `删除`，其他人是 `举报`。
   - `quoted_turn` chip：正文上方一行 `↳ @{作者} "xx..."`，点击触发 forest 节点 `scrollIntoView` + ring 高亮。
   - 1 层回复：每条 top-level 下方可 inline 展开 reply composer；replies 列表用左 rail `border-l-2 pl-3` 缩进（仅 1 层，不嵌套）。
   - 删除留言用 tombstone 展示（"该留言已被删除"），保留 replies 挂载。
3. 去卡片化：rail shell 不再用 `bg-muted/70 border-l` 整块底色 + 隔线；改为主背景同色、顶栏有一条 `h-px bg-border/40` 分界即可。`railPlaceholder` 整块删除。
4. 深链行为：`?audience_message_id` 继续走 Iteration 4 样式的 scrollIntoView + ring；`?audience_compose_for=<turn_id>` 触发时把引用 chip 预填到 composer，并自动 focus 展开。

#### Phase 6 — Forest 节点入口 + Page 清理
1. `DiscussionForest.tsx`：节点操作行新增 `在观众席讨论这条` 按钮（仅在 `audience_lane.enabled && posting_enabled` 时展示）；点击 → `setSearchParams({ audience_compose_for: node.id }, { replace: true })`。
2. `PostDetailPage.tsx`：
   - 删除 `useAsideSeats / asideSeatsEnabled / asideSeatsPayload / asideSeats` 全链条；`hasAudienceRail` 简化为 `audienceZoneEnabled && Boolean(audienceThread)`。
   - 删除 `focusedCallout?.audience_message_id` 作为 audience 深链兜底的旧逻辑（aftershow UI 已下线）；深链只来自显式 `?audience_message_id`。
   - 用 `<AudiencePanel />` 替换内联 `audiencePanel` JSX。

#### Phase 7 — 测试
1. 后端：`audience-service.test.ts`（createAcceptedMessage 带 parent/quote、softDelete 防越权、toggleLike 幂等、reply 不得有 grand-child）、`viewer-public-write-service.test.ts`、`e2e-read-api.test.ts`（audience-thread 新响应结构 + sort 切换）。
2. 前端：`AudiencePanel.test.tsx`（渲染、sort 切换、composer 展开、quoted_turn chip 点击、点赞 toggle、1 层回复 inline 展开、删除/举报菜单）；`PostDetailPage.test.tsx`（railPlaceholder 不渲染、`?audience_compose_for=X` 预填）；`DiscussionForest.test.tsx`（audience 入口显示/隐藏）。
3. Playwright `forum-orchestration.e2e.spec.ts`：替换观众席断言。

#### Phase 8 — 验证 + governance sync
- `pnpm prisma migrate status` + vitest 全量 + `ctl-openapi-quality verify` + `ctl-api-index generate` + `ui_gate.py run --mode minimal` + `ctl-project-governance.mjs sync --apply`。
- `04-verification.md` 追加 Iteration 5 章节（范围、行为矩阵、grep 清单、待做手测项）。

### Iteration 5 的 do-not-drift 边界
- **不要在观众席回显任何 aftershow / reading-guide / aside_seats 字段**；即使后端返回也不要 render。
- **不要把观众席任一信号反向渗透进主线程**：主线程节点不显示"有 N 条留言讨论这条"、forest tree 排序不受 audience 活跃度影响。
- **不要做超过 1 层嵌套**；服务端对第二层 reply 直接 400。
- **不要给观众席加导演算法**（"今日热门"、"官方置顶板块"）；"热门"只来自排序选项，不做独立板块。
- **不要从前端 join 用户信息**；display_name / avatar_url 必须来自后端 `AudienceMessage.author`。

## Risks & mitigations
- Risk: 后端 `getThread` 参数分支删除过多，影响 lifecycle / snapshot 路径。
  - Mitigation: 只删仅 timeline 使用的参数（`around_turn_id` / `turn_cursor` / `turn_limit`），先 grep 全仓确认无其他调用再删；有疑问保留参数支持。
- Risk: OpenAPI schema 变更撞 strict verify。
  - Mitigation: 小步删除，每删一批立刻运行 `ctl-openapi-quality verify`，失败立刻回退。
- Risk: MyActivityPage `hideDiscussionArea` 用户习惯断裂。
  - Mitigation: 只截除讨论区；帖子正文 / 投票 / 观众 rail 维持，并在 `05-pitfalls.md` 标注 "prop 回归本义" 的 UX 回归点。
- Risk: `?stage=timeline` 老书签 404。
  - Mitigation: 只丢弃参数，不跳转；`PostDetailPage` 初始化不读该参数即可。
- Risk: Playwright e2e 依赖 `threads-summary` mock。
  - Mitigation: fixture 删减，改为覆盖 forest 新交互（inline reply）。

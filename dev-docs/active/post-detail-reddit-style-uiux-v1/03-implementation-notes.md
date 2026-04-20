# 03 Implementation Notes

## Phase 0 — Dev-docs bundle
- 2026-04-19: 建立 `dev-docs/active/post-detail-reddit-style-uiux-v1/` 任务包，六个标准文件（00/01/02/03/04/05）初始化。
- Pitfalls 继承：`forum-post-detail-discussion-forest-v1/05-pitfalls.md` 的三条 do-not-repeat（不把 forest 做成 comment tree / 不让 timeline 爬回主视图 / 不同时渲染两套完整详情 DOM）。

## Iteration 1 — Forest 唯一主视图 + Timeline 根除

### Phase 1 — `PostDetailPage.tsx` 顶部重写
- 删除 `<Tabs>`（讨论森林 / 时间线）切换：`stageView / preferredStageView / previousStageViewRef` 状态、`?stage=timeline` 读写、`timeline_open` telemetry emission 全部移除。
- 删除顶部 `公开分支 / 沿节点继续` composer：`composerAnchorNodeId / explicitComposerAnchorNode / composerAnchorNode / canClearComposerAnchor / selectedForestWriteability / selectedForestRouteCtaLabel / isThreadReplyable / handleSubmitStageReply / publicReplyDraft(Error|Notice)` 全部移除。
- 新增 `sortMode: 'recommended' | 'latest_activity'` 状态，以 `?sort=latest_activity` 驱动的受控组件形式回写 URL。
- 引入 `StageToolbar`（含 Sort 下拉 + 参与合约提示）。
- `hideDiscussionArea=true` 路径改为 **真隐藏**：`post-detail-thread-section` 直接不进入 DOM。

### Phase 2 — `DiscussionForest.tsx` 节点级 Reply + CTA 替换
- 新增内联子组件 `InlineNodeReplyComposer`：`useCreatePublicTurn` + `anchor_turn_id/focused_turn_id/actual_anchor_turn_id = node.id`、`quoted_excerpt = node.body.slice(0,180)`、`idempotency_key = viewer-stage:{postId}:{Date.now()}`、`source_context.source_shelf = 'forest'`。
- 新增 `sortMode` / `turnReplyEnabled` / `onReplyOpen` props；移除 `replyActionLabel`。
- 节点按钮规则：`turnReplyEnabled=false && !routeCta` → 无按钮；`turnReplyEnabled=false && routeCta` → 仅展示 CTA；`turnReplyEnabled=true && !allowsDirectThreadReply(writeability)` → 展示 CTA；`turnReplyEnabled=true && allowsDirectThreadReply` → 展示"回复"并可展开 `InlineNodeReplyComposer`（组件内 `activeReplyNodeId` 本地状态）。
- `reply_anchor_select` 通过新 `onReplyOpen` 回调在页面层发送；`node_focus` 在 `onSelectNode` 中发送。

### Phase 3 — `hideDiscussionArea` 回归本义
- `PostDetailPage` 的 `hideDiscussionArea=true` 分支不再渲染 `NewContentBanner` / `StageToolbar` / `DiscussionForest`；`useDiscussionForest/useAudienceThread/useAftershow/useAsideSeats/usePostParticipationContract` 保留已有 `enabled: !hideDiscussionArea` gating。
- `MyActivityPage` 代码无需改动，视觉上回归"仅正文 + 上下文卡片"。

### Phase 4 — 前端 timeline 代码删除
- 删除文件：`src/frontend/features/forum/components/ThreadList.tsx` + `ThreadList.test.tsx`。
- `src/frontend/api/hooks/forum.ts`：移除 `useThreadSummaries / useThread / useThreads`；`forum.ts` 不再 import `PublicStageThreadSummaryData / PublicStageThreadDetailData`。
- `src/frontend/api/types.ts`：删除 `PublicStageThreadSummaryData / PublicStageThreadDetailData`；`ForumWatchTelemetryEventType` 删除 `'timeline_open'`。
- `src/frontend/api/query-keys.ts`：删除 `threadSummaries / thread` 两个 key。
- `src/shared/forum-orchestration.ts`：`discovered_via` 联合类型删除 `'timeline'`。

### Phase 5 — 后端 timeline 代码删除
- `src/backend/routes/read/read-discussion-routes.ts`：删除 `GET /posts/:postId/threads-summary`、`GET /threads/:threadId`。保留 `/posts/:postId/threads`（内部服务仍需）/ `/posts/:postId/discussion-forest` / `/posts/:postId/reading-guide` / `/posts/:postId/watch-telemetry` / 各 `/internal/*` 分析接口。
- `src/backend/services/forum-read-service.ts`：`getThreadSummaries` 整体移除；`getThread` 方法只在内部保留（供 `thread-search-provider`、`getThreadLifecycle` 等消费），公开 HTTP 入口已拆。
- `src/backend/services/home-programming-service.ts`：`resolveNextJumpTargetForPost` 直接调用 `forumReadService.getThreads(postId, { limit: 20 }, viewerUserId)`，删除 `typeof getThreadSummaries === 'function'` 兜底分支。
- `src/backend/services/search/thread-search-provider.ts`：`getThread` 调用改为新签名 `(threadId, viewerUserId)`，并在处理 `focus_turn_id` 时改走 `getDiscussionForest`。
- `src/backend/services/forum-watch-telemetry-service.ts` + `src/backend/validation/schemas.ts`：`FORUM_WATCH_TELEMETRY_EVENT_TYPES` / `forumWatchTelemetrySchema.event_type.enum` 删 `'timeline_open'`。
- `docs/context/api/openapi.yaml`：删除 `getForumThreadSummaries / getForumThreadDetail` operations + `PublicStageThreadSummary(List) / PublicStageThreadDetail` schemas；`ForumWatchTelemetryRequest.event_type.enum` 删 `timeline_open`；`discovered_via` enum 删 `timeline`。`ctl-openapi-quality.mjs verify` 与 `ctl-api-index.mjs generate` 重新跑通。

### Phase 6 — 测试与治理同步
- `src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`：移除 `useThreadSummaries / threadListMock / ?stage=timeline / timeline_open / useCreatePublicThread` 相关用例，新增 Sort 切换 / `hideDiscussionArea=true` 无 DOM / `turnReplyEnabled` chip 状态 / `reply_anchor_select` 在 `onReplyOpen` 发射等用例。
- `src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx`：新增 `InlineNodeReplyComposer` 显示/隐藏 / `active_route.cta` 替换 Reply / `sortMode='latest_activity'` 重排 / `turnReplyEnabled=false` 全部隐藏 Reply。
- `src/backend/routes/__tests__/e2e-read-api.test.ts`：删 `threads-summary / /v1/threads/:threadId / timeline_open` 用例。
- `src/backend/services/__tests__/forum-read-service.test.ts`：删 `getThreadSummaries` 测试；`getThreads` 与 `getThread` 测试保留并更新签名。
- `tests/web/playwright/forum-orchestration.e2e.spec.ts`：删时间线 Tab 断言，替换为 forest 默认 + sort 切换 + telemetry 不含 `timeline_open`。
- `ctl-project-governance.mjs sync --apply` + `ctl-openapi-quality.mjs verify` + `ctl-api-index.mjs generate --touch`。

## Iteration 2 — Reddit 化二轮（aftershow / reading-guide UI / 卡片瘦身）

### Phase 1 — `PostDetailPage.tsx` 卸掉 aftershow 渲染
- 删除 `aftershow-panel` 卡片（summary / highlights / `RelationTeaserCard`）、`summaryTitle / summaryText / summaryTimestamp / audienceHighlights / toAftershowContentV1 / AftershowContentV1 / RailHighlightItem / guideRenderRef` 等辅助。
- `useAftershow` 保留：callout → `audience_message_id` 深链仍要用。
- `recordWatchTelemetry` 的 event_type 收窄为 `branch_expand | node_focus | reply_anchor_select`。

### Phase 2 — `DiscussionForest.tsx` Reddit 化重写
- 彻底移除 `DiscussionClusterView`、`buildClusterViews`、`先看这些公开支线 / 公共观看摘要 / 支线簇 / 沿着这个点继续 / 稍后接回` 等 "导演意图" 元素。
- 改为 `buildTreeViews` 生成 `DiscussionTreeView[]`，每棵"树"以 top-level lead（root 下的 turn 或孤立 turn）为根，子回复用 `border-l-2 pl-3` 左 rail 缩进。
- 节点头：`author · relative time`（单行 meta），可选 identity chip。
- 节点体：引用预览（带左 rail）+ `RichTextLite` 正文 + 操作行（"回复" / CTA / 定位）。
- `[-] / [+]` 折叠：按钮 `data-testid="node-collapse-toggle"` 放在节点左侧，`collapsedNodeIds` Set 记录；折叠后显示 "已折叠 {count} 条回应"（`collectSubtreeSize` 统计）。
- 深度过滤：按用户决定本轮不实现（两层深度内，必要性不强）。
- 样式 token：`text-muted-foreground / text-foreground / bg-primary/[0.04]`，不引入新颜色。

### Phase 3 — `StageToolbar.tsx` 轻量化
- 删除 `ParticipationChip + Popover + readStageChip/readAudienceChip/chipToneClassName`。
- 保留一段 muted 单行提示 `readParticipationNotice`：双全开时返回 `null`（`\u00a0` 占位），其余三种组合给出简短文案（如"主线程暂不开放回复，可在观众席留言"）。
- Sort 下拉标签改为 "综合 / 最新"；Trigger 用 `h-6 text-[12px] text-muted-foreground`。

### Phase 4 — 前端遥测收敛
- 前端 `recordWatchTelemetry` 不再发射 `guide_render / guide_click`；`branch_expand` 也不再由 UI 触发（DiscussionForest 不再有 "branch cluster 展开" 行为）。
- 后端 `ForumWatchTelemetryEventType` 仍保留 `guide_render / guide_click / branch_expand`（Agent Runtime / 服务端工具可继续记录）。

### Phase 5 — 测试重写
- `PostDetailPage.test.tsx`（22 tests）：删 aftershow panel / RelationTeaserCard / ParticipationChips / guide_render 断言；新增"综合 / 最新" 排序 / `turnReplyEnabled=false` chip 状态 / 深链 audience_message_id 仍工作。
- `DiscussionForest.test.tsx`（4 tests）：`discussion-tree` 根节点数量、无 `公共观看摘要 / 先看这些公开支线 / 支线簇 / 已经转场的分支 / 稍后接回` 文案、`[-]` 折叠后显示 "已折叠 N 条回应"、`turnReplyEnabled=false` 全无 Reply。
- `forum-orchestration.e2e.spec.ts`：去掉 aftershow / reading-guide 文案期望，改为 `StageToolbar + discussion-forest-tree` 断言；telemetry 不含 `guide_render / guide_click / timeline_open`。

## Iteration 4 — 排序语义 / 深链滚动 / StageToolbar 布局收敛

### Phase 1 — StageToolbar 视觉 & 文案对齐
- 布局改为「整行一条 `h-px bg-border/60` 横线位于垂直中心 + 文字两端以 `bg-background` 遮住一小段」，实现"文字压在同一条线上"（方案 B）。
- 左端：`排序 综合 ▾`（`DropdownMenu`，`align="start"`）。
- 右端：参与合约提示，统一始终显示两段：`{主线程段} | {观众席段}`。
  - 主线程段：`turn_reply_enabled === true` → `无限制`，否则 `仅智能体`。
  - 观众席段：`enabled && posting_enabled` → `可讨论`，否则 `不可讨论`。
  - 原本"双全开时完全隐藏"的分支移除；四种组合都显示，信息对称。
- 右端加 `Tooltip`（组件内自带 `TooltipProvider(delayDuration=150)`，不依赖全局 Provider，独立可测）：`cursor-help` + `tabIndex=0`，鼠标 hover 或键盘 focus 展开说明：
  - 主线程：`智能体与人类均可公开回复` / `仅智能体参与，不接受人类公开回复`
  - 观众席：`可发表公共留言` / `当前不开放公共留言`
- 颜色 / 尺寸 token：`bg-border/60`、`bg-background`、`text-muted-foreground`、`text-foreground`、`text-[12px]`、`h-6`、`min-w-[7rem]`，全部符合 UI gate。

### Phase 2 — DiscussionForest 排序语义重写（解耦交互态）
- `sortedTrees` memo 剥离 `selectedNodeId` 和 `forest.focus_thread_id` 两个耦合键，改为纯"时间属性"排序：
  - `sortMode === 'recommended'` → 按 `tree.root.created_at` **升序**（叙事顺序，保留支线因果链）。
  - `sortMode === 'latest_activity'` → 按 `latest_activity_at` **降序**（追更视图）。
- 结果：点"回复" / 点选中节点 / 改 `selectedNodeId` 都**不会**再触发 tree 顺序变化，只影响节点高亮。
- `DiscussionForestProps` 删除 `onSelectNode` prop（唯一调用点是"回复"按钮的重复 emit，已合并为单次 `reply_anchor_select`）。
- `DiscussionTreeView.node_ids: Set<string>` 字段删除（只服务于被拆掉的 `selectedNodeId` 排序 key），`buildTreeViews` 内相关收集代码同步清理。

### Phase 3 — PostDetailPage 深链滚动 & 遥测收窄
- 新增 `lastScrolledDeepLinkRef: useRef<string | null>`，只有当 URL 显式含 `?turnId=` 或 `?threadId=` 时才调用 `document.querySelector('[data-node-id=...]').scrollIntoView({ behavior: 'smooth', block: 'start' })`，同一深链只滚一次（forest 重取 / 重渲染不会重复滚）。
- 删除 "当 `selectedForestNodeId` 为空且 forest 加载完成时，回填 `forest.nodes[0].id`" 的 `useEffect`：原本只是为旧排序逻辑服务，当前顺序纯由 created_at / latest_activity_at 决定，无需该兜底。
- `DiscussionForest` 的 `onSelectNode` 调用点删除；`onReplyOpen` 保留，只发 `reply_anchor_select` 一条 telemetry（合并掉原本的 `node_focus` + `reply_anchor_select` 双发）。
- `recordWatchTelemetry` 的 `event_type` 类型从 `'branch_expand' | 'node_focus' | 'reply_anchor_select'` 收窄到 `'reply_anchor_select'`：这是本页当前真正会发的唯一事件；`branch_expand` / `node_focus` 在 backend `ForumWatchTelemetryEventType` 枚举仍保留，供 Agent runtime / 后端记录使用，前端不再触发。

### Phase 4 — 验收与回归
- `pnpm vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx` → 26/26 pass。
- `pnpm exec eslint src/frontend/features/forum/pages/PostDetailPage.tsx src/frontend/features/forum/components/DiscussionForest.tsx src/frontend/features/forum/components/StageToolbar.tsx` → 0 errors / 0 warnings。
- 现有测试无 `node_focus` 正向断言；`'does not emit deprecated guide/timeline telemetry events'` 用例仍覆盖负向断言。

### 决策边界（已与 PM 对齐）
- **"综合 = 叙事顺序 / 最新 = 追更顺序"** 是排序默认选项的产品心智；不再把"最新活动"塞进"综合"作为启发式。
- **深链只滚不浮顶**：即便 `?turnId=X` 指向第 12 个 tree，也不破坏时间线顺序，信任浏览器滚动条 + 用户意图。不加任何"上方还有 N 条更早讨论"的提示横幅。
- **子树内部排序保持 `display_depth → sibling_order → created_at` 升序**：树内是严格的回复顺序，两个 sort 选项只影响顶层 tree 列表。

## Iteration 3 — 深度清理

### 清理动作
- `src/frontend/api/hooks/forum.ts`：删除 `useCreatePublicThread`（违反"人类 UI 不得创建分支"契约，已无消费者）与 `useReadingGuide`（Reading-guide UI 下线后唯一消费者，类型 `ReadingGuideProjection` 在 DiscussionForestProjection 内仍可间接使用，但此 frontend query hook 已无意义）。
- `src/frontend/api/query-keys.ts`：移除 `readingGuide` 查询键（已无查询）。
- `src/frontend/api/hooks/forum.ts`：`useCreatePublicTurn.onSuccess` 不再 invalidate 已被移除的 `readingGuide` 查询键，避免死 key。
- `src/frontend/api/types.ts`：移除对 `ReadingGuideProjection` 的 barrel re-export（`@shared/forum-orchestration` 仍导出原始类型给 Agent / 服务端；前端 barrel 层没必要保留）。

### 治理与文档
- `ctl-project-governance.mjs sync --apply` → `registry.yaml` + `dashboard.md` + `feature-map.md` + `task-index.md` 随 `updated: 2026-04-19` 更新。
- `ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict` 通过；`ctl-api-index.mjs generate --touch` 刷新。
- 04-verification / 05-pitfalls 同步更新。

### 发现但不属于本任务
- `src/frontend/features/agents/components/modal/TabMoments.tsx` 及其新建测试文件是 Agent modal 的独立改动，来自另一个进行中任务；本任务**不触碰**。
- `src/frontend/features/agents/components/AgentMediaPanel.tsx` / `PrivacySettingsPanel.tsx` 的硬编码色值（UI gate 38 errors）是仓库历史问题，不在本次范围。

## Iteration 5 — 观众席 Reddit 化 + 社交能力

### Phase 1 — DB schema + repository
- `prisma/schema.prisma`：`AudienceMessage` 扩 `parent_message_id / quoted_turn_id / quoted_turn_excerpt / quoted_turn_author_name / deleted_at / like_count`（`like_count` 为冗余字段，避免每次聚合；真 SSOT 仍是 `audience_message_likes` 行数）。新增 `AudienceMessageLike(message_id, user_id, created_at)` 唯一键 `(message_id, user_id)`。
- `src/backend/repos/types/audience.ts`：加 `AudienceMessageAuthor / AudienceMessageAggregate / AudienceMessageLike` 类型与 `CreateAudienceMessageInput.{parent_message_id, quoted_turn_*}` / `ToggleAudienceMessageLikeInput`。
- `src/backend/repos/audience-repository.ts`：接口补 `listMessagesWithAggregates / softDeleteMessage / likeMessage / unlikeMessage / countLikes / listLikedMessageIdsByViewer`；`InMemoryAudienceRepository` 实装新字段 + 单侧 `like_count` 维护。
- `src/backend/repos/pg/pg-audience-repository.ts`：查询路径 join `human_users` 返回 `author { id, display_name, avatar_url }`；写路径在事务内调 `AudienceMessageLike.upsert + update like_count`。

### Phase 2 — service & routing
- `src/backend/services/audience-service.ts`：`AudienceService.{getThreadByPost, createAcceptedMessage, softDeleteMessage, toggleLike}` 全量覆盖；`sortAggregated()` 对扁平列表做"按 top 排序 + 各 top 后续紧跟其子回复（asc）"的展开，避免路由层再 pipeline 一次。`AudienceAuthorLookup` 接口可选接入 `UserRepository`，`container/services.ts` 组装 `resolve(ids)` lambda 以复用 `repos.userRepo.findById`。
- `src/backend/services/viewer-public-write-service.ts`：`createAudienceMessage / deleteAudienceMessage / toggleAudienceMessageLike` 通过 `publicWriteGovernanceService.handleWrite(...)` 吞吐；`onAcceptedAudienceWrite` hook 把成功写入单独分发给观众席 subscriber（与 forum event 分流）。
- `src/backend/routes/viewer-write-api.ts`：新增 `DELETE /viewer/audience-messages/:messageId`、`POST|DELETE /viewer/audience-messages/:messageId/likes`；`POST /viewer/posts/:postId/audience-messages` 支持 `parent_message_id / quoted_turn`。
- `src/backend/routes/read/read-policy-routes.ts`：`GET /posts/:postId/audience-thread?sort=latest|top` → 调 `AudienceService.getThreadByPost`，再用 `serializeAudienceThread` 输出嵌套 `messages[].replies[]` + `author / like_count / viewer_has_liked`。

### Phase 3 — OpenAPI + API index
- `docs/context/api/openapi.yaml` 加 `AudienceThreadSort / AudienceMessage / AudienceMessageWithReplies / AudienceQuotedTurnRef / AudienceMessageLikeResult / AudienceMessageDeleteResult / CreateAudienceMessageInput` schema；`/v1/posts/:postId/audience-thread` 的 `query.sort` 新增枚举；新增 like/unlike 与 delete 三个 operation。
- `ctl-openapi-quality.mjs verify` / `ctl-api-index.mjs generate --touch` 回跑通过。

### Phase 4 — Frontend 抽出 `AudiencePanel.tsx`
- `src/frontend/features/forum/components/AudiencePanel.tsx`：独立组件，只依赖 `useAudienceThread / useCreateAudienceMessage / useDeleteAudienceMessage / useToggleAudienceMessageLike / useCreateReport`。
- 结构：排序 dropdown（`最新 / 热门`）→ `h-px bg-border/50` 细线 → lazy composer（未展开时单行占位，展开后 `Textarea` + 发送按钮，错误态就地渲染）→ 消息列表（`overflow-y-auto`）。
- 每条消息：`AudienceMessageHeader`（头像 + 名 + 相对时间）+ 可选 `AudienceQuoteChip`（`↳ 作者「片段」`，点击 `onNavigateToTurn(turnId)`）+ 正文（`RichTextLite` 或 deleted placeholder）+ `AudienceActionRow`（心 + 回复 + `...` 菜单）+ 可选 replies `<ul>`（`border-l-2 border-border/50 pl-3`，仅一层）。
- 深链：`focusedMessageId` 触发一次 `scrollIntoView({ behavior: 'smooth', block: 'center' })`，`lastScrolledRef` 去重。
- composer prefill：`composePrefill` 变化时打开 composer 并把 `quoted_turn` 字段透传给 `createMessage.mutateAsync`；发送成功或取消时调 `onConsumePrefill`（页面层顺手清 URL 参数）。

### Phase 5 — `DiscussionForest` 的观众席入口
- 新增 `audiencePostingEnabled` + `onDiscussInAudience(node)` 两个 props；当 `audiencePostingEnabled` 为 true 时在节点 `AudienceActionRow`（forest 节点级）渲染"观众席讨论"按钮。
- 回调只给出 `{ turn_id, excerpt: node.body.slice(0, 120), author_display_name }`；URL 状态由 `PostDetailPage.handleDiscussInAudience` 写入 `audience_compose_for / audience_compose_excerpt / audience_compose_author`。

### Phase 6 — `PostDetailPage` 清场 + 接线
- 彻底移除 `useAftershow / useAsideSeats / aftershowContent / railPlaceholder / audienceDraft*` 等残留；只保留 `usePost / useDiscussionForest / usePostParticipationContract / useSseNewCounts / useRecordForumWatchTelemetry` + `AudiencePanel`。
- `audienceRailEnabled = audienceZoneEnabled && participationContractData?.data?.audience_lane?.enabled`；`canUseAudienceComposer = audienceRailEnabled && participationContract.audience_lane.posting_enabled`。
- 移动端 Tab 改为 `主线程 / 观众席`；默认 Tab 仅当 URL 含 `audience_message_id` 或 `audience_compose_for` 时才切到观众席。
- `handleNavigateToTurn(turnId)` 把 URL 的 `turnId` 设为目标节点（已存在的深链滚动路径会接手）。

### Phase 7 — 容器注入 `AudienceAuthorLookup`
- `src/backend/container/services.ts`：如果 `repos.userRepo` 存在，就注入一个 `resolve(ids) => Map<id, { id, display_name, avatar_url }>` 的 lambda；缺失时直接退化为"无后置注入"，`PgAudienceRepository` 的 join 结果即最终展示值。

### Phase 8 — 测试覆盖
- `src/frontend/features/forum/components/__tests__/AudiencePanel.test.tsx`（11 tests）：empty / 渲染单条 / composer 展开 + 带 quote 提交 / 点赞 mutateAsync / 自己的消息能删 / 他人的消息展 report / one-level reply 渲染 / quoted chip 导航 / deleted placeholder / 禁用态 placeholder / 排序切换到 top 并重调 hook。
- `src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx`：追加"exposes the audience-discussion entry only when audience posting is enabled"，覆盖 `onDiscussInAudience` 回调。
- `src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`：stub `AudiencePanel`，保留"rail 渲染 / disabled 时隐藏 / `audience_message_id` 深链打开观众 tab / `audience_compose_for` 深链打开观众 tab 并带 excerpt"四类用例；其余过期用例全部删除。
- `src/backend/services/__tests__/audience-service.test.ts`（9 tests）：top-level 创建 → 投影 / one-level reply accepted / nested reply rejected / 对 deleted 回复 rejected / quoted_turn 存储 / body + quoted_turn 校验 / softDelete ACL / toggleLike 幂等 / top 排序 + viewer_has_liked / NotFoundError post。
- `src/backend/services/__tests__/viewer-public-write-service.test.ts`：保留现有 3 用例；新增 `createAudienceMessage` 路径的 onAccepted hook 分发断言。
- `src/backend/routes/__tests__/e2e-read-api.test.ts`：`audience` 三用例对齐新 schema（`author.id` 替代 `author_user_id`、空线程响应带 `sort: 'latest'`）。


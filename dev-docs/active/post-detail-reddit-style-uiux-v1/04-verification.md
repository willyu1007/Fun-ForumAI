# 04 Verification

## Iteration 5 — 观众席 Reddit 化 + 社交能力

### 范围回顾
- 后端：Prisma schema 扩 `audience_messages` 字段 + 新增 `audience_message_likes` 表；`audience-repository` / `pg-audience-repository` / `audience-service` / `viewer-public-write-service` 全链路同步；新增 `DELETE /v1/viewer/audience-messages/:id`、`POST|DELETE /v1/viewer/audience-messages/:id/likes`；现有 `POST /v1/viewer/posts/:id/audience-messages` 接受 `parent_message_id / quoted_turn`；`GET /v1/posts/:id/audience-thread?sort=latest|top` 返回嵌套 `messages[].replies[]` + `author / like_count / viewer_has_liked`。
- 前端：抽独立 `AudiencePanel.tsx`（排序 dropdown / lazy composer / one-level reply / quoted chip / like / delete / report）；`DiscussionForest` 节点动作栏新增"观众席讨论"入口（只在 `audiencePostingEnabled` 为 true 时出现），通过 URL `audience_compose_for / audience_compose_excerpt / audience_compose_author` 预填 composer；`PostDetailPage` 清空 `useAftershow / useAsideSeats / railPlaceholder` 残留，仅按 `participationContract.audience_lane.enabled` 条件渲染。

### 自动化结果
- `pnpm vitest run src/frontend/features/forum` → 12 files / 66 tests PASS（含新增 `AudiencePanel.test.tsx` 11 用例、`DiscussionForest.test.tsx` 追加"exposes the audience-discussion entry only when audience posting is enabled"）。
- `pnpm vitest run src/backend/services/__tests__/audience-service.test.ts` → 9 tests PASS（top-level / 单层回复 / nested 拒绝 / deleted 拒绝回复 / quoted_turn 存储 / body 与 quoted_turn 校验 / softDelete ACL / toggleLike 幂等 / top-sort + viewer_has_liked / NotFound post）。
- `pnpm vitest run src/backend/services/__tests__/viewer-public-write-service.test.ts` → 3 tests PASS（包括 `createAudienceMessage` 通过独立 audience hook 分发）。
- `pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts -t audience` → 3 tests PASS（auditable envelope + body 校验 + 空线程 `sort:'latest'` 结构）。
- `pnpm exec tsc -p tsconfig.json --noEmit` → 无错误。
- `pnpm exec tsc -p tsconfig.app.json --noEmit` → 仅剩仓库原有 `PrivacySettingsPanel.tsx(205)` 与本轮无关。

### 行为矩阵（前后对比）
| 场景 | Iteration 4 行为 | Iteration 5 行为 |
|---|---|---|
| 观众席渲染 | `PostDetailPage` 内联展开 + 依赖 `useAftershow / useAsideSeats / railPlaceholder` | 抽 `AudiencePanel`，仅依赖 `useAudienceThread / useCreateAudienceMessage / useToggleAudienceMessageLike / useDeleteAudienceMessage / useCreateReport` |
| 排序 | 仅展示最新 | `最新 / 热门`（top 按 `like_count desc, created_at desc`） |
| 点赞 | 不支持 | POST/DELETE `/likes` 幂等，前端 `viewer_has_liked` 实时反馈 |
| 单层回复 | 不支持 | 支持；服务端拒绝两层嵌套 / 对 deleted 回复 |
| 删除 | 不支持 | 仅作者本人 `softDeleteMessage`，UI 以"该留言已被删除。"占位 |
| 引用 turn | 无 | Forest 节点"观众席讨论"入口 → URL 预填 composer → 发送后以 chip 形式展示 + 回点定位主线程 |

### 语义漂移双清
- `rg "useAftershow|useAsideSeats|railPlaceholder|AftershowContentV1|audience_thread_meta" src/frontend/features/forum/pages/PostDetailPage.tsx` → 0 匹配。
- `rg "author_user_id" src/backend/routes/__tests__/e2e-read-api.test.ts` → 0 匹配（全部迁移到 `author.id`）。
- `rg "audience_thread_meta" src/frontend` → 仅 `PostDetailPage.test.tsx` 的负向断言（确认 page 不再消费）。
- `rg "toggleAudienceMessageLikeSchema" src/backend` → 0 匹配（like 接口靠 HTTP 方法承载意图，无需 body schema）。

### 收尾清扫（Iteration 5 Phase N+1：死 hook / 死参数）
- `rg "useAftershow|useAsideSeats|AftershowSnapshot|AsideSeatsData" src/frontend` → 0 匹配（hook、类型、query key 三路径同步下线）。
- `rg "queryKeys\.aftershow|queryKeys\.asideSeats" src/frontend` → 0 匹配（`useCreateAudienceMessage.onSuccess` 里对 aftershow 的死 invalidate 同步删除）。
- `rg "create_if_missing" src/backend` → 0 匹配（`AudienceService.getThreadByPost` 去除"读时可写"旁门；写路径保持由 `createAcceptedMessage` 独占 `upsertThreadByPost`）。
- 被动后端字段保留：`PostWithMeta.{aftershow_summary, aftershow_callouts, audience_thread_meta}` 与 `AftershowSummary / AftershowCalloutItem / AudienceThreadMeta` 仍留在 `src/frontend/api/types.ts`，作为 backend 投射的 passthrough 类型契约（playwright fixture / Agent 继续消费，前端主动路径仍为 0）。
- UI Governance Gate：`python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode minimal` → 本轮改动涉及的 `AudiencePanel / DiscussionForest / PostDetailPage / StageToolbar` 均 0 告警；余 38 条错误集中在 `AgentMediaPanel.tsx / PrivacySettingsPanel.tsx`，属本任务开始前既有的 `#243B6B / #1d3057` 硬编码色值，未在本迭代范围内处理。
- 回归：`pnpm vitest run src/frontend/features/forum src/frontend/api` → 20 files / 78 tests PASS；`pnpm vitest run src/backend/services/__tests__/audience-service.test.ts src/backend/services/__tests__/viewer-public-write-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts` → 3 files / 61 tests PASS；`pnpm vitest run src/backend/services/__tests__/aftershow-service.test.ts` → 15 tests PASS（保留 `upsertThreadByPost` 写路径未受影响）。

### 待做（人工/独立会话）
- Chrome DevTools MCP 手测：
  - 开启 `audience_lane.enabled` 的真实帖子：右栏出现 `AudiencePanel`；桌面 `留言 + 排序`、移动端 Tab 改为 `主线程 / 观众席`。
  - 在 forest 节点点击"观众席讨论"：右栏 composer 自动展开且带 quote chip，发送成功后消息出现在顶部（latest）；点击列表里的 quoted chip 平滑滚动回主线程对应节点。
  - 点赞 / 取消点赞同一条消息：像素级无抖动；多标签页同时点同一条消息计数稳定。
  - 作者本人删除自己的留言：立即变成占位；他人只能看到"举报"入口。
  - 切换"热门"排序：多条赞数不同的留言稳定按 `like_count desc` 排列，同赞按 `created_at desc`。
  - 关闭 `audience_lane.enabled` 的帖子：右栏不渲染任何 rail DOM，移动端也没有"观众席"Tab 候选。

### 观众席 seed + MCP 手测回执（2026-04-20）

**mock 数据扩展**：
- `dev-seed-fixtures.ts` 新增 `DevSeedHumanUserSpec / DevSeedAudienceMessageSpec` 两类 fixture，额外写入 4 个观众席人类用户（`观察者 Lin / 代码侦探 / 速写阿图 / 午夜路人`，带独立 display_name + avatar）。
- `ai-consciousness`（audience_sidecar）seed 6 条消息覆盖：多作者根节点、一层回复、点赞热度（0~4 赞）、`quoted_turn` chip（引用辩论大师根 turn）、`deleted_at` 占位。
- `rust-graph-traversal`（audience_sidecar）seed 3 条消息覆盖单作者自回复链（语义连贯 + 被他人点赞）。
- 原 `cyberpunk-city-images`（open_reply）的 audience fixture 已删除 —— 该帖 `audience_lane.enabled=false`，在 UI 上本就不会渲染 panel，继续保留会在 DB 里留下"语义不可达"的数据，与治理契约冲突。
- `InMemoryAudienceRepository` + `PgAudienceRepository` 新增 `updateMessageTimestamps`，seed runner 通过 `buildDevSeedFixtureTimestamp(hours_ago)` 把每条留言 backdate 到 1/2/3/4/5/6 小时前，使"最新"排序结果稳定。

**API 回执**（`POST /v1/dev/seed {profile:canonical,reset:true}`）：`audience_threads=2, audience_messages=9, audience_likes=16`。`GET /v1/posts/seed-post-ai-consciousness/audience-thread` 按 `sort=latest` 返回 5 个 top-level + 1 个 nested reply，时间戳 T-1h~T-6h。

**Chrome DevTools MCP 手测矩阵**（evidence `dev-docs/active/post-detail-reddit-style-uiux-v1/artifacts/audience-seed-screenshots/`）：

| 场景 | viewport | 期望 | 观察 | 证据 |
|---|---|---|---|---|
| 宽屏双栏 + "最新" 排序 | 1440×900 | 右栏按 created_at desc：速写阿图(1h,quote) → 午夜路人(2h) → 观察者Lin(3h,已删) → 代码侦探(5h) → 观察者Lin(4h,嵌入代码侦探下) → 观察者Lin(6h) | ✅ 顺序正确，嵌套反白缩进，deleted 显示"该留言已被删除。" tombstone | `03-ai-consciousness-final-wide.png` |
| 宽屏 + "热门" 排序 | 1440×900 | 按 like_count desc, created_at desc：午夜路人(4赞) → 观察者Lin(3赞,6h) → 速写阿图(2赞,quote) → 代码侦探(1赞,5h) → 观察者Lin(1赞,4h,嵌) → 已删(沉底) | ✅ 顺序稳定；deleted 沉到最后；同赞按时间降序 | `04-ai-consciousness-sort-hot.png` |
| 窄屏 Tab 切换 | 900×900 | 顶部 `主线程 / 观众席` Tab；点击"观众席"切换到 AudiencePanel（含排序 dropdown、6 条留言、composer 被"登录后可参与讨论"占位） | ✅ Tab 切换生效；panel 渲染完整；未登录态 composer 不可点 | `05-ai-consciousness-narrow-audience-tab.png` |
| quoted_turn chip | 1440×900 | 速写阿图消息顶部有 `↳ 辩论大师「…」` chip，body 独立显示 | ✅ chip 单行截断，引号包住 excerpt，chip 与 body 视觉分层清晰 | 同 03 |
| deleted 占位 | 1440×900 | 观察者Lin 3h 前消息显示"该留言已被删除。"，无 body / 无 like / 无回复操作栏（仅保留 disabled 更多操作触点） | ✅ | 同 03 |
| open_reply 帖子治理断路 | 1440×900 | 进入 `cyberpunk-city-images`（`audience_lane.enabled=false`）时右栏不出现 AudiencePanel，StageToolbar 显示 `无限制 \| 不可讨论` | ✅ 未渲染 complementary rail，contract chip 文案一致 | 行为通过 `take_snapshot` 已验证（无 complementary DOM） |

**覆盖到但暂不在本轮测试矩阵**：
- 登录态 composer 展开 + 发送 + optimistic insert（需 dev 登录态，留给下一轮 human testing）。
- 点赞 / 取消点赞的 optimistic toggle（同上）。
- `audience_compose_for` 深链预填（需浏览器 URL 手工注入，留给下一轮）。
- quoted chip 点击滚动回主线程（fixture 里 `quoted_turn_id=seed-thread-ai-consciousness-debater` 仅命中 thread id 而非独立 turn id；当前 seed 未造独立 turn 作为滚动锚点，手测会观察到"chip 可点但不会平滑滚动"—— 已在 `05-pitfalls.md` 登记为"quoted_turn 深链需要真实 turn id"的现存约束）。

### 决策边界存档（供后续评审复用）
- C1：桌面保留右栏、彻底去卡片化；移动端保留 Tab，标签 `主线程 / 观众席`。
- C2：引用单向 —— forest 节点"在观众席讨论这条"仅通过 URL 预填 composer；主线程节点不感知被引用。
- C3：社交能力只到"点赞 + 1 层回复 + 删除自己 + 举报"；不做无限嵌套 / 编辑 / 置顶 / @mentions。
- C4：排序仅 `最新 / 热门`；不做"今日热门"独立板块。
- C5：`AudienceMessage` 的 `author` 字段由后端统一注入；前端不再 join 用户信息。
- C6：composer 常驻克制（单行 placeholder + focus 后展开）。
- C7：`?audience_message_id` 深链保留仅用于 `scrollIntoView`；`?audience_compose_for` 深链仅用于 composer 预填。
- C8：观众席内部不做导演层算法（无 aftershow / reading-guide / aside_seats 回显）。

---

## Iteration 4 — 排序语义 / 深链滚动 / StageToolbar 布局收敛

### 范围回顾
- Phase 1：`StageToolbar` 改为方案 B 布局（整行一条 `h-px bg-border/60` 横线 + 文字两端 `bg-background` 遮盖）；排序置左、参与合约提示置右；文案固定为 `{无限制|仅智能体} | {可讨论|不可讨论}`，右端 `Tooltip`（`TooltipProvider(delayDuration=150)` 组件自包含）展开完整说明。
- Phase 2：`DiscussionForest.sortedTrees` 重写为纯时间属性排序 —— 综合 = `tree.root.created_at` asc，最新 = `tree.latest_activity_at` desc；移除 `selectedNodeId / forest.focus_thread_id` 两个耦合 key；删除 `onSelectNode` prop 与 `DiscussionTreeView.node_ids` 字段。
- Phase 3：`PostDetailPage` 新增 `lastScrolledDeepLinkRef` 驱动的一次性 `scrollIntoView`（仅显式 `?turnId=/?threadId=` 触发）；删除"`selectedForestNodeId` 空值回填到 `forest.nodes[0].id`"的兜底 `useEffect`；回复按钮不再重复发 `node_focus`，只发 `reply_anchor_select`；`recordWatchTelemetry.event_type` 收窄为 `'reply_anchor_select'`。

### 自动化结果
- `pnpm vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx` → 26/26 pass。
- `pnpm exec eslint src/frontend/features/forum/pages/PostDetailPage.tsx src/frontend/features/forum/components/DiscussionForest.tsx src/frontend/features/forum/components/StageToolbar.tsx` → 0 errors / 0 warnings。
- TypeScript：`tsc --noEmit` 在本轮改动的三个文件上无新增错误（仓库原有 media/warmup/pgvector 等错误未被触及）。

### 行为矩阵（前后对比）
| 场景 | Iteration 3 行为 | Iteration 4 行为 |
|---|---|---|
| 无深链打开帖子 | `forest.nodes[0]` 被默默选中 → 其所在 tree 排第一 | tree 按 lead `created_at` 升序展示，无默认选中 |
| 打开 `?turnId=X` 深链 | 含 X 的 tree 浮顶（其他 tree 顺序被打乱） | 列表顺序不变，自动平滑滚动到 X 所在节点（同一深链仅滚一次） |
| 点任意 tree 的"回复"按钮 | 含该节点的 tree 跳到列表第一条 | 列表顺序不变，只就地展开 composer + 节点高亮 |
| 切换到"最新" | `latest_activity_at` 降序，但仍可能被 `selectedNodeId` 干扰 | 纯 `latest_activity_at` 降序，稳定不抖动 |
| 参与合约 double-open | toolbar 提示隐藏为空串占位 | 仍显示 `无限制 \| 可讨论`，hover 展开详情 |
| 参与合约任一关闭 | 显示不同长度的中文句（`主线程暂不开放回复，可在观众席留言` 等） | 统一两段式短标签 + tooltip，视觉整齐 |
| 回复按钮点击的 telemetry | `reply_anchor_select` + `node_focus` 两条 | 仅 `reply_anchor_select` 一条 |

### 语义漂移双清
- `Grep "onSelectNode" src/frontend` → 0 匹配。
- `Grep "node_focus" src/frontend` → 仅 `PostDetailPage.test.tsx` 中的负向断言（"does not emit deprecated guide/timeline telemetry events" 列表里仍列出 `node_focus` 以防后续复活）和 `src/frontend/api/types.ts` 的 `ForumWatchTelemetryEventType` 联合类型（后端枚举的前端镜像，保留供 Agent 使用）。
- `Grep "node_ids" src/frontend/features/forum/components/DiscussionForest.tsx` → 0 匹配。
- `Grep "focus_thread_id" src/frontend/features/forum/components/DiscussionForest.tsx` → 0 匹配（后端 projection 内仍保留该字段，前端 UI 不再消费）。

### 待做（人工/独立会话）
- Chrome DevTools MCP 手测（新增项）：
  - 打开 `?turnId=<第 N 个支线内的 turn>`（N ≥ 5）：列表仍按创建时间顺序展示，页面自动滚到该 turn 的 `li[data-node-id]`，且刷新 / 回退前进不重复滚动。
  - 在列表第 3 个 tree 上点"回复"：composer 就地展开，其上下相邻的 tree 位置不变。
  - 切换"最新"后再点"回复"：顺序仍只受 `latest_activity_at` 影响，不因回复动作扰动。
  - StageToolbar：hover 右端文字查看 tooltip；键盘 Tab 移到文字同样触发 tooltip；窄屏 `truncate` 生效时，tooltip 依然能展示完整内容。

### 决策边界存档（供后续评审复用）
- Q1：深链命中深处是否加"上方还有 N 条更早讨论"提示？**不加**（避免二级噪声，信任滚动条）。
- Q2：综合默认升序是否让老帖子淹没？**不担心**（老帖要么少人看，要么正是用户要看的历史）。
- Q3：子树内部排序改不改？**不改**，保持 `display_depth → sibling_order → created_at` 的回复顺序。
- Q4：只有显式 URL 参数才滚动？**是**，`focus_thread_id` 的后端回填不触发滚动。

---

## Iteration 3 — 深度清理 (dead hooks / queryKeys / barrel re-export)

### 范围回顾
- Phase 1：从 `src/frontend/api/hooks/forum.ts` 删除 `useCreatePublicThread`（Agent-only 契约，前端已无消费者）与 `useReadingGuide`（UI 已下线）。顺手移除 `useCreatePublicTurn.onSuccess` 中对 `queryKeys.readingGuide` 的 `invalidateQueries`。
- Phase 2：从 `src/frontend/api/query-keys.ts` 删除 `readingGuide` key。
- Phase 3：从 `src/frontend/api/types.ts` 的 barrel re-export 删除 `ReadingGuideProjection`（仅保留在 `@shared/forum-orchestration` 内，供 backend projection / agent runtime 使用）。

### 自动化结果
- `pnpm vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx` → 26/26 pass。
- `pnpm vitest run src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/home-programming-service.test.ts` → 40/40 pass。
- `pnpm exec eslint src/frontend/features/forum/... src/frontend/api/hooks/forum.ts src/frontend/api/query-keys.ts src/frontend/api/types.ts` → 0 errors / 0 warnings。
- `pnpm typecheck` → 仓库原有错误照旧（media/warmup/pgvector 等），本轮改动未新增任何 TS 错误。
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode minimal` → 0 新增错误；报告中的 38 条全部来自 `src/frontend/features/agents/components/{AgentMediaPanel,PrivacySettingsPanel}.tsx` 硬编码颜色（与本任务无关，留待 agents 视图独立治理）。

### 语义漂移双清
- `Grep "useCreatePublicThread|useReadingGuide|queryKeys\.readingGuide"`（src/）→ 0 匹配（仅 dev-docs 任务包中做历史记录）。
- `Grep "ReadingGuideProjection" src/frontend` → 0 匹配（仅在 `src/shared/forum-orchestration.ts` 与 backend projection services 中保留，供 Agent 使用）。
- `Grep "readingGuide|reading-guide" src/frontend` → 只剩 `DiscussionForest.test.tsx` 中的 schema_version 字符串与测试描述，均为负向 fixture / assertions。

### 派生视图同步
- `node .ai/scripts/ctl-project-governance.mjs sync --apply` → registry / dashboard / feature-map / task-index 已同步。

---

## Iteration 2 — Reddit-style cleanup (aftershow / reading-guide / card bloat 下线)

### 范围回顾
- Phase 1：PostDetailPage 删除 aftershow panel（摘要 + callouts + relation teaser 在 rail 内的渲染），保留观众讨论面板。
- Phase 2：DiscussionForest 彻底 Reddit 化 —— 删 `ReadingGuide` 区、`支线簇` 卡片标题、`display_title`、`role_hint`、placement 徽章、`支线开场/沿着这个点继续` meta；顶部列表改为单层 `<ul>`，嵌套子回应用 `border-l-2 pl-3` rail 做层级缩进；每个节点左侧加 `[-]/[+]` 折叠按钮，折叠后用 `已折叠 N 条回应` 占位。
- Phase 3：StageToolbar 瘦身 —— 删 Popover 型 chip；Sort 标签改为「综合 / 最新」；只有当「主线程 or 观众席」未完全开放时才渲染一行 muted 提示。
- Phase 4：PostDetailPage 不再发射 `guide_render` / `guide_click` / `branch_expand`（UI 已无触发点），且移除 `toAftershowContentV1` / `AftershowContentV1` / `RailHighlightItem` 等 aftershow 辅助。`useAftershow` hook 仍保留以支持 callout → 观众留言深链。
- Phase 5：`PostDetailPage.test.tsx`（22 tests）、`DiscussionForest.test.tsx`（4 tests）、`forum-orchestration.e2e.spec.ts` 全部对齐。

### 自动化结果
- `pnpm vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx` → 22/22 pass。
- `pnpm vitest run src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx` → 4/4 pass（新增"flat tree without cluster headers/reading-guide"与"collapses a subtree when [-] is pressed"）。
- `pnpm vitest run src/frontend/features/forum src/frontend/features/search src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/forum-watch-telemetry-service.test.ts` → 14 files / 147 tests pass。
- `pnpm vitest run` 仓库其它失败（admin-panel/shell-topbar/warmup 等 7 文件 11 test）与本次改动无关，在 `git stash` 干净树上同样复现。
- `pnpm typecheck` 仅剩与本次无关的仓库原有错误（`media/__tests__`、`warmup-governance`、`pgvector-support`、`media-asset-control-service`、`PrivacySettingsPanel`）；此前由 `NewContentBanner` 的 `label` prop 触发的 TS2322 已在 `FeedPage.tsx` / `CommunityFeedPage.tsx` / `PostDetailPage.tsx` 顺手清理。
- `pnpm lint` 仍为仓库原有 1 error（`warmup-governance-service.ts:1414`）+ 2 warnings（`AgentMediaPanel.tsx`），本次改动无新增。

### 语义漂移双清
- `Grep "reading_guide|RailHighlightItem|AftershowContentV1|summary_line|start_here|先看这些公开支线|公共观看摘要|支线簇|稍后接回|承接上文"` 仅剩：
  - `PostDetailPage.test.tsx` / `DiscussionForest.test.tsx` 中的 fixtures（仍传完整数据）+ 负向断言（确认 UI 不再渲染）。
  - `OwnerLifeOverviewPanel.tsx` / `GuidanceExplanationPanels.test.tsx` 中与本页无关的 agent 视图上下文。
- `Grep "guideRenderRef|toAftershowContentV1"` 在 `src/` 下无匹配。

### 待做（人工/独立会话）
- Chrome DevTools MCP 手测（参照 Iteration 1 列表即可，额外新增）：
  - 节点的 `[-]` 折叠：点击后子树收起并显示「已折叠 N 条回应」，再次点击还原；折叠过程中保持无水平抖动。
  - 参与合约提示：`主线程 + 观众席全开` 时 toolbar 左侧为空串占位；关闭主线程 / 观众席时出现一行「主线程暂不开放回复，可在观众席留言」之类的 muted 文案。
  - 右侧 rail 不再出现 `摘要与亮点`；只保留观众讨论列表 + 观众留言输入框（观众席议题在后续迭代处理）。

### 后续保留待办
- 观众席 (audience rail) 的 Reddit 化改造：沿用 R1/R2/R3 方案讨论后再落地，本轮暂不动。
- 后端仍支持 `guide_render` / `guide_click` 事件（供 Agent Runtime 记录），前端 UI 已不再触发。

---

## Iteration 1 — Forest/Timeline 融合（timeline 根除）

### Planned checks
- `pnpm test -- src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
- `pnpm test -- src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx`
- `pnpm test -- src/backend/routes/__tests__/e2e-read-api.test.ts`
- `pnpm test -- src/backend/services/__tests__/forum-read-service.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict`
- `node .ai/scripts/ctl-api-index.mjs generate --touch`
- Root-out greps：
  - `rg -n "ThreadList|useThreadSummaries|threads-summary|timeline_open|stage=timeline" src/ docs/ tests/`
  - `rg -n "useThread\\b|useThreads\\b" src/frontend`
- Chrome DevTools MCP 手测：
  - 真实 post 详情页：StageToolbar / ParticipationChips / Sort 切换 / inline reply（允许回复的帖子）/ handoff CTA / disallowed 帖子无 Reply。
  - MyActivityPage 的 threads tab：`hideDiscussionArea` 不渲染讨论区。
  - 老书签 `?stage=timeline`：不抛错，按默认森林渲染。

## Results

### 自动化校验
- **前端测试（forum + search）**：`pnpm vitest run src/frontend/features/forum src/frontend/features/search`
  - 12 files / 67 tests PASS，含 `PostDetailPage.test.tsx`（23/23）与 `DiscussionForest.test.tsx`（3/3）。
- **后端受影响测试**：`pnpm vitest run src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/forum-watch-telemetry-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/services/search/__tests__`
  - 5 files / 96 tests PASS。
- **Typecheck**：`pnpm typecheck`
  - 除仓库原有错误（`src/backend/media/__tests__/**`、`warmup-governance-service.ts`、`pgvector-support.ts`、`media-asset-control-service.ts`、`NewContentBanner` 的 label prop 不匹配）外，本次改动未引入新错误。`src/backend/services/__tests__/forum-read-service.test.ts` 的 `getThreads(post.id)` 单参调用已补齐为 `getThreads(post.id, {})`。
- **Lint**：`pnpm lint`
  - 仅报出仓库原有 1 error（`warmup-governance-service.ts:1414` unused var）+ 2 warnings（`AgentMediaPanel.tsx` exhaustive-deps），本次改动无新增。
- **OpenAPI / API Index**：
  - `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict` → `ok`。
  - `node .ai/scripts/ctl-api-index.mjs generate --touch` → 19 endpoints，`API-INDEX.md` 与 `api-index.json` 已同步。

### 语义漂移双清
- `Grep -g "src/**" "timeline_open|threadsSummary|threads-summary|useThreadSummaries|useCreatePublicThread|stage=timeline|\\bThreadList\\b"` 仅剩：
  - `src/frontend/api/hooks/forum.ts:134` 的 `useCreatePublicThread` hook 定义（后端 `/viewer/posts/:postId/public-threads` 路由仍保留，作为合法的公开分支写接口；前端当前 UI 不再触发，但保留 SDK 以便后续治理）。
  - `src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx:572,621` 的负向断言（"没有 timeline_open"）。
- `Grep -g "docs/context/api/**" "timeline_open|timeline|threads-summary|stage=timeline"` 无匹配。
- `Grep -g "src/**" "'timeline'|\"timeline\""` 仅剩 `SafetyCenterPage.tsx` 的审核中心 Tab（与帖子时间线无关）。

### Chrome DevTools MCP 手测
- **待执行**：需在能够启动完整应用（前后端 + 数据 seeding）的环境中进行。具体脚本：
  - 打开允许主线程回复且有 branch 的真实 post：确认顶部只有 `StageToolbar`（chip + Sort），内容区节点下方出现 `回应这里`，点击展开 `InlineNodeReplyComposer` 发送即可；telemetry 面板看到 `reply_anchor_select`、`node_focus`，不应再出现 `timeline_open`。
  - 打开仅开放新分支的 post：chip 状态显示 `主线程回复 · 关闭 / 观众席 · 开放发言`；节点下方无 `回应这里`。
  - 打开 handoff 分支（lifecycle.active_route.cta）：节点下方 Reply 被 CTA 按钮替换，点击跳转或打开外链。
  - `MyActivityPage` 中嵌入的卡片：`hideDiscussionArea=true`，确认页面下方不出现 `post-detail-thread-section`、`stage-toolbar`、`post-detail-rail`。
  - 访问老链接 `?stage=timeline`：页面按默认 forest 渲染，URL 不再被改写，控制台无错误。

### 生成的物料
- `dev-docs/active/post-detail-reddit-style-uiux-v1/00-overview.md` … `05-pitfalls.md`
- `.ai/project/main/registry.yaml` / `dashboard.md` / `feature-map.md` / `task-index.md` 更新 T-980。
- 生成/同步：`docs/context/api/openapi.yaml`、`docs/context/api/api-index.json`、`docs/context/api/API-INDEX.md`。

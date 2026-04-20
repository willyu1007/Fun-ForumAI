# 05 Pitfalls

## Do-not-repeat summary
- 继承自 `forum-post-detail-discussion-forest-v1`：
  - 不要把 forest 重新做成 comment tree 主模型。
  - 不要让 timeline 重新成为默认主视图。（本次已彻底删除 timeline 视图与代码路径。）
  - 不要为了兼容移动端而同时渲染两套完整详情 DOM。
- 本任务（Iteration 1）新增：
  - 不要在 human-UI 路径上引入 `createPublicThread` / "发起公开分支" 入口，该契约只服务 Agent 路径。
  - 不要把帖子正文下的区域做成高优先级 composer（如 "分享你的看法" 占位行）——会把普通阅读心智升级成发帖心智。
  - `hideDiscussionArea=true` 必须 **不渲染任何讨论 DOM**。以前的"伪隐藏"（偷偷 fallback 到 ThreadList）是语义漂移源头。
  - `participationContract.stage_open_reply.new_thread_enabled` 仅用于 Agent 契约；即使为 true 也不得在人类 UI 上暴露任何 "新开分支" 入口。
- 本任务（Iteration 2）新增：
  - 不要用"卡片化 + 多级标题 + 清单"呈现 DiscussionForest 节点；主线程一律走 Reddit 式 `[-] meta + 正文 + 操作行` 的单层 `<ul>` + 嵌套 `<ul>` 结构。
  - 不要再暴露任何"导演意图"向 UI：`reading_guide.summary_line / start_here_thread_ids`、`branch_group.display_title / role_hint`、placement 徽章（`稍后接回 / 沿着这个点继续`）、`aftershow_summary / aftershow_callouts` 都不在主线程 UI 上渲染（Agent / 后端仍可继续生产）。
  - 不要把 `guide_render / guide_click` 从 UI 触发（UI 已无对应入口）；后端枚举保留给 Agent / 服务端使用，前端不得新增 emission。
- 本任务（Iteration 3）新增：
  - 不要保留已经无消费者的前端 hook（例如 `useCreatePublicThread / useReadingGuide`）作为"兜底"；dead hook 会诱导下一个开发者误用，反而是语义漂移源头。
  - 查询键（`queryKeys.readingGuide`）一旦消费者全部下线，就应同步删除；否则后续 `invalidateQueries` 会逐步堆积死 key。
  - Reading-guide 数据仍是 `DiscussionForestProjection.reading_guide` 的一部分（给 Agent 读）；前端 UI 必须视之为"不展示但可携带"。任何新 UI 试图再次消费 `reading_guide.summary_line / highlighted_thread_ids` 前，请先复检本轮 05-pitfalls。
- 本任务（Iteration 5）新增：
  - **不要把导演层数据（aftershow / reading_guide / aside_seats）回显到观众席**。观众席是人类 ↔ 人类讨论空间，即使后端 projection 仍然生产这些字段，前端也不得 render；否则会把"Agent 主导叙事 vs 观众互相讨论"的心智边界再次糊掉。
  - **不要做超过 1 层嵌套回复**。服务端对第二层 reply 直接返回 `ValidationError`；产品上如果真的需要长分支讨论，应该回到主线程（Agent 驱动）而不是在观众席自生长出一棵 comment tree。
  - **不要让观众席信号反向渗透主线程**。forest tree 排序不得受 audience `like_count` 或留言数量影响；节点不显示"有 N 条留言讨论这条"；quoted-turn 是单向链路（audience → forest）。
  - **不要让前端 join 用户信息**。`AudienceMessage.author.display_name / avatar_url` 一律来自后端 `AudienceService.authorLookup`；前端禁止依赖 user context 再二次填充。
  - **不要给 like/unlike 加冗余 body schema**。`liked` 状态由 HTTP 方法承载（`POST /likes` = like，`DELETE /likes` = unlike），再写一遍 `{liked:boolean}` 只会让前端多出错。
- 本任务（Iteration 4）新增：
  - **不要把交互驱动的 UI state 作为排序 key**。`selectedNodeId / activeReplyNodeId / hoverNodeId` 等只反映当前操作位置，一旦进入排序比较函数，点击任意 reply / focus 都会引发 tree 乱序重排，体验上表现为"点回复，线程跳到第一条"。排序只能依赖"内容本身的时间属性"（`created_at / latest_activity_at`）或"URL / 深链快照"。
  - **不要让"综合"和"最新"两个选项在语义上重合**。"综合 = `focus_thread_id` 浮顶 + latest_activity desc" 和 "最新 = latest_activity desc" 90% 等价，等于两个按钮做同一件事 —— 应该让"综合 = 叙事顺序（created_at asc，保留因果链）"、"最新 = 追更顺序（latest_activity desc）"真正互补。
  - **深链定位优先用滚动，不要用浮顶**。把目标 tree 抬到列表第一条虽然"一眼看到"，但会打破其他 tree 的时间线顺序，破坏"支线 B 出现在支线 A 之后"的因果阅读。正确做法：顺序不变，`scrollIntoView` 到目标节点，并用 `useRef` 去重，避免重复滚动 / 动画抖动。
  - **一次用户动作只发一条 telemetry**。点击"回复" = `reply_anchor_select`；不要顺手复用 `node_focus` 做第二次"选中也算聚焦"记录 —— 聚合 dashboard 里会把一次行为计成两个信号，干扰后续决策。
  - **前端 telemetry 类型应该反映真实的 emitter**。`recordWatchTelemetry` 的 `event_type` 联合类型只保留"页面内真的会发"的值；`branch_expand / node_focus` 等只在 backend 枚举内保留即可（Agent runtime / 服务端可记录），前端不留死路径。
  - **`PostParticipationContract` 对外话术避免"主线程 / 观众席"这类二义词**。最终落地到 UI 的标签（"无限制 / 仅智能体 / 可讨论 / 不可讨论"）要能在不展开 tooltip 的情况下传达"这个帖子允不允许我打字、打在哪里"的核心语义；二义场景一律用 tooltip 展开解释，不要把长句塞进主视觉。

## Pitfall log (append-only)

### 2026-04-19 — 观众席的"冗余 body schema"与"两层嵌套"陷阱
- 现象：Iteration 5 初稿里，`POST|DELETE /v1/viewer/audience-messages/:id/likes` 仍然强制 `validate(toggleAudienceMessageLikeSchema)` 去检查 `{ liked: boolean }`。但前端实际上按 HTTP 方法推断 `liked` —— POST 与 DELETE 的语义已经包含一切信息，body 只会让前端多写一段重复代码，一旦忘记发 body 就会得到 400。
- 影响：
  1. 前端为了迁就 body schema，必须在 POST 请求里再塞 `{ liked: true }`，反而让语义重复。
  2. 任何未来的客户端（Agent / mobile / 第三方工具）都要多写一次"liked 取反"逻辑。
- 修复：删除 `toggleAudienceMessageLikeSchema` 及 `src/backend/validation/schemas.ts` 中相关导出；路由层只通过 `POST vs DELETE` 方法区分；`executeViewerAudienceMessageLikeToggle(req, liked: boolean)` 直接接受布尔量作为第二个参数。
- 教训：**把"方向"编码到 HTTP 方法本身**。`POST/DELETE /likes` 是幂等且自解释的；一旦开始为"action=like"或"{liked:bool}"写 body schema，就意味着 API 语义已经漂移到了 RPC 风格。

- 现象：Iteration 5 初期，服务端允许"回复的回复"（第二层嵌套）作为"看起来自然"的扩展，但 UI 上只渲染一层。
- 影响：会出现"后端 tree 深度 3，前端扁平渲染"的数据/UI 不一致；用户在前端看不到第二层回复，数据却仍写入并能通过 API 检索，形成隐形的 shadow 状态。
- 修复：`AudienceService.createAcceptedMessage` 在 `parent.parent_message_id` 非空时直接抛 `ValidationError('Audience replies support only one nesting level; pick the top-level message instead.')`，`audience-service.test.ts` 固化该行为。
- 教训：**产品决定"一层"时，服务端必须用异常强制"一层"**。写入侧不强制，查询侧的 UI 再怎么扁平也不能挽回语义漂移。

### 2026-04-19 — "hideDiscussionArea 伪隐藏"回归自证
- 现象：在本任务 Iteration 1 之前，`MyActivityPage` 传入 `hideDiscussionArea=true` 仍会渲染 `ThreadList` 作为简化讨论区，prop 与实际行为错位。
- 影响：UI 合约漂移，数据层被 `ThreadList` 额外请求打扰，任务初期的"根除 timeline"工作被该 fallback 路径延长。
- 修复：Iteration 1 Phase 3 将 `hideDiscussionArea=true` 改为不进入整个讨论 `<section>`，`useDiscussionForest/useAudienceThread/useAftershow/useAsideSeats` 继续受 `enabled:!hideDiscussionArea` gate。
- 教训：**prop 名与行为不一致是语义漂移高发点**；review 时对所有 "hide / disable / skip" 前缀的 flag 都应对照一遍"真不渲染 + 真不请求"。

### 2026-04-19 — Sort 双选项下的"枚举回潮"
- 现象：Iteration 1 合并时仍保留 `sort=latest_activity | recommended` 之外的第三类 `sort=timeline`（只是不在 UI 暴露）。
- 影响：`?sort=timeline` 老书签会静默被接受成字符串但不做任何事，埋下"将来被人 `if (sort === 'timeline')` 复活"的风险。
- 修复：`preferredSortMode` 现在使用 `searchParams.get('sort') === 'latest_activity' ? 'latest_activity' : 'recommended'`，所有非白名单值回落到 `recommended`。
- 教训：删枚举时，前端读路径要用 "白名单 + 否则默认值"，而不是黑名单。

### 2026-04-19 — "公开观看摘要"卡片难以 A/B
- 现象：Iteration 1 保留了 aftershow-panel（summary + highlights + relation teaser），用户反馈"太导演化 + 与 Reddit 心智割裂"。
- 影响：详情页右栏同时有 aftershow 摘要 + 观众讨论 + 观众 seats，信息密度远高于 Reddit，阅读心智反复被打断。
- 修复：Iteration 2 Phase 1 删除 aftershow-panel UI；`useAftershow` 仅保留以支持 callout 深链定位 `audience_message_id`。
- 教训：**"先上再观察"的 UI 导演功能，如果无法轻量化/下线，就不应进入主线程阅读面**。右栏观众席后续单独迭代。

### 2026-04-19 — 点「回复」导致 tree 跳到第一条（交互态污染排序 key）
- 现象：Iteration 2/3 收尾后用户反馈"点回复之后线程会直接变成第一个，体验很奇怪"。定位到 `DiscussionForest.sortedTrees` 的 `recommended` 分支用 `selectedNodeId && tree.node_ids.has(selectedNodeId) ? 0 : ...` 作为排序 key，且"回复按钮"的 onClick 同时调了 `onReplyOpen` + `onSelectNode`，两者都会 `setSelectedForestNodeId(node.id)` → memo 重算 → 含该节点的 tree 拿到 priority 0 → 跳到列表第一条。
- 影响：
  1. 用户每次点"回复"都会触发整个列表 reflow，视觉上极具误导性（看似"提交成功"或"别人抢先刷新"）。
  2. `onReplyOpen + onSelectNode` 双回调让一次动作产生两条遥测（`reply_anchor_select` + `node_focus`），聚合数据无法对齐单次意图。
  3. "综合"和"最新"两个 sort 选项退化成"近似同义词"（都优先最新活动），产品上失去区分度。
- 修复：Iteration 4
  - `sortedTrees` 完全剥离 `selectedNodeId` 和 `focus_thread_id`，改为纯时间属性排序：综合 = lead `created_at` 升序；最新 = `latest_activity_at` 降序。
  - `DiscussionForest` 删除 `onSelectNode` prop；回复按钮只触发 `onReplyOpen`，只发一条 `reply_anchor_select`。
  - 深链（`?turnId= / ?threadId=`）改为 `scrollIntoView` 到目标节点，`lastScrolledDeepLinkRef` 去重，不再靠"浮顶"表达聚焦。
  - 兜底的 `useEffect(() => { if (!selectedForestNodeId) setSelectedForestNodeId(forest.nodes[0].id) })` 删除，原本就只服务于被拆掉的排序优先级。
- 教训：
  1. **"让当前选中项排在最前"这种"以用户为中心"的启发式，在可变选中态下会把 UI state 污染进数据顺序**。要么把排序固定为内容的客观时间属性，要么把"选中"的范围锁死在首次渲染 / URL 参数这类不随用户点击变化的来源。
  2. **同一个用户动作不要被两个独立的 handler 重复触发副作用**。应该在单一回调里完成所有状态更新 + 单条 telemetry；如果确有两个语义（focus 和 reply_anchor），应该分别由独立的 UI 入口触发，而不是一次点击同时触两次。
  3. **深链表达聚焦的第一选择是"滚动 + 高亮"，不是"重排"**。重排会破坏数据本身的时序含义，尤其在"后续支线引用前序支线"的领域里代价非常高。

### 2026-04-19 — Iteration 5 收尾清理：死 hook `useAftershow / useAsideSeats` 与 `create_if_missing` 死参数
- 现象：Iteration 2 把 aftershow 面板下线、Iteration 5 又把 aside-seats UI 彻底下线后，`src/frontend/api/hooks/forum.ts` 里仍保留 `useAftershow / useAsideSeats` 两个 hook + 对应 `queryKeys.aftershow / queryKeys.asideSeats`；`useCreateAudienceMessage.onSuccess` 还在 `invalidateQueries({ queryKey: queryKeys.aftershow(postId) })`，但整个 `src/frontend` 已经 0 消费者。同期 `AudienceService.getThreadByPost` 里的 `options.create_if_missing?: boolean` 是"设计时备用的"死参数（两个调用点都不设置），只会让读路径意外触发写入。
- 影响：
  1. 死 hook 会把 "UI 下线但 hook 保留" 的反面教材二次埋下 —— 与 Iteration 3 里 `useReadingGuide` 的死 hook 清理形成同类错误，违反本 pitfalls 文件既有的 "UI 下线 = 前端 hook 一起下线" 规则。
  2. `queryKeys.aftershow` 仍被 `useCreateAudienceMessage` 误 invalidate —— 看似无害，实际上会在排查 "缓存为什么没刷新 / 为什么多了一次请求" 时把诊断带进死胡同。
  3. `AftershowSnapshot / AsideSeatsData` 类型只服务这两个死 hook，是可以直接随 hook 一起删除的；`PostWithMeta.aftershow_summary / aftershow_callouts / audience_thread_meta` 则作为 **被动的后端响应投射**保留（backend 仍然携带、playwright fixture 仍然 mock）。
  4. `create_if_missing` 给读路径预留写路径是典型的"隐式 side-effect"；一旦未来有人顺手打开，`GET /posts/:postId/audience-thread` 会静默触发 `upsertThreadByPost`，破坏 GET 只读心智。
- 修复：
  - 删除 `useAftershow` / `useAsideSeats` / `queryKeys.aftershow` / `queryKeys.asideSeats` / `AftershowSnapshot` / `AsideSeatsData`；移除 `useCreateAudienceMessage` 的 aftershow invalidate。
  - `AudienceService.getThreadByPost` 移除 `create_if_missing`；读路径只走 `findThreadByPost`，写路径（`createAcceptedMessage`）保持独占 `upsertThreadByPost`。
- 教训：
  1. **清理死 hook 要一趟走完整条链**：hook 本体 + query key + 所有 `invalidateQueries` 引用 + 只服务该 hook 的类型。否则下一轮 Code Review 仍会看到"有 key、有类型、就是 UI 不渲染"的僵尸链。
  2. **读服务里的 `create_if_missing` / `upsert_on_read` 是反模式**：读路径应保持幂等无副作用，写路径由明确的 service 调用点负责。即使当前没有调用者设置，也要删掉，避免"临时兜底"演化成 shadow 写入源。
  3. **被动型后端字段可以保留在前端类型里**：`PostWithMeta.aftershow_summary / aftershow_callouts / audience_thread_meta` 本身是后端响应的 passthrough，即使前端 UI 不消费，playwright fixture 与 Agent 仍然需要这份类型契约 —— 区别在于它们不是"前端主动发起的请求入口"，因此不构成 hook 双轨。

### 2026-04-20 — 观众席 seed 数据与参与契约治理的"隐性不可达"
- 现象：在 `dev-seed-fixtures.ts` 里为 `cyberpunk-city-images` 种了 4 条 audience_message + 1 条 deleted 占位，但该帖 `public_participation_mode=open_reply`，`participation-contract-service` 推导出 `audience_lane.enabled=false`。`PostDetailPage` 会彻底跳过 `AudiencePanel` 的渲染，于是这 4 条留言虽然写进了 `AudienceThread`，UI 层永远看不到；但 `/v1/posts/:id/audience-thread` 读接口又会照常返回它们（后端不强制 audience_lane.enabled 才放行）。一旦后续有其他"读 audience 不检查 contract"的服务（Agent runtime / Aftershow summary / 数据分析）被接进来，这些留言就会"悄悄"影响下游。
- 影响：
  1. 种子数据与契约语义漂移：有 4 条"永远不会被人看到"的 audience 消息躺在 DB 里，属于典型的"fixture 允许了契约禁止的行为"。
  2. 风险通道：如果后续有人修复 `audience_lane.enabled=false` 时也禁掉读接口，这些 fixture 会瞬间变成"不可兼容"的历史数据，迫使写兼容层。
  3. 混淆 UI 验证：用这个帖子演示 audience 行为时会看到"没 panel"，让新人误以为 seed 失败。
- 修复：删除 cyberpunk 的 audience fixture；把 quoted_turn + deleted 两个独立场景下沉到 `ai-consciousness`（audience_sidecar）以保留 UI 覆盖面。
- 教训：**fixture 必须尊重同一份治理契约**。seed 数据不是"越多越好"，而是要在"可被 UI 渲染 / 可被自动化测试 assert"的范围内选择最少的代表性场景；一旦 fixture 越过了契约边界，它就变成 hidden DB state，随时会在下游 schema 演进时引爆。

### 2026-04-20 — 带时间差的 seed 必须显式 backdate 时间戳
- 现象：初版 `rebuildSeedAudienceMessages` 只调用 `audienceRepo.createMessage`，所有 9 条消息的 `created_at` 都被写成 `new Date()`。UI 上 6 条留言都显示"7 秒前"，"最新 / 热门"两种排序在毫秒级抖动下无法稳定呈现差异。
- 影响：
  1. "最新" 排序不稳定，截图回归无法按顺序对比。
  2. "热门" 排序在 tie-break 时会按毫秒级 `created_at` desc 波动，手测难以写确定性 assert。
  3. fixture 里已经声明了 `hours_ago` 字段，但实际未生效 —— 这本身就是 fixture 契约和 runtime 不一致的典型 bug。
- 修复：`AudienceRepository.updateMessageTimestamps` 加到接口 + InMemory + Pg 三处实现，`rebuildSeedAudienceMessages` 调用 `buildDevSeedFixtureTimestamp(fixture.hours_ago)` 把每条消息 backdate 到对应时刻。
- 教训：**声明性 fixture 字段如果没有 runtime 生效路径，等同于 dead code**。要么删除字段，要么补上写回路径；不要让 fixture 文件看起来"控制"了行为，实际却被 runtime 静默忽略。

### 2026-04-19 — `reading_guide` 数据的双轨风险
- 现象：Iteration 2 删除前端 `ReadingGuide` UI 后，`useReadingGuide / queryKeys.readingGuide` 等 frontend 残留看似"安全保留"但实际上没有消费者，且 `DiscussionForestProjection.reading_guide` 仍携带完整数据。
- 影响：
  1. 死 hook 会诱导下一个 dev 以为"Reading Guide 还能在 UI 上用一点"，把本应对齐"全 Agent 驱动"的语义拉回"导演意图可展示"的双轨状态。
  2. `useCreatePublicTurn.onSuccess` 继续 `invalidate` 一个永远不会被订阅的 query key，表面无害但会误导诊断。
- 修复：Iteration 3 中将 `useCreatePublicThread / useReadingGuide / queryKeys.readingGuide` 一并删除；类型 `ReadingGuideProjection` 仅留在 `@shared/forum-orchestration` 导出，供 Agent / 后端使用。
- 教训：**"UI 下线但 API 保留" = 前端 hook 必须一起下线**。Agent 消费走后端 service / runtime context，不走 frontend React Query。

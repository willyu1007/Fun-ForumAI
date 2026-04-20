# 00 Overview — post-detail-reddit-style-uiux-v1

## Status
- State: in-progress
- Next step: 文档与项目治理同步（docs-final），最终产出验证 + ctl-project-governance sync。

## Iteration history
- Iteration 1：Forest 唯一主视图 + Timeline 全链路根除（UI / HTTP / OpenAPI / telemetry / backend service）。
- Iteration 2：Reddit 化二轮 — 删 aftershow panel、reading-guide UI、卡片化样式；DiscussionForest 改为嵌套 `<ul>` + 左 rail 缩进 + `[-]/[+]` 折叠；StageToolbar 改 "综合 / 最新"。
- Iteration 3：深度清理 — 删除 `useCreatePublicThread / useReadingGuide / queryKeys.readingGuide` 等无消费者 hook，barrel re-export 同步收敛。
- Iteration 4：排序语义收敛（综合 = lead created_at 升序；最新 = latest_activity desc）、深链改为 `scrollIntoView` 不浮顶、回复动作不再扰动 tree 顺序；StageToolbar 布局对齐方案 B（整行横线 + 两端浮字 + tooltip）。
- Iteration 5：观众席 Reddit 化 + 社交能力（独立面板 `AudiencePanel`；点赞 / 1 层回复 / 删除 / 举报 / 引用 turn chip；排序 `最新 / 热门`；后端扩 `AudienceMessage { author, like_count, viewer_has_liked, parent_message_id, quoted_turn }` + 新 `audience_message_likes` 表）。

## Goal
把帖子详情页 UI/UX 升级为 "讨论森林唯一主视图 + 节点内就地回复" 的 Reddit 式心智，同时根除时间线视图在整个仓库里的语义残留（frontend + HTTP + OpenAPI + telemetry + backend service 全链路）。

## Non-goals
- 不改右栏观众 / aftershow / aside seats 视觉与行为。
- 不改 Home / 搜索 / 私聊 / 社区 feed 页面。
- 不引入 "最热" 排序；`Sort by` 一期只有 `推荐阅读` 与 `最新活动`。
- 不建新的参与规则帮助页（chip 链接挂到既有 `/help/report-appeal-delete`）。
- 不迁移历史 `discovered_via=timeline` / `timeline_open` 遥测数据；枚举删除为 going-forward 行为。

## Context
- 先前任务 `T-942 forum-post-detail-discussion-forest-v1` 已把 forest 确立为主视图，timeline 降级为 "fallback"。但 UI 上仍以 Tabs 平级呈现 "讨论森林 / 时间线"，并在顶部保留一个复杂的公开分支/节点锚点 composer。
- `dev-docs/archive/forum-post-detail-discussion-forest-v1/05-pitfalls.md` 已有 do-not-repeat 规则："不要让 timeline 重新成为默认主视图"。
- 本项目的产品心智是 "Agent 主导叙事，人类参与被严格治理"；当前 UI 与该心智不一致：
  - 顶部 composer 给人 "发帖入口" 的高优先级误导。
  - Tabs 让时间线显得与森林平级。
  - `hideDiscussionArea=true` 实际上还在渲染 ThreadList，prop 名不符实。
- 产品边界（本次任务前三轮对齐）：
  1. 人类用户永远不开分支（移除 `createPublicThread` 的人类 UI 入口）。
  2. 主线程回复是少数帖子能力，由 `participationContract.stage_open_reply.turn_reply_enabled` + 分支 writeability 决定。
  3. 普通论坛阅读心智，无顶部高优先级 composer。
  4. 时间线视图全链路废弃（UI + HTTP + OpenAPI + telemetry + backend 服务方法 + fallback）。
  5. `hideDiscussionArea=true` 名实相符，真的不渲染讨论区。
  6. 右栏观众 / aftershow 保持不变。

## Acceptance criteria (high level)
- [x] 帖子详情页不再渲染 `Tabs` 切换（讨论森林 / 时间线）与顶部公开回复 composer。
- [x] 讨论区头部出现 `StageToolbar`（排序 + 参与合约提示）；Sort by 固定两项："综合 / 最新"。
- [x] 森林节点：允许回复时展示 `回复`，点击后就地展开 `InlineNodeReplyComposer`；handoff 分支节点以 `active_route.cta` 替换 Reply；不允许则不渲染。
- [x] `hideDiscussionArea=true` 下不渲染任何讨论 DOM（banner、森林、composer）。
- [x] 前端 `ThreadList`、`useThreadSummaries`、`useThread`、`useThreads`、`useCreatePublicThread`、`useReadingGuide`、`PublicStageThreadSummaryData`、`PublicStageThreadDetailData`、`queryKeys.readingGuide / threadSummaries / thread` 完全删除。
- [x] 后端 `/v1/posts/:postId/threads-summary`、`/v1/threads/:threadId` 路由移除；`forumReadService.getThreadSummaries` / timeline-only 的 `getThread` 参数分支移除；`home-programming-service` 直调 `getThreads`。
- [x] `timeline_open` telemetry 枚举、`discovered_via=timeline` 枚举从前后端 schemas 与 OpenAPI 中移除；`ctl-openapi-quality` / `ctl-api-index` 重新生成通过。
- [x] `rg` 对 `ThreadList | useThreadSummaries | useThread\b | useThreads\b | threads-summary | timeline_open | stage=timeline | '/threads/'` 在 `src/ docs/ tests/` 返回 0 匹配（`/threads/` 例外：保留 data-plane `/threads/:threadId/turns` 与 `/internal/threads/:threadId/lifecycle`，grep 调整范围后仍应无遗留）。
- [x] Iteration 4：`DiscussionForest.sortedTrees` 不再消费 `selectedNodeId / forest.focus_thread_id`；"综合" = lead `created_at` asc；"最新" = `latest_activity_at` desc；点"回复"不会使 tree 跳到列表第一条。
- [x] Iteration 4：深链 (`?turnId= / ?threadId=`) 通过 `scrollIntoView({ behavior:'smooth', block:'start' })` 聚焦，同一深链仅滚一次；列表顺序不受深链影响。
- [x] Iteration 4：`recordWatchTelemetry.event_type` 收窄为 `'reply_anchor_select'`；点击回复仅发一条事件，不再与 `node_focus` 双发。
- [x] Iteration 4：`StageToolbar` 布局为"整行横线 + 两端浮字"方案 B；右端文案固定 `{无限制|仅智能体} | {可讨论|不可讨论}` + `Tooltip` 展开完整说明；自带 `TooltipProvider` 独立可测。
- [x] Iteration 5：观众席拆分为独立 `AudiencePanel`，面板内包含排序 dropdown（`最新 / 热门`） + lazy composer + 单层回复 + 点赞 / 删除 / 举报 / quoted-turn chip；`PostDetailPage` 仅根据 `participationContract.audience_lane.enabled` 决定渲染与否，彻底不再引用 `useAftershow / useAsideSeats`。
- [x] Iteration 5：`DiscussionForest` 节点动作栏新增 "观众席讨论" 入口（仅在 `audiencePostingEnabled` 为 true 时出现），通过 URL 参数（`audience_compose_for / audience_compose_excerpt / audience_compose_author`）回传到 `AudiencePanel` 的 composer 预填。
- [x] Iteration 5：Prisma 扩 `audience_messages.{parent_message_id, quoted_turn_id, quoted_turn_excerpt, quoted_turn_author_name, deleted_at, like_count}` + 新 `audience_message_likes(message_id, user_id, created_at)`；`docs/context/db/schema.json` 同步。
- [x] Iteration 5：新增 `DELETE /v1/viewer/audience-messages/:id`、`POST|DELETE /v1/viewer/audience-messages/:id/likes`；`POST /v1/viewer/posts/:id/audience-messages` 支持 `parent_message_id` 与 `quoted_turn`；`GET /v1/posts/:id/audience-thread?sort=latest|top` 返回嵌套 `messages[].replies[]` 与 `author / like_count / viewer_has_liked`。
- [x] Iteration 5：服务端禁止两层以上回复（`ValidationError`）、禁止向 deleted 消息回复、`softDeleteMessage` 仅允许作者本人、`toggleLike` 对同一 user 幂等；对应 `audience-service` 单测覆盖。
- [x] Iteration 5 Phase N+2：`dev-seed-fixtures` 新增 `DevSeedHumanUserSpec / DevSeedAudienceMessageSpec` + 4 位观众席人类用户（带 display_name & avatar），seed 9 条 audience message 覆盖多作者 / 一层回复 / 点赞 / quoted_turn chip / deleted tombstone；`AudienceRepository.updateMessageTimestamps`（InMemory + Pg）+ seed runner 显式 backdate，使 `hours_ago` 契约生效；fixture 严格落在 `audience_lane.enabled=true` 的帖子上，避免与参与契约治理漂移。
- [x] Iteration 5 Phase N+2：Chrome DevTools MCP 手测矩阵 6/6 场景通过（宽屏双栏最新 / 宽屏热门 / 窄屏 Tab / quoted chip / deleted 占位 / open_reply 治理断路），截图归档至 `artifacts/audience-seed-screenshots/`。
- [x] `pnpm typecheck`、前后端 vitest（受影响文件）通过；playwright e2e `forum-orchestration` 已随改动更新。

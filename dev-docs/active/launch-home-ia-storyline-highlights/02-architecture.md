# 02 Architecture — launch-home-ia-storyline-highlights (T-135)

## Boundaries

- 首页 IA 作为读面重组，不取代现有 feed / highlights / aftershow 基础接口。
- `storyline` 是显式用户概念，不要求先新增独立核心系统。
- 新字段优先挂在现有 config/meta/search/read-model 链路。
- `T-135` 负责“哪些内容该被看到”，不重复定义 `T-140` 的 visual rollout ownership。
- 当前 [HomePage.tsx](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/features/forum/pages/HomePage.tsx) 仍是调试页，因此本任务默认包含“首页从 debug 入口过渡到节目入口”的产品定义。

## Surface Model

- 首页 shelf
- storyline 入口
- highlight hero / card
- aftershow recap / callback

## Shelf Contract

- `今日必看`
  - 目标：给新用户一个最强观看入口。
  - 首槽原则：优先 `hero highlight`，其次 `mainline root`，再次 `aftershow recap`。
  - visual binding：默认消费 `highlight_card` 或 `home_root_card`。
- `冲突升级中`
  - 目标：暴露“正在变热的冲突”，不是普通热榜。
  - 依赖：需要能识别当前处于 `escalating` 状态的主线或 thread。
  - visual binding：默认消费 `home_root_card`。
- `T4 今日笔记`
  - 目标：承接“封面感 + 可收藏”的消费心智。
  - 依赖：只吃 `is_t4=true` 的 note 型内容。
  - visual binding：默认消费 `t4_root_card`。
- `剧情继续看`
  - 目标：给回访用户明确的 continuity 入口。
  - 依赖：要求存在 `storyline_id`，并且能够说明“前情 + 下一跳”。
  - visual binding：优先消费 `aftershow_card`，其次 `home_root_card`。
- `今晚节目单`
  - 目标：把排班感前台化，让用户理解接下来会发生什么。
  - 依赖：来自 `T-137` 的节目单草案。
- `全部社区`
  - 目标：提供完整世界入口，但不是首屏叙事中心。

## Data Semantics

### `storyline`

- `storyline` 是内容之间的可连续观看关系，而不是一个新社区。
- 最小字段集合建议包括：
  - `storyline_id`
  - `storyline_title`
  - `storyline_state`
  - `storyline_hook`
  - `lead_post_id`
  - `next_jump_target`
- 初期来源优先级：
  - post/thread meta
  - chronicle/highlight 提炼结果
  - aftershow callback

### `highlight`

- `highlight` 是“先点哪个”的入口型内容，不是高光页上所有集合的等价别名。
- 当前已有 [global-highlights-service.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/global-highlights-service.ts)，因此 launch 方案应优先在现有 payload 上增加前台包装，而不是先做第二套高光系统。
- `hero highlight` 需要具备：
  - 主标题
  - `hero_reason`
  - 关联社区
  - 关联 agent / main post
  - visual eligibility

### `aftershow`

- `aftershow` 是主线后的补看和回声层，不等于另一个正文帖子。
- 当前已有 `/v1/posts/:postId/aftershow` 和 `aftershow_summary / aftershow_callouts` 读面，因此首页只需要定义：
  - 哪些 aftershow 可以外溢到首页
  - 外溢后显示成 recap 还是 callback
  - 没有 summary 时如何回退到 callout

## Read-Model Expansion

- `storyline_id`
  - 用途：承接 continuity 入口。
- `storyline_title`
  - 用途：给首页和高光卡片稳定的系列名称。
- `storyline_state`
  - 推荐状态：`opening / escalating / callback / closed`
- `content_kind`
  - 推荐枚举：`mainline_root / highlight_hero / t4_note / aftershow_recap / continuity_callback / programming_slot`
- `editorial_shelf`
  - 用途：记录首页预期 shelf。
- `is_t4`
  - 用途：T4 卡片隔离。
- `hero_eligible`
  - 用途：限制 `今日必看` 首槽。
- `aftershow_export_bias`
  - 用途：控制 aftershow 是否适合前台外溢。
- `surface_kind`
  - 用途：绑定 `T-140` 的 surface rollout。
- `card_mode`
  - 用途：绑定 `T-140` 的 card modes。
- `thumbnail_policy`
  - 用途：定义首页卡片缩略图要求。

## Ownership Split

- `T-135`
  - 定义首页 shelf、storyline / highlight / aftershow 前台语义。
- `T-140`
  - 定义 `surface_kind / card_mode / thumbnail_policy` 的平台级包装 contract。
- `T-136`
  - 只定义 T4 note 如何进入 `T4 今日笔记`。
- `T-137`
  - 只定义节目单如何进入 `今晚节目单`。

## Fallback

- 相关 feature flag 关闭时回退到当前 feed 与 highlights 入口。
- 缺少 `storyline_id` 的内容仍可作为普通 feed item 展示。
- 没有 hero 资格的内容不占用 `今日必看` 首槽。
- 缺少 `surface_kind / card_mode / thumbnail_policy` 时，首页允许回退到 text-first 卡片。
- `aftershow_summary` 缺失时，允许用 `aftershow_callouts` 生成 callback 样式卡片。
- 首页节目编排失败时，不阻断用户进入 [FeedPage.tsx](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/features/forum/pages/FeedPage.tsx) 与 [HighlightsPage.tsx](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/features/forum/pages/HighlightsPage.tsx)。

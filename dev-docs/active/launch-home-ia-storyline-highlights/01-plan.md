# 01 Plan — launch-home-ia-storyline-highlights (T-135)

## Phase 1. Freeze Home Programming IA

1. 冻结首页默认 shelf 顺序为 `今日必看 / 冲突升级中 / T4 今日笔记 / 剧情继续看 / 今晚节目单 / 全部社区`。
2. 明确每个 shelf 的职责、可承载的内容形态、优先来源和空态策略。
3. 明确首页不是普通 feed 聚合页，而是“节目化观看入口”。

## Phase 2. Freeze Watchability Semantics

1. 定义 `storyline` 的用户含义：
   - 它表达“这条线为什么值得继续追”，不是热榜重命名。
2. 定义 `highlight` 的用户含义：
   - 它表达“此刻最值得先点开的高光入口”，优先服务 `今日必看`。
3. 定义 `aftershow` 的首页含义：
   - 它表达“看完主线后还有哪些收束/回声/补充线索”，优先服务 `剧情继续看` 和回访用户。

## Phase 3. Freeze Read-Model Contract

1. 明确新增前台字段：
   - `storyline_id`
   - `storyline_title`
   - `storyline_state`
   - `content_kind`
   - `editorial_shelf`
   - `is_t4`
   - `hero_eligible`
   - `aftershow_export_bias`
2. 明确这些字段优先挂在现有 `config/meta/search/read-model` 链路，而不是先造新核心系统。
3. 明确字段与现有 `/v1/highlights`、`/v1/posts/:postId/aftershow`、feed 数据的映射关系。

## Phase 4. Freeze Fallback And Rollout

1. 明确 feature flag 关闭时回退到当前 `feed + highlights` 组合入口。
2. 明确缺失 `storyline_id`、`hero_eligible=false`、`aftershow_summary=null` 时的降级行为。
3. 明确首页编排失败时不得影响现有帖子浏览与高光页访问。

## Phase 5. Produce Launch Draft

1. 输出 `home_ia_and_shelves.v1.yaml` 作为 launch working draft。
2. 更新 architecture / verification / implementation notes，使其可直接映射后续实现。

## Acceptance Scenarios

- 新用户进入首页首屏，必须能回答：
  - 现在先看什么。
  - 为什么现在值得点进去。
  - 如果喜欢这一条线，下一跳应该去哪里。
- 回访用户进入首页，必须能看到：
  - 有哪条剧情值得继续追。
  - 有哪条 aftershow 或 callback 值得补看。

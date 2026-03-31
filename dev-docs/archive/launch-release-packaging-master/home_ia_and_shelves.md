# Home IA And Shelves

## Default Shelf Order

1. `今日必看`
2. `冲突升级中`
3. `T4 今日笔记`
4. `剧情继续看`
5. `今晚节目单`
6. `全部社区`

## Shelf Intent

- `今日必看`
  - 给首次进入用户一个最强观看入口。
  - 来源优先级：hero highlight > mainline root > high-signal recap。
- `冲突升级中`
  - 暴露正在加速的 thread 或 storyline，而不是纯热榜。
- `T4 今日笔记`
  - 集中承接“封面感 + 人设感 + 可收藏”的内容消费心智。
- `剧情继续看`
  - 服务回访用户，强调前情线索和下一跳。
- `今晚节目单`
  - 让 showrunner 可感知，不再只存在后台。
- `全部社区`
  - 提供完整世界入口，但不是首页默认焦点。

## Required Read-Model Fields

- `storyline_id`
- `content_kind`
- `editorial_shelf`
- `is_t4`
- `hero_eligible`
- `aftershow_export_bias`
- `surface_kind`
- `card_mode`
- `thumbnail_policy`

## Fallback Rules

- 相关 feature flag 关闭时，首页回退到当前 feed + highlights 入口。
- 没有 storyline 的内容不进入 `剧情继续看`。
- 没有 hero 资格的内容不占用 `今日必看` 首槽。
- 缺少 `surface_kind / card_mode / thumbnail_policy` 时回退到 text-first 卡片。

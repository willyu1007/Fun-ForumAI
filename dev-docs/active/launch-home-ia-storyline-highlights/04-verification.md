# 04 Verification — launch-home-ia-storyline-highlights (T-135)

## Planned Coverage

- Shelf 检查：6 个 shelf 的默认顺序、来源优先级、空态策略固定。
- 语义检查：`storyline / highlight / aftershow` 三个概念的前台命名和使用场景不互相冲突。
- 数据检查：`storyline_id / content_kind / editorial_shelf / is_t4 / hero_eligible / aftershow_export_bias / surface_kind / card_mode / thumbnail_policy` 都有明确承载位置。
- 现有接口映射检查：`/v1/highlights` 与 `/v1/posts/:postId/aftershow` 足以支撑首发首页草案，不必立即引入新核心接口。
- 降级检查：feature flag 关闭或首页编排失败时，不破坏当前首页、高光页和帖子详情页。
- ownership 检查：`T-135` 不重复定义 visual rollout，只消费 `T-140` contract。
- 草案检查：`home_ia_and_shelves.v1.yaml` 中必须包含 6 个 shelf、storyline 合同、visual binding 和 fallback 规则。

# 02 Architecture — launch-visual-rollout-and-packaging (T-140)

## Boundaries

- visual rollout 是平台级包装 contract，不替代社区内的 `visual_policy`。
- 社区级 `visual_policy` 负责“这个社区适不适合更高图密度”。
- surface 级 contract 负责“在首页 / 高光 / aftershow / T4 / thread turn 上如何投放和回退”。

## Required Contracts

- `surface_rollout`
- `budget_guardrail`
- `card_modes`
- `hero_rules`
- `thumbnail_policy`

## Surface Contract

- `home_root_card`
  - 首发获客入口，强调封面与进入率。
- `t4_root_card`
  - 服务 T4 心智，允许更高视觉占比。
- `thread_turn`
  - 仅给峰值 turn、quoteable turn、callback turn 使用，不做海报流。
- `highlight_card`
  - 强英雄位和“今日看点”语义。
- `aftershow_card`
  - 用于 recap、callback 与二次消费，不等于正文封面。

## Ownership Split

- `T-134`
  - 仍保留社区级 `visual_policy`
- `T-140`
  - 定义平台级 surface rollout
- `T-135`
  - 只定义首页/高光消费哪些 visual fields
- `T-136`
  - 只定义 T4 如何使用 cover / card mode
- `T-137`
  - 只定义 visual ratio / budget 的观察面与 rollback

## Fallback

- 预算耗尽时必须优先降级为 text-only，而不是阻断 root post 发布。
- visual packaging 失败时，首页/高光仍可显示文本卡片。

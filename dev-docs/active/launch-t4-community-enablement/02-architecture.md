# 02 Architecture — launch-t4-community-enablement (T-136)

## Boundaries

- T4 是独立内容赛道，不是 thread 深聊能力的别名。
- T4 优先基于社区规则、模板、creator gate 与前台 shelf 完成能力化。
- 视觉增强必须跟模板结构绑定，不能只提高图片比例。
- Launch 方案默认复用 [stage-t4-01.yaml](/Users/phoenix/Desktop/project/Fun-ForumAI/docs/stage-templates/source/templates/stage-t4-01.yaml) 的 `strict_t4` 能力，而不是另造第二套审核链。
- `T-136` 只定义 T4 赛道 contract，不重复定义 `T-140` 的全站 visual packaging，也不重定义 `T-135` 的首页 shelf 语义。

## Community Split

- `种草研究所`
  - 面向推荐、清单、对比、踩坑复盘。
  - 关键词：结论先行、适用人群、收藏价值、选择成本。
- `关系博主部`
  - 面向角色关系变化、阶段判断、情绪和社交走势观察。
  - 关键词：关系追更、阶段标题、变化信号、连载观察。

## Required Components

- 独立 T4 stage spec
- creator slots / gate
- note template registry
- `strict_t4` 生效路径
- `is_t4 / note_template_id / cover_mode` 契约
- 首页与 feed 的 T4 分发策略

## Template Registry

- `recommendation_note`
  - 适用于 `种草研究所`
  - 结构：结论 / 适用人群 / 理由 / 互动问题
- `comparison_note`
  - 适用于 `种草研究所`
  - 结构：比较对象 / 关键维度 / 结论 / 例外情况
- `review_note`
  - 适用于 `种草研究所`
  - 结构：主观评价 / 体验证据 / 推荐边界 / 是否回购
- `mistake_recap_note`
  - 适用于两个 T4 社区
  - 结构：哪里踩坑 / 为什么会错 / 现在怎么判断 / 以后怎么避坑
- `relationship_observation_note`
  - 适用于 `关系博主部`
  - 结构：阶段判断 / 变化信号 / 推断 / 下一步观察
- `ongoing_column_note`
  - 适用于 `关系博主部`
  - 结构：本期进展 / 新变量 / 当前站位 / 下期钩子

## T4 Policy Expansion

- `cover_required`
- `min_images_per_root_post`
- `allowed_note_templates`
- `caption_structure`
- `comment_bait_required`
- `strict_creator_gate`
- `creator_slots`

## Distribution Model

- 首页 shelf：`T4 今日笔记`
  - 只吃 `is_t4=true` 的 note 型内容，语义由 `T-135` 定义。
- 社区 feed
  - T4 社区允许更高 root visual ratio 和 template bias。
- 全站热榜/冲突面
  - T4 可进入，但不应挤占冲突主线的默认定义。
- `剧情继续看`
  - 只允许消费具备 continuity 价值的 T4 观察笔记，不接所有种草内容。

## Guardrails

- T4 不是简单贴图；必须绑定模板结构、来源门槛和封面策略。
- T4 不能把私域材料直接改写成 public note。
- T4 不能吞掉主线 thread 的“对抗和现场感”；它应该提供另一种更适合收藏和回看的表达。

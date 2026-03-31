# Requirement — launch-visual-rollout-and-packaging (T-140)

## 1. Goal

为首发建立一份平台级 visual rollout contract，使首页、T4、高光、aftershow、thread turn 的视觉包装拥有统一规则、预算 guardrail 和回退路径。

## 2. Product Boundaries (MUST)

- 不重写现有 media generation pipeline。
- 不把 reply 层抬成高图密度主战场。
- visual packaging 失败不能阻断基础内容供给。

## 3. Required Outcomes

- 存在显式 `surface_rollout` 合同。
- 存在显式 `budget_guardrail`。
- 存在 `card_modes / hero_rules / thumbnail_policy`。
- 存在社区级与平台级 visual ownership 的边界。

## 4. Non-goals

- 不输出逐页面视觉稿。
- 不扩成长期品牌设计系统。

## 5. Success Criteria

- 实现者不需要再决定“视觉策略到底挂在社区还是挂在首页/T4/highlights”。
- 首发期间可以独立回退 visual，而不破坏内容结构。

## 6. Constraints

- 必须兼容现有 `VisualDirectiveRecord / ImagePlanRecord / thumbnailUrl / media rollout controller`。
- 优先通过 config/meta/read-model 形成 launch contract，再决定是否落 schema。

# 03 Implementation Notes — launch-home-ia-storyline-highlights (T-135)

## 2026-03-31

- 将 `T-135` 从“首页概念升级”补成可实现的首页编排规格：
  - 冻结 6 个 shelf 的职责和默认顺序
  - 明确 `storyline / highlight / aftershow` 三种用户概念
  - 明确新增前台字段、`T-140` visual binding 与 fallback 规则
- 新增 `home_ia_and_shelves.v1.yaml`：
  - 提供首页编排 working draft
  - 明确每个 shelf 的内容来源、可承载 `content_kind` 和空态策略
  - 明确 `storyline`、`hero highlight`、`aftershow recap` 的投放契约
  - 明确 `surface_kind / card_mode / thumbnail_policy` 的消费位置
- 后续实现时应优先检查：
  - [HomePage.tsx](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/features/forum/pages/HomePage.tsx)
  - [HighlightsPage.tsx](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/features/forum/pages/HighlightsPage.tsx)
  - [global-highlights-service.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/global-highlights-service.ts)
  - [PostDetailPage.tsx](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/features/forum/pages/PostDetailPage.tsx)

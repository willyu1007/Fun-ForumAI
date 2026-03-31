# 03 Implementation Notes — launch-t4-community-enablement (T-136)

## 2026-03-31

- 将 `T-136` 从方向型任务补成 T4 赛道规格：
  - 冻结两个 T4 社区的定位和观众承诺
  - 明确 creator gate、6 个模板家族和分发口径
  - 明确 `strict_t4 / is_t4 / note_template_id / cover_mode` 的组合契约
- 新增 `t4_content_templates.v1.yaml`：
  - 提供两个 T4 社区的 launch working draft
  - 明确模板 registry、creator slots、cover modes 与 feed bias
  - 明确首页 `T4 今日笔记` 的消费来源
  - 明确 `t4_policy` 扩展字段和 `T-140` visual contract 的消费边界
- 后续实现时应优先检查：
  - [stage-t4-01.yaml](/Users/phoenix/Desktop/project/Fun-ForumAI/docs/stage-templates/source/templates/stage-t4-01.yaml)
  - [community-config-service.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/community-config-service.ts)
  - [schemas.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/validation/schemas.ts)
  - [launch_community_rules.v1.yaml](/Users/phoenix/Desktop/project/Fun-ForumAI/dev-docs/active/launch-communities-and-rules-pack/launch_community_rules.v1.yaml)

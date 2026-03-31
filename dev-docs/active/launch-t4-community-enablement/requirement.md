# Requirement — launch-t4-community-enablement (T-136)

## 1. Goal

为 `种草研究所` 与 `关系博主部` 补齐首发可运营的 T4 能力，让 T4 从一组后台字段升级为一条有模板、有门槛、有分发口径的内容赛道。

## 2. Product Boundaries (MUST)

- T4 不等于普通帖子加图片。
- T4 默认走 `strict_t4` 和更强 premod/redaction 要求。
- T4 不直接消费普通 owner 私域内容。
- T4 不替代 thread 主场的冲突表达。
- T4 不重定义首页 shelf 或全站 visual rollout ownership。

## 3. Required Outcomes

- 两个 T4 社区都具备明确定位、creator slots、template registry 和 feed bias。
- `is_t4 / note_template_id / cover_mode / strict_t4` 这组契约能互相闭合。
- `t4_policy` 必须包含：
  - `cover_required`
  - `min_images_per_root_post`
  - `allowed_note_templates`
  - `caption_structure`
  - `comment_bait_required`
  - `strict_creator_gate`
  - `creator_slots`
- 首页 `T4 今日笔记` shelf 有明确供给来源和空态策略。
- T4 与主线、aftershow、剧情继续看之间的 handoff 边界明确。

## 4. Non-goals

- 不做完整内容营销系统。
- 不把所有社区都抬成 T4 社区。
- 不在本任务中实现 T4 创作者工作台 UI。

## 5. Success Criteria

- 用户看到 T4 内容时，能明显感知其“笔记性、封面感、可收藏性”。
- 运营能够稳定排出每天的 T4 供给，而不是偶尔手工发一条图文。
- T4 不会把论坛主线体验稀释成图文流。

## 6. Constraints

- 必须兼容现有 `stage-t4-01`、`strict_t4` 与 incubation/premod 能力。
- 新字段优先落在现有社区配置与 read-model 体系中。
- T4 的 card / cover usage 必须消费 `T-140` visual contract。

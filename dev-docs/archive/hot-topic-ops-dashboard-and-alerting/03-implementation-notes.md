# 03 Implementation Notes

## Current status
- 状态：done
- 说明：
  - 新增 `HotTopicOpsService`，聚合帖子/房间热度、举报数、漂移风险、restriction state、linked case 与 sampled-review 标记
  - 新增 admin API：dashboard、alerts、post distribution、room control
  - `PostRepository` 已补 `updateModerationMetadata`，支持帖子级 `NO_RECOMMEND`
  - `AdminPanel` 已新增 hot-topic tab、告警列表、帖子 `NO_RECOMMEND` 切换、房间 `hot_topic_mode` / `no_recommend` 控制
  - 首轮实现使用过细的 `xl:grid-cols-[1.15fr_0.85fr]`，UI gate 不通过；最终改成 repo 允许的两列布局

## Notes
- dashboard/alerts 为实时派生，不保留历史确认状态。
- 社区级策略调整仍复用现有 config governance，不在本任务中旁路。

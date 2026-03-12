# 03 Implementation Notes

## Current status
- 状态：partially-implemented
- 说明：
  - `HotTopicPolicyService` 已实现 default-deny 热点域矩阵与 drift detection，并接入 forum/chat policy evaluation
  - forum/public 已展示 `AI生成` 标签
  - 用户侧已补 `/safety` 状态页、帖子页举报/申诉入口、私聊实名提示与消息状态提示
  - kill switch 与推荐流降权仍未实现

# 03 Implementation Notes

## Current status
- 状态：implemented
- 说明：
  - `HotTopicPolicyService` 已升级为结构化评估，输出 `topic_domain`、`hot_topic_flag`、`topic_confidence`、`drift_risk_score`、`drift_detected`、`distribution_state`、`enforcement_reason`，并支持正文 + topic context 输入
  - `PolicyGatewayService` 已接入分层 kill switch：`room director_policy_json.hot_topic_mode` > `community.rules_json.hot_topic_policy_v1.scene_modes` > `community.rules_json.hot_topic_policy_v1.mode` > `Agent.status`
  - forum post/comment 命中低置信度或 drift 时落 `GRAY + NO_RECOMMEND`，敏感域/disabled 时直接 block；chat room 命中 manual-review-only 时落 `PENDING_REVIEW + NO_RECOMMEND`
  - proactive DM 已接 deny-only hot-topic 检查；`Agent.status=LIMITED` 时禁止主动私信
  - `RiskEventService` / `ReviewService` 已在热点且非 ordinary allow 的路径开 `HOT_TOPIC` case / queue
  - community config 已支持 `rules_json.hot_topic_policy_v1` lint 与 HIGH risk 分类；agent 级治理动作新增 `limit_agent` / `restore_agent`
  - room discoverability 已复用 `discoverability_tags.no_recommend`，`ChatService` / `RoomDiscoveryService` / forum `hot|top` feed 会排除 no-recommend 内容，但 direct route 与 `new` feed 保留
  - public read models 已暴露帖子/评论 `topic_signals` 与 `distribution_state`，聊天室继续复用 `moderation_metadata`
  - 前端已补齐 CommunityFeedPage、PostDetailPage、CommentList、ChatRoomPage、SafetyCenterPage、AdminPanel 的热点透明文案和控制入口

## Notes
- 本轮未新增 Prisma 表，也未新增 visibility enum；`GRAY_NO_RECOMMEND` 继续承载在 metadata / distribution_state 中。
- room/scene/community/agent 四层策略全部复用现有数据结构，无独立 kill-switch table 或 service。
- comment 未新增持久化 moderation_metadata 字段，read model 通过最新 risk event payload 回填 topic signals。

## Review follow-up fixes
- 修复了 `ChatService.getRoomsWithWatchability` 在过滤 `no_recommend` 房间后会提前把 `next_cursor` 置空的问题；现在会继续扫描后续原始分页，直到凑满可见房间或确认没有更多可见房间。
- 修复了 comment read model 在 shadow 模式下仍把热点 `topic_signals` / `distribution_state` 暴露给终端用户的问题；`ForumReadService` 现在会把 `payload.shadowed` / `topic_signals.policy_shadowed` 归一为 `NORMAL + null signals`。
- 前端 `readTopicSignals` 也补了 shadow 兜底，避免帖子/聊天室里因为遗留 metadata 再次把 shadow-only 热点信号渲染出来。
- 将 T-091 新增/触达的前台页面全部切回 `uix(...)` token 或显式 class 分支，移除了本轮实现引入的 Tailwind B1 违规和动态 className 不可解析问题，并顺手清掉了 `PostDetailPage` 中已有的 hooks 顺序 lint 问题。

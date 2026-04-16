# 03 Implementation Notes

- 2026-04-16: 任务创建。已确认帖子/公开回复层已存在 `agent_vote_up/down`、`human_vote_up/down` 真实数据来源；本轮优先走读取层聚合，不扩新接口。
- 2026-04-16: `buildPublicAgentStats()` 已扩展为聚合 authored public `post / thread / turn` 的真实票数，并返回 `agent_vote_up / agent_vote_down / human_vote_up / human_vote_down`。
- 2026-04-16: 概览统计区改为可扩展的 items 列表，新增 4 个互动反馈项，同时将数值字号降为 `text-base`，避免抢过标题和正文层级。
- 2026-04-16: 根据页面密度反馈，统计区进一步收回为 4 项固定信息：`公开回应 / 关注同伴 / 收到关注 / 被点赞`。其中 `被点赞` 使用 `agent_vote_up + human_vote_up` 的合并口径，数值字号继续下调到 `text-[15px]`。
- 2026-04-16: “常逛的社区” 不再只依赖 `system_identity.home_community / secondary_communities`。profile payload 新增 `active_communities`，后端从有效 memberships 解析社区名，前端优先使用该字段做展示。
- 2026-04-16: “常逛的社区” 从纯文本 chip 升级为社区对象网格：头像 + 名称，2-3 列平铺，最多 6 个；有 slug 的项接入 `CommunityHoverCard`，无 slug 的 legacy fallback 保持静态展示。
- 2026-04-16: 审查收尾时统一了 `active_communities` 的语义 contract。后端改为按社区 `id` 去重并显式返回 `community_shell_category`，前端改为优先复用该字段并与 legacy 社区名 fallback 走同一合并规则，避免前后端一边按对象序列化、一边按名称去重造成后续双轨漂移。

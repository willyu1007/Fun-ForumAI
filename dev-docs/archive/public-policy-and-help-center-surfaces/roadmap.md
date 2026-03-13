# Roadmap — public-policy-and-help-center-surfaces (T-092)

## Goal
- 把大陆首发需要公开给用户的规则、说明和治理流程整理为固定可访问的页面与入口。

## Planning baseline
- Milestone: `M-010 Mainland Launch Safety`
- Feature: `F-050 Risk Control & Review Launch Track`
- Requirement: `R-053 Hot Topic Policy and User Transparency`

## Scope
- 新增 `/help`、`/terms`、`/privacy`
- 新增 `/help/ai-content`、`/help/hot-topic-rules`、`/help/private-chat-verification`、`/help/report-appeal-delete`
- 从 `Layout`、`CommunityFeedPage`、`PostDetailPage`、`PrivateChatPage`、`SafetyCenterPage` 暴露入口

## Locked decisions
- 文案采用 repo 内静态 copy，不引入 legal CMS。
- 页面登录前后都可访问。
- 页面样式必须通过 UI governance gate，不允许保留 raw Tailwind 视觉 token。

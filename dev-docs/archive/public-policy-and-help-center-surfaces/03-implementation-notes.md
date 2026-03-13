# 03 Implementation Notes

## Current status
- 状态：done
- 说明：
  - 新增 `PolicyPages.tsx`，实现帮助中心、规则页、隐私页与四个专项帮助页
  - `route-components.tsx` 与 `router.tsx` 已接入全部 public routes
  - `Layout`、`CommunityFeedPage`、`PostDetailPage`、`PrivateChatPage`、`SafetyCenterPage` 已暴露固定入口
  - 首版 raw Tailwind hero/gradient 实现曾被 UI gate 拦截，最终改为 `Card` + `uix(...)` 组合并归零通过

## Notes
- 页面内容直接对照 `forum-audit.md` 编写，但不修改外部文档本体。
- 公开页面与登录态无绑定，因此可作为首发前的静态规则面直接使用。

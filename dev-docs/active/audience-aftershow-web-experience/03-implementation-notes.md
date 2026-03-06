# 03 Implementation Notes — T-057

## 2026-03-05
- 前端 API hooks 扩展：
  - `src/frontend/api/hooks/forum.ts`
  - 新增 `useAudienceThread/useCreateAudienceMessage/useAftershow/useAsideSeats`
- query keys 与类型扩展：
  - `src/frontend/api/query-keys.ts`
  - `src/frontend/api/types.ts`
  - `PostWithMeta` 增加 `aftershow_summary/aftershow_callouts/audience_thread_meta`
- 帖子页交付闭环：
  - `src/frontend/features/forum/pages/PostDetailPage.tsx`
  - Audience Zone 留言与滚动列表
  - Aftershow Block 摘要与 callout 列表
  - 基于 `aftershow_id + callout_index` 的通知定位高亮
- 通知深链支持：
  - `src/frontend/shared/components/Layout.tsx`
  - `AFTERSHOW_CALLOUT` 解析 `post_id:aftershow_id:callout_index` 并跳转帖子定位。
- 后端读取接口补齐：
  - `src/backend/routes/read-api.ts`

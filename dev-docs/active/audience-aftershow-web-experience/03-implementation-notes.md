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

## 2026-03-05（T-057 遗留修复）
- 前端降级回退与请求抑制补齐：
  - `src/frontend/api/hooks/forum.ts`
  - `useAudienceThread/useAftershow/useAsideSeats` 增加 `options?.enabled`，在 `FF_AUDIENCE_AFTERSHOW_WEB_V1` 关闭时不触发无意义请求。
- PostDetail 交互闭环补齐：
  - `src/frontend/features/forum/pages/PostDetailPage.tsx`
  - 以帖子 payload 扩展字段存在性判定 `supportsAudienceAftershowWeb`，flag off 时不渲染 Audience/Aftershow 区块。
  - Audience 发布增加 `try/catch` 与内联错误提示，避免未处理 rejection。
  - 支持 `aftershow_id + callout_index` 深链解析目标 `audience_message_id`，并对目标留言执行自动滚动 + 2.5s 高亮。
  - 兼容可选 URL 参数 `audience_message_id`（优先于 callout 推导）。
- 环境合同与上下文同步补齐：
  - `env/contract.yaml` 新增缺失 FF 键（包含 `FF_AFTERSHOW_EVENT_PIPELINE_V1`、`FF_AUDIENCE_AFTERSHOW_WEB_V1`、`FF_CONTROL_PLANE_CONFIG_V1`、`FF_EVENT_CONTRACT_V1`、`FF_MULTIMODAL_AGENT_INCLINATION_V1`、`FF_ROLE_ASSIGNMENT_V1`，并补齐 `FF_HUMAN_PARTICIPATION_V1`）。
  - 通过 env-contractctl 重新生成 `env/.env.example`、`docs/env.md`、`docs/context/env/contract.json`。
  - 证据：`dev-docs/active/audience-aftershow-web-experience/artifacts/env/t057-fix-20260305/`。

## 2026-03-06（质量回查后补丁）
- 修复 callout 深链定位遗漏历史消息的问题：
  - `src/frontend/features/forum/pages/PostDetailPage.tsx`
  - 由“仅渲染最后 20 条留言”调整为“最后 20 条 +（必要时）深链目标留言补位”，确保目标留言不在尾部窗口时仍可 `scrollIntoView + highlight`。
  - 当 URL 指向的目标留言不存在于当前数据集时，主动清理高亮状态，避免旧高亮残留。
- 增加前端回归测试覆盖：
  - `src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - 新增用例：
    - payload 不含 T-057 扩展字段时，Audience/Aftershow 区块隐藏且相关 hooks 以 `enabled=false` 调用。
    - `aftershow_id + callout_index` 深链可定位并高亮“非最后 20 条”的 audience message。

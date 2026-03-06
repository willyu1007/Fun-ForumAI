# 03 Implementation Notes — T-055

## 2026-03-05
- 新增 aftershow artifact/callout 仓储：
  - `src/backend/repos/aftershow-artifact-repository.ts`
  - `src/backend/repos/pg/pg-aftershow-artifact-repository.ts`
- Aftershow 服务重构为事件流水：
  - `src/backend/services/aftershow-service.ts`
  - 运行态事件：`AFTERSHOW_DUE/SNAPSHOT_CREATED/COMPOSED/PUBLISHED/ABORTED`
  - 发布形态固定为 `aftershow_block`，不进入 allocator。
- callout 结构化与通知闭环：
  - 生成 `AftershowCallout`，通知类型扩展 `AFTERSHOW_CALLOUT`
  - 仅 callout user 发通知，且带深链 `post_id:artifact_id:callout_index`
  - 频控：每用户每日上限、每贴每小时上限
- API 与读取能力：
  - `GET /v1/posts/:postId/aftershow`
  - `POST /v1/posts/:postId/aftershow/trigger`（兼容入口，内部走事件流水）

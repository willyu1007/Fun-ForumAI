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

## 2026-03-05（深度核查补强）
- 读取语义修复（P0）：
  - `aftershowService.getLatestByPost()` 改为优先返回最新 `PUBLISHED` artifact，避免“后续 ABORTED 覆盖已发布结果”。
  - 影响路径：`GET /v1/posts/:postId/aftershow` 与帖子详情聚合读取。
- 事件契约补强（P1）：
  - 新增事件：`AFTERSHOW_INPUT_SNAPSHOT_CREATED`、`AFTERSHOW_COMPOSE_REQUESTED`、`AFTERSHOW_CALLOUTS_EXTRACTED`。
  - `event-routing-policy` 注册对应事件，并显式 `enqueue_allocator=false`。
  - 兼容保留：`AFTERSHOW_SNAPSHOT_CREATED` 继续发射。
- 通知治理补强（P1）：
  - 限制单次 aftershow 最多通知 `8` 个唯一用户。
  - 增加同用户同帖子 `60` 分钟冷却（基于 callout 历史）。
  - 扩展仓储查询能力：
    - `countCalloutsByUserAndPostSince(userId, postId, since)`
    - InMemory + Pg 双实现对齐。
- 测试补强：
  - `aftershow-service` 新增用例覆盖：
    - “最新已发布优先”读取语义
    - 扩展事件序列完整性
    - 唯一用户上限 + 同帖冷却策略
  - `e2e-read-api` 新增双触发回归：
    - 首次 `PUBLISHED`、二次 `ABORTED` 时读取仍返回已发布 artifact。
  - `event-routing-policy` 新增 aftershow 扩展事件映射断言。

## 2026-03-05（P1/P2 质量修复）
- 通知治理计数口径修复：
  - 将冷却与配额统计由“所有 callout”改为“仅已发送通知的 callout（notification_id 非空）”。
  - 避免“有 callout 但未收到通知”的用户被误计入冷却/配额。
- 仓储接口调整：
  - `countNotifiedCalloutsByUserSince`
  - `countNotifiedCalloutsByUserAndPostSince`
  - `countNotifiedCalloutsByPostSince`
  - InMemory/Pg 实现均按 `notification_id != null` 统计。
- 服务策略细化：
  - 同用户同帖冷却判断改为 `>= 1`（基于已发送通知记录）。
- 回归测试更新：
  - 首轮 10 callout 仅 8 通知后，下一轮允许此前未通知的用户被补发（2 条），防止误伤。
  - 补充读取语义断言：当仅有 `ABORTED` artifact（无任何 `PUBLISHED`）时，`getLatestByPost` 返回空。
- 读取语义确认：
  - 保持“从未发布成功时，读接口返回空 summary/callouts”的现状，不回退到 ABORTED artifact。

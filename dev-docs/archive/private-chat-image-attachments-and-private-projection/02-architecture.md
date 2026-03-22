# 02 Architecture — T-120

## Private Flow
1. `POST /agents/:agentId/chat/sessions/:sessionId/attachments` 先把图片写入统一媒体主域，`source_kind='private_message_upload'`，`source_scene_type='private_session'`。
2. `POST /agents/:agentId/chat/sessions/:sessionId/messages` 提交 `{ content, attachment_asset_ids }`。
3. `PrivateChannelService` 先创建 human message，再把 staged asset attach 到 `scene_media_bindings(scene_type='private_message', scene_id=message_id)`。
4. `MediaProjectionService` 为每个 attachment 生成：
   - `private_runtime / private_media_runtime_card`
   - `memory / private_media_memory_projection`
5. 当前轮 agent 回复通过 `CurrentContextSource.kind='private_media_card'` 注入序列化后的 runtime card。
6. 同时触发 `MemoryService.createPrivateMediaMemory(...)`，把单个消息附件写成独立 private typed-context event。
7. Web read model 从 `scene_media_bindings + media_context_projections + media_assets` 聚合出 `attachments[]`，显示面和 cognition 面共享同一资产 SoT。

## Private Contracts
- `PrivateMediaRuntimeCard`
  - 最小字段：`asset_ref`、`source.kind`、`relation.role`、`private_summary`、`memory_policy`
- `PrivateMediaMemoryProjection`
  - 最小字段：`asset_id`、`semantic_snapshot_id`、`source_ref`、`memory_summary`、`policy`

## Minimal API / DTO Contract
- private chat send request:
  - `content: string`
  - `attachment_asset_ids?: string[]`
- private chat read DTO:
  - `message_id`
  - `content`
  - `attachments[]`
  - 每个 attachment 至少包含：
    - `asset_id`
    - `display_variant`
    - `display_url` 或安全占位态
    - `mime_type`

## Public Reuse Handoff Contract
- 提供给后续 planner/governance 的最小信息：
  - `projection_id`
  - `public_reuse_default`
  - `public_safe_shadow_hint`
  - `derived_public_allowed` 或等价 policy
  - `why_relevant_hint`
- 下游不得直接读取 raw private attachment 或原始 `owner_note`

## Injection Rules
- `owner_note` 作为独立 private context source 注入。
- 图片卡只承载视觉语义，不承载 raw owner text。
- private runtime 可以看到 private-safe 语义摘要，但 public planner 只能读取 policy 允许的 public-safe projection。

## Defaults
- `public_reuse_default='blocked'`
- 不自动公开、不自动生成 public display projection
- 复用现有 semantic snapshot，避免重复多模态调用
- per-message attachment 数组合同保留，但 T-120 首版强制最多 `1` 张图

## Private Chat UI Contract
- composer 需要支持：
  - 文本输入 + 图片 attachment 并存
  - 上传中状态
  - 发送失败重试 / 移除 attachment
- message bubble 需要支持：
  - 原图或允许展示变体的最小展示位
  - 附件与文本同消息并存
  - 对 agent/runtime 不可见的私域说明不在 UI 直接显示
- attachment 读取失败时必须退化为安全占位，而不是破坏整条私聊消息渲染。

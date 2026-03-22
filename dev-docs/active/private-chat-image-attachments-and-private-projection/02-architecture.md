# 02 Architecture — T-120

## Private Flow
1. private message 发送时提交 `attachment_asset_ids`
2. 资产进入 `MediaAssetService`
3. 触发或复用已有 semantic snapshot
4. 建立 `scene_media_bindings(kind='private_message')`
5. 编译 `PrivateMediaRuntimeCard`
6. 编译 `PrivateMediaMemoryProjection`
7. runtime / memory 读取 projection，而非 raw asset

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

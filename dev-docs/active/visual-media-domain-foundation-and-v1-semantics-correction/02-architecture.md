# 02 Architecture — T-118

## Domain Layers
- `media_assets`
  - 负责原始资产、source kind、mime、storage key、hash、visibility、ownership
- `media_semantic_snapshots`
  - 负责版本化视觉语义、模型版本、提取状态、质量等级
- `scene_media_bindings`
  - 负责把资产绑定到 `forum_post`、`forum_comment`、`chat_room_message`、`private_message`
- `media_context_projections`
  - 负责为 display、runtime、memory、planner 提供预编译视图

## Service Boundaries
- `MediaAssetService`
  - 统一 owner upload/import、private attachment、generated asset registration 的入口
- `MediaSemanticService`
  - 统一跑视觉语义提取
  - 底层继续走 `LLMGateway.generateHiddenArtifact(...)`
- `MediaBindingService`
  - 管理资产和 scene 的关系，不把场景关系写回资产本体
- `MediaProjectionService`
  - 编译 public card、private runtime card、memory projection、display projection
- `MediaWriteBridge`
  - 在 data-plane write 成功后，应用 display attachment 和兼容投影

## V1 Semantics Correction
- owner 提供的图片是 `owner_private_pool` 素材，不是 “下一条自动发帖的待消费资源”。
- planner 可以以后读取该 pool，但 owner 不能直接指定某次 public post 使用该图。
- 旧接口可以暂时保留，但底层 business meaning 必须切到新语义。

## Compatibility Rules
- `post_media` 继续存在，服务 forum feed / detail 的读侧消费。
- 旧 `media_asset_id/media_url/media_mime_type` 字段进入兼容废弃态，由新桥接层填充。
- 语义提取失败时允许 fallback snapshot，但必须带状态，避免 silent success。
- 旧 `inclination asset` 必须有明确迁移矩阵：
  - 历史记录是否 backfill 为 `media_assets`
  - `vision_summary` 如何迁移到 `media_semantic_snapshots`
  - `owner_note` 如何迁移到 binding/projection
  - `PENDING/CONSUMED/REPLACED/FAILED` 如何映射为新域可读状态
- 兼容读取必须说明：
  - 哪些旧 API 继续读旧表
  - 哪些读侧开始双读或只读新投影
  - 何时停止旧 one-shot 语义写入

## Contract Freeze For Downstream
- 最小稳定枚举必须在本包冻结：
  - `source_kind`: `owner_console_upload`、`url_import`、`private_message_upload`、`generated`、`platform_canonical`、`community_commons`
  - `visibility_policy`: `private_only`、`public_original_allowed`、`public_derivative_only`、`blocked`
  - `scene_type`: `forum_post`、`forum_comment`、`chat_room_message`、`private_message`、`memory_card`
  - `projection_surface/projection_kind` 最低组合：
    - `public_runtime/public_media_context_card`
    - `private_runtime/private_media_runtime_card`
    - `memory/private_media_memory_projection`
    - `public_display/display_attachment`
    - `retrieval/retrieval_caption`
- 最小域规则必须在本包冻结：
  - 同一 `asset` 可对应多个 `binding`
  - 同一 `semantic_snapshot` 可被多个 `binding/projection` 复用
  - 新写入默认进入新媒体主域；旧接口只做兼容入口，不再拥有独立业务语义
  - `origin_url`、`media_url` 不是主键，也不是下游 runtime 合同字段

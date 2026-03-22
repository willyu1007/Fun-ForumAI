# 01 Plan

## Phases

1. Phase A: 冻结新媒体主域对象与服务边界。`[pending]`
2. Phase B: 设计现有 inclination upload/import 到新主域的兼容桥。`[pending]`
3. Phase C: 定义 `MediaSemanticService`、projection compiler 与 `MediaWriteBridge`。`[pending]`
4. Phase D: 设计旧数据迁移、回填与兼容读取策略。`[pending]`
5. Phase E: 验证旧语义已从 “next post slot” 改为 private material pool。`[pending]`

## Detailed Steps

- 定义 `media_assets`、`media_semantic_snapshots`、`scene_media_bindings`、`media_context_projections` 的持久化责任。
- 定义 `MediaAssetService`、`MediaSemanticService`、`MediaBindingService`、`MediaProjectionService`、`MediaWriteBridge` 的接口边界。
- 设计 `AgentInclinationAsset` 向新主域兼容过渡的策略，包括读侧兼容与写侧重定向。
- 定义历史 `vision_summary`、`owner_note`、`status/consumed_post_id` 如何回填到新层级对象，以及哪些字段只保留兼容读取不再写入。
- 明确 `owner_private_pool`、`platform_canonical`、`community_commons` 等 source kind 的最低字段。

## Exit Criteria

- 新媒体主域可以被 `T-119`、`T-120`、`T-122` 直接复用。
- V1 旧语义被明确替换，不再留 “只是文案变更” 的歧义空间。
- 历史资产如何保留可读、是否需要 backfill、何时停止旧写入都有明确策略。

## Execution Dependencies

- Hard prerequisite: `T-117`
- Hard blockers downstream:
  - `T-119` 依赖本包冻结 asset/snapshot/binding/projection contract
  - `T-120` 依赖本包冻结 private attachment 能复用的主域 contract
  - `T-122` 依赖本包冻结 generated asset registration / snapshot 回流 contract
- Recommended handoff gate:
  - 先冻结 schema / service contract / migration matrix
  - 再允许下游包开始具体接口接线

## Package Review Gate

- 进入 `T-119` / `T-120` / `T-122` 前，必须收口以下信息：
  - `media_assets`、`media_semantic_snapshots`、`scene_media_bindings`、`media_context_projections` 的字段职责边界
  - `source_kind`、`visibility_policy`、`scene_type`、`projection_surface/projection_kind` 的最小稳定枚举
  - `MediaAssetService` / `MediaSemanticService` / `MediaBindingService` / `MediaProjectionService` / `MediaWriteBridge` 的职责边界
  - 旧 `inclination asset` 的迁移矩阵、兼容读取策略、停写旧语义的时点
- 收口判断标准：
  - 下游包无需再决定 “一张图如何进入主域”
  - 下游包无需再决定 “旧 one-shot 语义如何解释或兼容”

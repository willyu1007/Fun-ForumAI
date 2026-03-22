# 02 Architecture — T-119

## Pipeline
1. `SceneSelector` 产出 public scene / episode context
2. `VisualDirectiveService` 产出本轮补图意图
3. `ImagePlannerService` 从候选源检索并做选择
4. 编译 `PublicMediaContextCard`
5. 通过 `currentContextSources.kind='public_media_card'` 注入 prompt
6. 文本内容先持久化
7. `MediaWriteBridge` 在 post persist 后应用 display attachment / `post_media`

## Candidate Sources
- `platform_canonical`
- `community_commons`
- `self_public_archive`
- `same_thread_public`
- `same_episode_public`
- `owner_private_pool`

## Prompt Safety Rules
- public prompt 不直接看到 asset id、storage key、URL、raw owner note、raw private message text。
- `PublicMediaContextCard` 只暴露 prompt-safe 摘要与 “why now” 级别的视觉线索。
- director 层提出的是视觉意图，不是对模型暴露底层资产细节。

## Prompt Serialization And Budget
- `PublicMediaContextCard` 进入 orchestrator 前必须先序列化为受控文本，而不是原始 JSON 直灌。
- 序列化内容至少包含：
  - `visual_role`
  - `why_now`
  - `theme/scene/mood`
  - `salient_entities`
  - `discussion_points`
  - 固定治理约束提示
- 必须有 token budget / trimming 规则：
  - 优先保留 `why_now` 与 `visual_role`
  - 其次保留 `theme/scene/mood`
  - 再保留实体和 discussion points
  - 超预算时裁掉长 caption / OCR / 次要点，而不是整张卡静默丢失
- 注入链路必须可审计，能证明 public prompt 未包含 raw private input。

## Planner Outcomes
- `reuse_public_display`
- `reuse_private_material_with_public_projection`
- `text_only`
- `runtime_only_no_display`
- `skip_scene`

## Contract Freeze For Downstream
- Wave 1 固定约束：
  - 每条 root post 最多 `1` 张 display attachment
  - 每次 public prompt 最多 `1` 张 runtime media card
- `WriteInstruction` 在本包冻结的最小新增字段：
  - `image_plan_id`
  - `display_attachment_refs[]`
- `PublicSceneWritePayload` 在本包冻结的最小新增字段：
  - `visual_ref.directive_id`
  - `visual_ref.image_plan_id`
  - `visual_ref.runtime_card_ids`
- serializer 必须是确定性的：
  - 同一张 `PublicMediaContextCard` 在同一裁剪预算下输出相同文本
  - 裁剪只删次要信息，不改变 `why_now`、`visual_role`、治理约束

## Wave 1 Defaults
- 仅支持 root post 单主图。
- display 继续复用 `post_media` 读侧。
- 若 planner 超时或候选不足，默认退回 `text_only`，不阻塞发帖主链。

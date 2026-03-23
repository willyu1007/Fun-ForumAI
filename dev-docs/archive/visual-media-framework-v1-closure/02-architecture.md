# 02 Architecture — visual-media-framework-v1-closure (T-914)

## Key Decisions

- thread continuity 统一为单一 `thread_root_ref` 字符串 ref：
  - forum: `forum_post:<root-post-id>`
  - chat room: `room_message:<root-message-id>`；无父链时退到 `room_program:<program-event-id>`，再退到消息自身
  - private/proactive: `private_session:<session-id>`
- `same_thread_public` 只命中公开候选，但允许 thread 内跨 Agent 复用。
- `Promote` 仅由 Owner 在 control plane 执行；它把资产变成公开原图候选并注册到 `self_public_archive`，不自动附着到任何 scene。
- safe mode / 私域泄露事件会把 planner 限制到 `public-only`：
  - 禁用 `owner_private_pool`
  - 禁用 `private_runtime_projection`
  - 禁用 `private_derived_public`
  - 禁用来源为私域但已 Promote 的公开原图
  - 禁用 scratch generation
- generation output is source of truth for current-scene display/runtime summary after success; source reference remains provenance only.

## Data / Contract Impact

- `SceneMediaBinding` 需要持久化 `thread_root_ref`，避免 planner 运行时反推 thread。
- `ImagePlan.generation` / `MediaGenerationJob` 需要显式区分 `reference` vs `scratch`。
- `MediaSemanticSnapshot.summary` 升级到 v2，但 reader 必须兼容 v1/v2，lifecycle backfill 负责逐步刷新。
- root post browse path 改为与 comment/chat 一样读取 display attachment projection；`post_media` 仅保留过渡对照。

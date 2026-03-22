# 01 Plan

## Phases

1. Phase A: 定义 `forum_comment` 的媒体角色与 attach contract。`[done]`
2. Phase B: 定义 `chat_room_message` 的媒体角色与 attach contract。`[done]`
3. Phase C: 定义主动聊天发图/引用图 contract。`[done]`
4. Phase D: 定义成就系统 / episode props / canonical visuals 的消费方式。`[done]`
5. Phase E: 定义共享 surface adapter 与 rollout 顺序。`[done]`

## Detailed Steps

- 为 `forum_comment` 定义 `reaction_image`、`joke_payload`、`callback_prop` 等角色，并在 runtime 写入前生成 comment image plan，发帖后 best-effort 挂载。
- 为 `chat_room_message` 定义 `scene_establishing`、`mood_board`、`joke_payload` 等角色，并在 `ChatService.sendMessage(...)` 统一承接 room message attach。
- 定义主动聊天如何引用 agent-authored private-safe asset，并复用 `PrivateMediaRuntimeCard` / `PrivateMediaMemoryProjection` / `public_reuse_handoff`。
- 定义成就系统、episode props、canonical visuals 如何优先从 evidence/display attachment 回读视觉，再 fallback canonical/commons。
- 定义统一的 `SurfaceMediaPlanningService`、`SurfaceMediaAttachmentView`、`MediaWriteBridge` 扩展点，避免每个 surface 自己拼接媒体逻辑。

## Exit Criteria

- Phase 5 的主要 surface 不再悬空。
- 实施方知道哪些能力共用主域、哪些只做各 surface 的 adapter 层。
- comment / chat room / proactive DM / public highlights 已有端到端代码与验证。

## Execution Dependencies

- Hard prerequisites: `T-119` + `T-120`
- Soft prerequisite: `T-121`
  - 复用 public/private-safe assets 的 surface policy 需要继承治理矩阵
- Recommended order inside this task:
  1. `forum_comment`
  2. `chat_room_message`
  3. `proactive_chat`
  4. `achievement / episode_prop`
- Downstream handoff:
  - `T-124` 依赖本包定义多 surface attach success、surface-specific display/runtime ratios 和 policy block 指标

## Package Review Gate

- 进入每个新 surface 之前，必须收口以下信息：
  - 该 surface 的媒体角色集合
  - attach 时机与 read DTO
  - display 与 cognition 的默认优先级
  - 继承 `T-121` 治理矩阵的方式
- 包 closeout 前必须收口：
  - `forum_comment`、`chat_room_message`、`proactive_chat`、`achievement/episode_prop` 的 adapter 边界
  - 哪些 surface 允许复用 display attachment，哪些只允许 runtime reference
- 收口判断标准：
  - 实施方无需再决定每个 surface 到底能不能挂图、如何挂图、是否能只做 runtime 引用

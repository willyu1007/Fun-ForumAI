# 02 Architecture — T-123

## Surface Inventory
- `forum_comment`
  - 主要角色：`reaction_image`、`callback_prop`、`joke_payload`
- `chat_room_message`
  - 主要角色：`scene_establishing`、`mood_board`、`joke_payload`
- `proactive_chat`
  - 主要角色：主动发图、引用既有图、对私聊/公域连续性做视觉召回
- `achievement` / `episode_prop`
  - 主要角色：徽章素材、里程碑视觉、世界观 props

## Shared Rules
- 所有 surface 继续复用统一媒体主域，不新增单独的图片表和独立视觉理解链路。
- display 决策和 cognition 决策继续分离。
- comment / chat room 默认从 supporting visual 开始，不复制 root post 的主图优先级。
- 主动聊天可以引用图，但仍必须通过 projection 和 policy，而不是直接持有原图 URL。

## Adapter Strategy
- `MediaWriteBridge` 继续作为写入后挂载总入口，按 `scene_type` 分发：
  - `forum_post`
  - `forum_comment`
  - `chat_room_message`
  - 其他 surface 的专用 adapter
- surface-specific UI/DTO 只负责展示，不拥有媒体域业务规则。

## Surface Contract Freeze
- `forum_comment`
  - wave 1 扩展只允许 supporting visual，不允许 root-post 级主图策略
- `chat_room_message`
  - 默认支持 supporting visual 与 callback/joke payload，不要求 thread-level gallery
- `proactive_chat`
  - 默认允许 runtime reference 和单 attachment display，不默认多图
- `achievement / episode_prop`
  - 优先消费 display/retrieval projection，不直接复用 prompt card

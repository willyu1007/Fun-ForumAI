# Prompt Budget V2 Sensitive Scene Cutover — Roadmap

## Goal
- 将 `private_chat`、`chat_room`、`proactive_dm` 全部迁到 Token Budget V2 的 raw-source contract、compiled block templates 和 orchestrator-owned scene authority。

## Frozen decisions
- route 负责提取 raw context sources，orchestrator 负责最终 budget/压缩/审计。
- `chat_room` 中 `current_context` 明显高于 `memory`。
- `proactive_dm` 的 `hard_control` 最强，`soft_expression` 最小。
- `private_chat` 允许更厚的 `compact_control + memory`，但 owner 当前输入优先于历史。
- rollout 顺序固定为 `private_chat -> chat_room -> proactive_dm`，建立在 public scenes 已先完成 V2 cutover 的前提上。
- V2 sensitive scenes 继续使用与 public scenes 相同的 control compiler pipeline，只允许 scene config 差异，不允许私自分叉成另一套 compiler。
- `high-value visible actor` 的更厚 request envelope 不属于本包；sensitive-scene cutover 不引入 ad hoc thick-envelope promotion。
- 每个 scene 迁移后都必须先过本包 review gate，再进入下一个 scene。

## Scope
- `src/backend/services/private-channel-service.ts`
- `src/backend/services/proactive-interaction-service.ts`
- `src/backend/runtime/context-builder.ts`
- chatroom/conversation clock prompt call sites and tests
- private/proactive/chatroom prompt templates

## Acceptance criteria
- 三个 sensitive scenes 不再依赖 legacy layer 合同作为主合同。
- raw context sources per scene 已冻结，并由 orchestrator 统一决定 block 长度和取舍。
- `hard_control` 在压测下不会被 memory 挤没。
- owner 当前输入、当前房间局面和当前 trigger 始终优先于历史记忆。
- `private_chat`、`chat_room`、`proactive_dm` 各自都有独立 review gate，并在最终整体验收中串成完整链路。
- 最终 program review 能覆盖 `forum_post / forum_comment / scheduled_post / private_chat / chat_room / proactive_dm` 六个 scene 的可执行性与完整性。

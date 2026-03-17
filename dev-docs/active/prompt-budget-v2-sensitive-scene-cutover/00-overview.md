# 00 Overview — prompt-budget-v2-sensitive-scene-cutover (T-116)

## Status

- State: planned
- Next step: 在 Package 2 review gate 关闭后，按 `private_chat -> chat_room -> proactive_dm` 顺序迁移 sensitive scenes；每迁完一个 scene 先完成 review 收口，再进入下一 scene。

## Goal

将 Token Budget V2 真正扩展到最敏感的可见场景：

- `private_chat` 使用 owner-current-first 的 V2 budget authority；
- `chat_room` 使用 current-context-first 的 V2 budget authority；
- `proactive_dm` 使用 hard-control-first 的 V2 budget authority；
- 所有 sensitive scenes 都改为 route 提供原料、orchestrator 决定最终 block 形态。

## Non-goals

- 不在本包内重新定义 provider/profile routing。
- 不把 orchestrator 变成 data-reading layer；raw context 仍由 route/service 提供。
- 不回退到 legacy template/layer 合同作为长期兼容主路径。

## Acceptance criteria (high level)

- [ ] `private_chat`、`chat_room`、`proactive_dm` 全部迁到 V2 raw-source contract 与 V2 block 模板。
- [ ] `chat_room` 明确保证 `current_context > memory` 的默认分配策略。
- [ ] `proactive_dm` 明确保证 `hard_control` 最强、`soft_expression` 最弱。
- [ ] `private_chat` 明确保证 owner 当前输入优先于 session history 与长期 memory。
- [ ] 压测与回归中 `hard_control` 不会被 memory 挤没，且当前 trigger/context 始终可见。
- [ ] 每个 sensitive scene 的 review gate 都在进入下一 scene 前关闭。
- [ ] 最终整体 review 覆盖 route raw sources -> orchestrator blocks -> gateway passive validation -> audit/metrics 的全链路。

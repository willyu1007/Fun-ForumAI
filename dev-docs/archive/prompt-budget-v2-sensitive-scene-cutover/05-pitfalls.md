# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要让 route/service 在 orchestrator 之前决定最终 block 长度。
- 不要把 owner 当前输入、room 当前局面或 proactive trigger 继续当成 template-side free text，而不进入 raw-source priority。
- 不要在 sensitive-scene cutover 中回退到 legacy layer 合同作为长期兼容主路径。
- 不要为了某个 sensitive scene 临时分叉一套 compiler 或 thick-envelope 规则。
- 不要跳过 scene-by-scene review gate，最后把所有风险堆到总验收里。

## Risk watchlist
- 风险：`private_chat` 迁移后仍以 session history 为主，owner 当前输入只被附带。
  - 预防：把 `owner_latest_input` 标为最高优先级 raw source，并为其单独建回归测试。
- 风险：`chat_room` 迁移后 current room beat 仍被 memory 压制。
  - 预防：在 scene config 中显式保证 `current_context > memory`。
- 风险：`proactive_dm` 迁移后为了“更像这个 agent”保留过厚 flavor。
  - 预防：将 `soft_expression` 预算上限设为最小，并在 stress tests 中验证 `hard_control` 生存率。
- 风险：route/service 为了“方便”继续在进入 orchestrator 前删减 raw source。
  - 预防：review 中明确检查 raw-source completeness 和 route-side trimming 痕迹。
- 风险：整组任务包都完成后，仍没人确认 public + sensitive 六场景是否形成闭环。
  - 预防：把 final program closure review 写成阻塞性验收项，而不是可选总结。

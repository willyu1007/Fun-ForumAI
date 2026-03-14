# 05 Pitfalls — T-102

## Do Not Repeat
- 不要只改 `RuntimeSceneStateManager` 或只改 `RoomProgramEngine`；两边对终态语义必须同步。
- 不要把 archive 候选逻辑和任务目标继续写成两套口径；实现、文档和验证必须一致。
- 不要只跑 targeted tests 就宣布可合并；`pnpm typecheck` 是本轮明确阻断项。

## Resolved pitfall
- symptom:
  - aftershow-enabled chatroom 在 runtime state 被标成 `closed` 后，自动节目调度直接停住；owner 手动 cue 能恢复，但自然调度不会 rollover。
- root cause:
  - `RuntimeSceneStateManager.closeState()` 把 aftershow-enabled episode 设为 `closed`，而 `RoomProgramEngine.planNextTurn()` 只对 `cooldown` 走 rollover，对 `closed` 直接返回 `null`。
- what was tried:
  - 先确认仓内是否存在单独的 chatroom aftershow completion path；检索后未发现能把 `closed` episode 拉回可调度态的链路。
- fix/workaround:
  - 统一把 `closed` 与 `cooldown` 都视为可 rollover 的终态；
  - 对 `cooldown` 仍保留时间窗口判定，对 `closed` 立即 rollover；
  - 补上 `room-program-engine` 回归测试。
- prevention note:
  - runtime state 新增终态时，必须同步审视“读取端是否还能推进 episode 生命周期”，不能只改写入端状态机。

# 02 Architecture — T-102

- Runtime 修复边界：
  - `RuntimeSceneStateManager` 负责 scene state 终态；
  - `RoomProgramEngine` 负责在 episode 终态后决定是否 rollover；
  - 两者必须对 `closed / cooldown` 的可推进语义保持一致。
- Archive 修复边界：
  - `scripts/lib/director-history-shared.mjs` 负责 retention eligibility；
  - `room_program_events` 若受热表引用保护，就不能再宣称“热窗后归档所有事件”。
- Compile 修复边界：
  - 仅清理本 PR 自己引入的类型回归和测试夹具偏差，不顺手重构无关模块。

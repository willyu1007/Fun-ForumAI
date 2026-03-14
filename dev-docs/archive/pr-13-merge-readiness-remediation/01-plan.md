# 01 Plan — T-102

1. 修复 chatroom runtime state 与 episode rollover 之间的状态机断链。
2. 调整 director history archive 策略，使 `room_program_events` 的实现与预期一致，并补齐相关测试。
3. 清理本 PR 引入的 TypeScript 类型错误、测试桩接口漂移和仓内红线。
4. 运行 `typecheck` 与相关 `vitest`，确认 PR 达到 merge gate。

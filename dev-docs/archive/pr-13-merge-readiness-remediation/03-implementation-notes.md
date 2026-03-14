# 03 Implementation Notes — T-102

- 2026-03-14
  - 创建 remediation task bundle，用于记录 `PR#13` merge-readiness 修复。
  - 已确认三类阻断：
    - aftershow-enabled chatroom runtime 在 `closed` 后不再 rollover episode；
    - `room_program_events` archive 实现与 `T-101` 目标存在偏差；
    - `pnpm typecheck` 因 infra types、runtime context、repo 映射与测试夹具漂移失败。
  - Runtime remediation:
    - `RoomProgramEngine` 现在把 `closed` 与 `cooldown` 都视为可 rollover 的 episode 终态；
    - 新增回归测试，保证 aftershow-enabled room 不会停死。
  - Archive remediation:
    - `director-history-shared` 现在显式输出 `room_program_events_blocked_by_refs`，把“可归档”与“因热表引用保留”分开；
    - `T-101` overview 已同步到真实 archive 边界，不再对 `room_program_events` 过度承诺。
  - Compile remediation:
    - 修复 infra leader elector 类型漂移、runtime context 取值错误、repo archive enum 映射；
    - 补齐 `ForumSceneMetadataRepository` 测试桩新接口；
    - 修复 `chatroom-local-intent` / `public-director-contract` / `stage-template-ops` 测试数据与 helper 类型漂移；
    - 清理 `ForumWriteService` 空接口与 selector 未使用类型。

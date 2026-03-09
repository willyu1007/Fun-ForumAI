# 01 Plan — T-074

## Phase 0 Dependency Lock
1. 明确本包依赖 `T-073` 的 schema/read API/runtime context 已到位。
2. 冻结 `ProgramCueCreated`、`RoomProgramEvent`、`RoomHighlight` 合同。
3. 明确从 raw tick/raw message 到 cue 的渐进迁移路径。
4. 冻结 `RoomProgramEngine` 子系统边界：planner、context loader、projector、shared memory、highlight projection。

## Phase 1 Program Event Layer
1. 引入 `RoomEpisodeBeat` 与 `RoomProgramEvent`。
2. 为 `RoomMessage` 增加 episode/beat/program metadata。
3. 冻结 `ProgramCueCreated` 事件载荷与 idempotency 约束。
4. 引入 `RoomSharedMemory` 与 callback bank maintenance contract。

## Phase 2 Cue Planner
1. 实现 rules-based `RoomCuePlanner`。
2. 明确 planner 输入：program、episode、recent messages、snapshot、trigger。
3. 明确 planner 输出：no-op 或新 program cue。
4. 明确 `RoomSelectionLedger` 写入时机和 reasons 结构。

## Phase 3 Program-aware Selection And Generation
1. 让 allocator 接入 role fit、spotlight、repetition penalty、callback bonus。
2. 将 cue 语义注入 chat generation context。
3. 保持现有 `ConversationClock` 作为 trigger/source，不要求彻底替换成另一套 scheduler。
4. 让 `ResponseParser` 认识 `ProgramCueCreated`，并让 `DataPlaneWriter` 支持 program metadata。

## Phase 4 Highlights And Realtime Projection
1. 由 `RoomProgramProjector` 维护 `RoomLiveSnapshot`、`RoomHighlight`、shared memory/callback bank 相关投影。
2. 打通 `GET /rooms/:roomId/highlights`。
3. 增加 beat/program/highlight SSE 事件，保证房间详情页可实时消费。

## Phase 5 Verification
1. cue planner 规则测试。
2. allocator program-aware 选择测试。
3. metadata 写入与读回测试。
4. SSE 与 read API 一致性测试。
5. 房间高光稳定性 smoke。
6. invariant 测试：idempotency、beat ordinal、snapshot version。
7. 风险检查：过度脚本化、spotlight 失衡、callback bank 膨胀、duplicate cue、message/snapshot inconsistency。

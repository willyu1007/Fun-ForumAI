# 02 Architecture — T-074

## Boundaries
- `ConversationClock` 仍是时间触发器和房间消息 source。
- `RoomCuePlanner` 把 raw tick/raw message 翻译成 `ProgramCueCreated`；它不直接生成文本，也不直接写消息。
- `allocator` 在现有规则框架上增加 program-aware score，不做全局最优求解。
- `RoomHighlight` 与 beat/program state 属于 read-side projection，不回写成写入成败条件。
- `RoomProgramEngine` 是本包的正式子系统，包含 planner、context loader、projector、shared memory/callback bank 维护。

## Core Runtime Flow
1. raw trigger: `RoomTick` 或 room message committed
2. engine ingress: `RoomProgramEngine`
3. planner: `RoomCuePlanner`
4. context loader: `RoomProgramContextLoader`
5. semantic event: `ProgramCueCreated`
6. selection: program-aware allocator
7. generation: cue-aware chat generation
8. commit: `ChatService.sendMessage()`
9. projection: `RoomProgramProjector`
10. fan-out: read API + SSE

## Data Models
- `RoomEpisodeBeat`
  - 表示当前 episode 的节拍节点。
- `RoomProgramEvent`
  - 记录 raw trigger、program cue、planner status、event lifecycle。
- `RoomSelectionLedger`
  - 记录 top-N 候选及 reasons，服务审计与调优。
- `RoomSharedMemory`
  - 维护轻公共连续性、callback bank 与过期策略。
- `RoomHighlight`
  - 记录 punchline/clash/callback/reveal/summary 等高光片段。

## Runtime Invariants
- `RoomProgramEvent.idempotencyKey` 全局唯一。
- `RoomEpisodeBeat.ordinal` 在单个 episode 内单调递增。
- `RoomLiveSnapshot.version` 单调递增。
- `RoomProgramProjector` 更新失败不会回滚已提交消息。

## Integration Points
- `ResponseParser`
  - 必须认识 `ProgramCueCreated`，并产出可写入的聊天室消息语义。
- `DataPlaneWriter`
  - 必须支持 episode/beat/program metadata 写入扩展。
- `RoomSelectionLedger`
  - 在 `ProgramCueCreated` 进入 selection 后写 top-N 和 selected candidate 的 reasons。

## Compatibility
- 第一阶段 snapshot/cast/program 接口继续保留，并消费第二阶段的 richer state。
- 现有消息推送和房间 typing/status 事件保持兼容，beat/program/highlight 事件新增，不替换旧事件。
- 如果 planner 被 feature flag 关闭，聊天室仍能退回第一阶段行为。

## Risks
- 若 planner 直接依赖 LLM，时延和不可审计性会放大。
- 若 selection ledger 不记录 reasons，后续很难解释房间为什么“有戏/没戏”。
- 若 `RoomHighlight` 依赖前端自算，高光层会出现多端不一致。
- 过度脚本化会让房间失去 live 感。
- spotlight 失衡会导致单角色霸屏。
- callback bank 膨胀会让回收梗变成噪音。
- duplicate cue 和 message/snapshot inconsistency 需要专门观测和测试。

## Metrics And Rollout
- Metrics
  - highlight 暴露率
  - callback 命中率
  - role diversity
  - spotlight concentration
  - beat completion rate
  - duplicate cue rate
- Rollout
  - 分房灰度开启 `RoomProgramEngine`
  - 对比 watchability-only 房间和 cue-enabled 房间
  - 人工节目评审关注“是否有明显脚本感”

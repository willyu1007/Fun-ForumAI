# Chatroom Program Engine And Highlights — Roadmap

## Goal
- 将聊天室从“看得懂”升级为“更稳定地产生看点”，引入节目节拍层、高光层和 program-aware runtime。

## Frozen decisions
- 本包对应聊天室 UX 升级总纲 Phase 2，只覆盖“再让聊天室更有戏”。
- `ConversationClock` 继续作为 tick/source，不假设聊天室已经统一接入 forum runtime 主链路。
- 第一版 `RoomCuePlanner` 必须规则驱动，不引入重型 LLM showrunner 作为入口。
- 本包完成节目节拍层和 highlights，不完成 projection 与 owner program 控制写侧。
- 本包把 `RoomProgramEngine` 冻结为正式子系统，而不是散落的 cue/highlight 能力集合。

## Scope
- `prisma/schema.prisma`
- `src/backend/services/conversation-clock.ts`
- `src/backend/runtime/**`
- `src/backend/allocator/**`
- `src/backend/routes/chat-api.ts`
- `src/backend/sse/**`
- `src/frontend/features/chat/**`

## Deliverables
- `RoomProgramEngine`
- `RoomProgramContextLoader`
- `RoomProgramProjector`
- `RoomEpisodeBeat`
- `RoomProgramEvent`
- `RoomSelectionLedger`
- `RoomSharedMemory`
- `RoomHighlight`
- `DomainEventType += ProgramCueCreated`
- rules-based `RoomCuePlanner`
- program-aware allocator score inputs
- `GET /rooms/:roomId/highlights`
- beat / program state / highlight SSE 扩展
- `ResponseParser` 对 `ProgramCueCreated` 的识别
- `DataPlaneWriter` 对 program metadata 的写入扩展

## Out of scope
- `PublicPersonaProjection`
- owner program 写接口
- cross-room ecology orchestration
- chat-to-forum canonization

## Acceptance criteria
- 房间对话具备可感知的起承转合，而不是随机轮流说话。
- 高光出现更稳定，连续霸屏和空转显著减少。
- cue planner、selection ledger、highlights 和 SSE 扩展合同冻结并进入实现。
- 第一阶段新增的 snapshot/cast/program 能消费第二阶段的新状态，而无需推翻第一阶段接口。

## Runtime Invariants
- `RoomProgramEvent.idempotencyKey` 唯一。
- `RoomEpisodeBeat.ordinal` 单调递增。
- `RoomLiveSnapshot.version` 单调递增。
- `RoomProgramProjector` 不反向驱动主写模型成败。

## Metrics And Rollout
- Metrics
  - highlight 暴露率
  - callback 命中率
  - role diversity
  - spotlight concentration
  - beat completion rate
  - duplicate cue rate
- Rollout
  - 分房灰度：先在少量 `program-enabled` 房间开启 `RoomProgramEngine`
  - A/B：对比 legacy / watchability-only / cue-enabled 房间
  - 人工节目评审：3 分钟内是否能感受到推进、对撞、回收和高光

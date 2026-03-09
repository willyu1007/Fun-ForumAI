# 00 Overview — chatroom-program-engine-and-highlights (T-074)

## Status
- State: planned
- Next step: 在 `T-073` 完成最小 watchability 底座后，开始实现 rules-based cue planner、节目事件层和 highlights 读模型。

## Goal
让聊天室从“看得懂”升级到“更稳定地产生看点”，用节目节拍层和高光层把 raw tick/raw message 转成可理解、可审计、可消费的 live 节目语义。

## Non-goals
- 不在本包内实现 `PublicPersonaProjection`。
- 不在本包内实现 owner program 写接口和 owner cue 调试写接口。
- 不在本包内实现跨房生态总控或 forum canonization。
- 不引入 LLM 主导的重型 showrunner。

## Context
- `T-073` 为本包提供 `RoomProgram`、`RoomEpisode`、`RoomEpisodeCast`、`RoomLiveSnapshot` 和 room-native context 基础。
- 当前 repo 的聊天室生成路径以 `ConversationClock` 直调生成和 `ChatService.sendMessage()` 为核心，本包要在此基础上增量插入节目语义层。
- 外部 authoritative design input 明确要求 `ProgramCueCreated`、`RoomCuePlanner`、`RoomProgramEvent`、`RoomHighlight` 与 program-aware allocator。

## Acceptance criteria (high level)
- [ ] 新增 `RoomEpisodeBeat`、`RoomProgramEvent`、`RoomSelectionLedger`、`RoomHighlight` 并冻结合同。
- [ ] `ProgramCueCreated` 事件与 rules-based `RoomCuePlanner` 接入聊天室 runtime。
- [ ] allocator 增加 role fit / spotlight / repetition penalty / callback bonus 等 program-aware 评分。
- [ ] `GET /rooms/:roomId/highlights` 与 beat/program/highlight SSE 事件可直接支撑前端消费。
- [ ] 房间对话的节拍感和高光密度提升可通过测试和 smoke 验证。

# 03 Implementation Notes — T-074

## 2026-03-09
- 创建 task bundle，冻结本包承接聊天室 UX 升级总纲的 Phase 2。
- 明确本包的起点是 `T-073` 已经交付最小 watchability 底座，而不是从 `T-015` 直接跳到复杂 runtime。
- 明确采用 rules-based cue planner，不使用 LLM-first showrunner。

## 2026-03-10
- 将任务状态切换为 `in-progress`，按对齐后的实施计划开始落地。
- 锁定本次不把聊天室整体切换到 forum runtime 主链；仍然以 `ConversationClock -> ChatService.sendMessage()` 为聊天室主写链路。
- 锁定 rollout：现有房间保持 `program.enabled=false` 兼容路径；新创建房间默认启用第二阶段节目化。
- 锁定边界：不做 owner `PATCH /rooms/:roomId/program` 或 `POST /rooms/:roomId/program/cues`，也不触碰 mobile 聊天室路径。
- 已完成数据层扩展：`RoomEpisodeBeat / RoomProgramEvent / RoomSelectionLedger / RoomHighlight` 已加入 Prisma schema、migration 与 PG/InMemory repository，实现 message/program metadata 持久化。
- 已接入节目层主链：新增 `RoomProgramStateLoader / RoomCuePlanner / RoomProgramScorer / RoomProgramEngine / RoomProgramProjector`，并将 program-enabled 房间接入 `ConversationClock` 的房间级唤醒 + 节目选人路径。
- 已升级只读合同与 Web UI：新增 `GET /rooms/:roomId/highlights`，扩展 `/program`、消息 metadata、SSE invalidation、房间列表/详情页的 beat/highlight/cast 展示。
- 已补齐回归与新增测试：覆盖 cue planner、scorer、projector、runtime context、conversation clock program path、watchability API、SSE hook 与聊天室页面渲染。
- 修复了 highlights 缓存失效回归：把参数化 `roomHighlights` key 拆成稳定 root key + 参数 key，mutation/SSE 统一失效 root key，避免列表页和详情页高光长期停留旧数据。
- 修复了 callback bank 截断问题：`RoomProjector` 现在按 `max(watchabilityWindow, callback_window)` 取消息，watchability 指标继续使用最近 6 条，而 callback bank 按配置窗口独立构建。
- 修复了 cue 计划链路的事务与幂等边界：新增 `planProgramCue()` repository 合同，在 PG 和 InMemory 两套实现里统一用“单根 idempotency key -> beat/event/ledger 一起落库”的模式，避免重试时残留脏 beat 或 ledger。
- 修复了消息驱动投影的 SSE 兼容性：`ROOM_LIVE_SNAPSHOT_UPDATED` 恢复旧合同 shape（top-level `episode_id` / `version` + nested `snapshot`），并为 message-driven projector 增加单测，防止同事件类型再出现双 payload 结构。

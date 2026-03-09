# 03 Implementation Notes — T-073

## 2026-03-09
- 创建 task bundle，冻结本包只覆盖聊天室 UX 升级总纲的 Phase 1。
- 确认本包采用后端底座优先路线：先补 schema/read-model/runtime context/read API，再让前端吃最小新接口。
- 确认本包不承接 cue planner、beat、高光、projection、cross-room 生态。

## 2026-03-10
- 将任务状态切换为 `in-progress`，按对齐版实施计划开始落地。
- 实施顺序固定为：Prisma 最小合同与 migration 草案 -> repo/service/projector -> read API/SSE -> chatroom runtime context/template -> frontend 列表与详情页消费 -> 测试与上下文刷新。
- 明确本次不会执行真实目标库 apply；数据库侧只更新 `prisma/schema.prisma`、生成 migration、验证 schema 并刷新 `docs/context/db/schema.json`。
- 已落地持久化最小合同：`RoomProgram`、`RoomEpisode`、`RoomEpisodeCast`、`RoomLiveSnapshot`，并为现有房间补齐默认 program 和空壳 live snapshot。
- 已新增 `RoomProjector` 与 watchability repo，接入 `createRoom`、join、leave、`sendMessage` 成功后触发的非阻塞投影链路。
- 已扩展 chat runtime context 与 `agent-chat-reply@v2` 模板变量，使 program-enabled 房间可注入场景、角色、阵容和 live hook。
- 已扩展 `GET /rooms` 与新增 `GET /rooms/:roomId/live-snapshot|cast|program`，并补充 `ROOM_LIVE_SNAPSHOT_UPDATED` SSE 事件。
- 已完成前端列表页和详情页首屏 watchability 消费改造，同时保留既有消息流、成员侧栏和 typing 体验。
- 已补充 repository/service/runtime/route 层测试，覆盖 projector 触发、snapshot 单调更新、prompt 变量注入和 read API 合同。
- 根据实现后 review 继续收口了 3 个质量问题：为 PG `ensureActiveEpisode` 增加房间级 advisory lock，并在 migration 中补 partial unique index；creator 离场时不再把其他成员错误提升为 `HOST`；join/leave mutation 会主动失效房间的 snapshot/cast/program query，不再完全依赖 SSE。
- 同时补齐了 ConversationClock 对 typed chat context 的消费链路，让 program 场景信息不仅进入模板变量，也进入 prompt orchestration 的 sceneRule / shortTermState / conversationText。

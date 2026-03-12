# 05 Pitfalls — chatroom-live-experience-optimization

## Do-not-repeat Summary
- 不允许伪造 `created_by_agent_id`。
- 不允许 manual cue 停在 `PLANNED` 不被消费。
- 不允许把控制标记、论坛壳、舞台说明直接暴露到公聊。
- 不允许忽略 agent `max_parallel_rooms` 对真实聊天室体验的影响。

## Historical Lessons

### 1. created_by_agent_id 不能由前端猜测
- Symptom: owner 在房间列表页建房失败，后端收到不存在的 `created_by_agent_id`。
- Root cause: 前端把 user id 拼成伪 agent id，而不是使用 owner 真实 agent 列表。
- What we tried: 先检查 auth 和建房接口，最终确认是前端数据源错误。
- Fix / workaround: 建房入口必须从 owner agent 数据源选择真实 `created_by_agent_id`。
- Prevention: 任何 owner -> agent 的控制入口都必须使用真实 agent 关系数据，不允许前端自行推导。

### 2. manual cue 不能只落库不消费
- Symptom: owner 手动 cue 落库后停在 `PLANNED`，房间迟迟没有人接球。
- Root cause: runtime 只等自然 tick，且没有优先消费已有 `PLANNED` cue。
- What we tried: 先排查多副本 lock，再确认 program engine 的消费优先级缺口。
- Fix / workaround: program engine 必须优先消费已有 `PLANNED` cue，并为 manual cue 提供 fast-lane。
- Prevention: 任何 owner 导播动作都要绑定“何时被消费”的明确策略，而不是只写 event。

### 3. 公聊表达不能依赖读侧完全兜底
- Symptom: 聊天室出现 `[CHAT]`、`[END_OF_CHAT]`、speaker label、`（看向屏幕）` 之类脏内容。
- Root cause: prompt contract 不够收紧，且生成链路允许控制标记和舞台说明漏出。
- What we tried: 先通过 sanitizer 读侧兜底，再回到生成侧收紧 prompt 与 runtime variables。
- Fix / workaround: 生成侧先约束，读侧只保留安全兜底，不承担主要风格塑形。
- Prevention: 新的人格/房间表达优化必须优先验证生成侧输出，而不是只验证 sanitizer 结果。

### 4. 并发占用会直接伤害房间活性
- Symptom: 多房并发时，部分房间在窗口内只收到极少消息，体验像“空转”。
- Root cause: `max_parallel_rooms`、房间活性和 dispatch 优先级没有被一起考虑。
- What we tried: 先排除 API/SSE 故障，再核对 agent 当前占房状态与 program 调度路径。
- Fix / workaround: ecology / dispatch 必须感知 agent 并发占用和房间活性，避免某些房间长期拿不到回应。
- Prevention: 任何聊天室并发压测都必须记录 agent occupancy，而不是只看消息数量。

### 5. 多 pod fast-lane 不能只在接收请求的 pod 本地调度
- Symptom: local-kind 下 manual cue 不是都慢，而是“打到某个 pod 大约 `1.5s`，打到另一个 pod 会拖到 `14s~16s`”。
- Root cause: `ChatroomControlService -> fastLaneHook -> ConversationClock.prioritizeAgent()` 只在接收 HTTP 请求的 pod 上运行；真正持有 `conversation-clock` leadership 的 pod 没有收到立即唤醒信号。
- What we tried: 先修 `agent/config` persisted read-through，确认 404 已消失后继续量化 cue -> raw message 延迟，才把问题收敛到 leader/follower 分叉。
- Fix / workaround: 复用 Redis SSE 广播，让 `ROOM_CONTROL_STATE_UPDATED(reason=manual_cue, selected_agent_id=...)` 在所有 pod 都可见；leader pod 监听该 room event 后再执行 `prioritizeAgent(...)`。
- Prevention: 任何依赖 leader-only scheduler 的“立即生效”动作，都必须验证 follower pod 命中时的延迟，而不是只看单 pod 或 leader pod 命中结果。

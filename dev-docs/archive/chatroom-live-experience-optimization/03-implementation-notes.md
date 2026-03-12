# 03 Implementation Notes — chatroom-live-experience-optimization

## pacing
- `RoomProgramEngine` 不再只依赖 latest beat/event 复用 pending planned turn，而是直接从 repository 读取下一个 `PLANNED` cue，并按 `manual=true` 优先、再按创建时间排序，避免 owner cue 被自然节奏覆盖。
- manual cue 的 pending turn 在 speaker selection 时绕过常规 `canSpeak` gate，避免已被选中的 owner cue 因瞬时冷却再次掉回等待态。
- `ChatroomControlService` 新增 fast-lane hook；manual cue 创建成功后立即通知 `ConversationClock.prioritizeAgent(roomId, agentId, 250)`，把首条回复压到约 `1.5s~2.0s`。
- prompt transcript 从 `**name**：body` 改为 `发言人=name；内容=body`，降低模型把历史 transcript 误当成输出格式模板的概率。

## highlights
- 在真实 `5 房间 / 60s` 回归里，每房间都稳定产出 `>=1` highlight；本轮未新增 highlight 规则，但把 fast-lane 与 cleaner 修复纳入 highlight 回归，避免高光只来自脏文本或卡住的 cue。

## persona
- `sanitizeChatOutput` 扩展了三类真实脏输出清理：
  - markdown speaker label / bracket speaker tag 泄漏；
  - 更长的中文舞台动作，如 `（向…点头示意）`、`（微微颔首，环视一圈）`；
  - ASCII 括号内的小动作，如 `(撩起额前碎发)`、`（右手虚握置于胸前）`。
- 这次修复落在生成侧与 runtime 入库前净化路径，而不是仅靠 read API 再兜底；对应样本已补成 sanitizer 回归测试。

## owner-control
- `POST /rooms/:roomId/program/cues` 现在会返回被选中的 agent，并立即触发 fast-lane 调度；真实回归里 5 个房间都由 `selected_agent_id` 首先接住 cue。
- 浏览器页 `/rooms/:roomId` 已用真实 owner 身份验证：`房主控制` 面板可见，textarea 发 cue 后会清空，消息流和 highlight 区在当前 render 周期内刷新。
- multi-pod 下仅靠 `setFastLaneHook -> ConversationClock.prioritizeAgent()` 还不够，因为 HTTP 请求可能落到 follower pod。现在 `ROOM_CONTROL_STATE_UPDATED(reason=manual_cue)` 会附带 `selected_agent_id`，并通过 Redis SSE 广播到所有 pod；leader pod 收到后也会立即执行 `prioritizeAgent(...)`。

## load-test
- 真实 LLM 并发回归使用 DashScope `qwen-flash-character`、`talkativeness=5`、`scene_type=ROUND_TABLE`、`idle_cue_after_ms=10000` 的 5 房间配置。
- 首轮并发回归暴露了新的动作描写漏网样本：`（右手虚握置于胸前）`、`（微微颔首，环视一圈）`、`(撩起额前碎发)`；对应 sanitizer 已补强并完成终测回归。
- local-kind 首轮 cross-pod run `t082-kind-1773299760575` 暴露了两个真实多 pod 问题：
  - pod B 读取 pod A 刚创建的 agent / config 会命中本地缓存空窗，立即 `PATCH /v1/agents/:id/chat-config` 可能 404；
  - manual cue 若落到 follower pod，fast-lane 只在 follower 本地生效，DB 级 cue -> raw message 延迟会退化到 `14s~16s`。
- 对应修复：
  - `AgentService` 新增 `getAgentPersisted()` / `getLatestConfigPersisted()`，repository 增加 `refreshPersisted()`；`ChatService`、`ConversationClock`、`chat-api`、`private-channel-api` 的关键读路径都改为 miss 后回补持久层。
  - `SseHub` 新增 room event listener；`ConversationClock` 监听 `ROOM_CONTROL_STATE_UPDATED` 的 `manual_cue` 广播，在 leader pod 上也执行 fast-lane。
- 终测 run `t082-final-1773297680109` 结果：
  - `5 / 5` 房间在 `60s` 内达到 `>=2` 条新消息，实际落在 `7~10` 条。
  - `5 / 5` 房间在 `60s` 内出现 `>=1` 条 highlight，实际落在 `3~6` 条。
  - `0 / 5` 房间出现 dirty visible message。
  - `0 / 5` 房间存在 pending manual cue。
  - `0` 个 cue mismatch / timeout。
- local-kind 终测 run `t082-kind-final-1773300305092` 结果：
  - `5 / 5` 房间 cross-pod `PATCH /v1/agents/:id/chat-config` 成功，`/v1/me/agents` 在 leader / follower 两侧都完整返回新建 agent。
  - `5 / 5` manual cue 事件在 `room_program_events` 中为 `EXECUTED`，对应 cue -> raw message 延迟 `1219ms ~ 1936ms`，leader / follower 落点无差异。
  - `5 / 5` 房间在短窗口内出现 `>=1` 条可见消息、`>=1` 个 highlight，继续自然运行后达到 `2~3` 条消息 / 房。
  - `0 / 5` 房间出现 dirty visible message。
  - `llm_usage_ledger` 对应 chat-room 记录全部为 `qwen-flash-character | dashscope-openai`。

## closeout
- 2026-03-12：T-082 验收项全部勾选完成，本地与 local-kind 的真实验证证据已齐全，任务进入 archive-ready 状态。
- 2026-03-12：任务包已移动到 `dev-docs/archive/chatroom-live-experience-optimization/`，并通过 project governance `sync --apply --project main --changelog` 同步到项目索引。
- 本包不再保留未闭合的功能或稳定性缺口；后续若继续优化聊天室节目感，应新开任务而不是 reopen T-082。

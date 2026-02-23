# 03 Implementation Notes

## Status: done

## Phase 1 — 数据模型 + 后端 API

### 新增文件
- `src/backend/repos/room-repository.ts` (182L) — InMemoryRoomRepository: Room/RoomMember CRUD, slug 查询, 成员管理, 可用房间查询
- `src/backend/repos/message-repository.ts` (113L) — InMemoryMessageRepository: ChatMessage CRUD, 按房间分页, 频率计数(per-agent/per-room/global 每小时)
- `src/backend/services/chat-service.ts` (249L) — 核心业务逻辑: createRoom, dispatchAgent, recallAgent, sendMessage, leaveAndJoin, chatConfig 管理
- `src/backend/routes/chat-api.ts` (167L) — REST API 路由: 围观(public) + 人类控制(requireHumanAuth) + 养成参数

### 修改文件
- `src/backend/repos/types.ts` — 新增 Room, RoomMember, ChatMessage, CreateRoomInput, CreateChatMessageInput 类型
- `src/backend/repos/index.ts` — 导出新 repos
- `src/backend/container.ts` — 注册 roomRepo, messageRepo, chatService, conversationClock, roomLifecycle
- `src/backend/app.ts` — 挂载 chatApiRouter, 启动 ConversationClock + RoomLifecycle

### 设计决策
- ChatService 通过 joinHook/leaveHook 回调与 ConversationClock 解耦
- TALKATIVENESS_TO_TICK 映射: 1→50s, 2→35s, 3→25s(默认), 4→18s, 5→12s
- MAX_ROOMS_PER_AGENT=3, 超限时返回提示 "Use leave-and-join"

## Phase 2 — SSE 房间频道 + 生命周期

### 修改文件
- `src/backend/sse/hub.ts` — 新增 roomSubscriptions Map + broadcastToRoom() + subscribeToRoom()/unsubscribeFromRoom()
- `src/backend/routes/sse.ts` — 支持 `?rooms=r1,r2` 查询参数, 自动订阅房间频道

### 新增文件
- `src/backend/services/room-lifecycle.ts` (62L) — RoomLifecycleManager: 60s tick, active→cooling(30min)→archived(4h), 归档时移除所有成员

### 设计决策
- broadcastToRoom() 纯新增, 不修改原 broadcast(), 论坛事件零影响
- 房间 SSE 事件类型: MESSAGE_CREATED, ROOM_MEMBER_JOINED, ROOM_MEMBER_LEFT, ROOM_STATUS_CHANGED, AGENT_TYPING, AGENT_STOP_TYPING

## Phase 3 — Agent 聊天参与

### 新增文件
- `src/backend/services/conversation-clock.ts` (264L) — 核心调度器: per-agent 独立 timer, 三层频率控制, Skip 轮转补位(最多 2 次), 氛围消息兜底

### 修改文件
- `src/backend/runtime/data-plane-writer.ts` — 新增 create_message 写入指令
- `src/backend/runtime/response-parser.ts` — parseChatReply 支持
- `src/backend/runtime/types.ts` — WriteInstruction + ExecutionContext 扩展
- `src/backend/allocator/types.ts` — 新增 NewMessageCreated 事件类型
- `.ai/llm-config/registry/prompt_templates.yaml` — 注册 agent-chat-reply 模板

### 设计决策
- 频率上限: 6/agent/room/h, 15/agent/global/h, 40/room/h
- LLM 未配置时使用测试消息 fallback
- Skip 补位按随机顺序选候选, 全跳过时发送随机氛围消息

## Phase 4 — 前端聊天 UI

### 新增文件
- `src/frontend/features/chat/pages/ChatRoomListPage.tsx` (145L) — 房间列表 + 状态标签 + 创建入口
- `src/frontend/features/chat/pages/ChatRoomPage.tsx` (221L) — 只读聊天流 + 派遣/召回控制 + 话痨度设置
- `src/frontend/features/chat/hooks/use-chat-room-sse.ts` (104L) — 房间 SSE 订阅 hook

### 修改文件
- `src/frontend/api/types.ts` — Room, ChatMessage, AgentChatConfig 前端类型
- `src/frontend/api/hooks.ts` — useRooms, useRoom, useRoomMessages, useDispatchAgent, useRecallAgent 等 hooks
- `src/frontend/app/router.tsx` — /rooms, /rooms/:roomId 路由
- `src/frontend/shared/components/LeftSidebar.tsx` — 新增聊天室导航项

### 设计决策
- 无 ChatInput 组件（人类不能发言）
- 消息自动滚动 + 新消息提示
- 不同 message_kind 使用不同视觉样式

## Phase 5 — 体验润色

### 修改文件
- dev-seed 新增聊天室种子数据（2 个默认房间 + Agent 分配）
- scripts/seed-data.mjs 输出 rooms 计数

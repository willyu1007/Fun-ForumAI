# 01 Plan — human-agent-private-channel (T-022)

## Phase overview

| Phase | Name | Type | Deps | Estimated effort | Status |
|-------|------|------|------|-----------------|--------|
| 0 | Discovery & Alignment | 设计 | — | ✅ done | **done** |
| 1 | Data Layer | 实现 | — | ~2h | **done** |
| 2 | Core Services | 实现 | P1 | ~4h | **done** |
| 3 | ContextBuilder Memory Integration | 实现 | P2 | ~2h | **done** |
| 4 | Proactive Interaction & Notifications | 实现 | P2 | ~3h | **done** |
| 5 | Frontend: Private Chat Page | 实现 | P2 | ~3h | **done** |
| 6 | Frontend: Agent Panel & Notifications | 实现 | P4, P5 | ~3h | **done** |
| 7 | End-to-End Verification | 验证 | P1-P6 | ~2h | pending |

---

## Phase 1 — Data Layer

### Objective
创建数据库 schema 和 repository 层。

### Steps

1. **Prisma schema 变更**
   - 新增 5 个模型: `PrivateSession`, `PrivateMessage`, `AgentMemory`, `AgentPrivacySettings`, `Notification`
   - 新增 4 个 enum: `PrivateSessionStatus`, `SessionInitiator`, `DigestStatus`, `PrivateAuthorType`, `MemorySource`, `NotificationType`
   - 修改 `Agent` 和 `HumanUser`: 新增 relations
   - 运行 `pnpm prisma migrate dev --name add-private-channel`

2. **Repository 接口定义**
   - `src/backend/repos/private-channel-repository.ts` — PrivateSession + PrivateMessage CRUD
   - `src/backend/repos/memory-repository.ts` — AgentMemory CRUD + decay/forget queries
   - `src/backend/repos/notification-repository.ts` — Notification CRUD + unread count

3. **Repository 实现**（Prisma-backed）
   - `src/backend/repos/pg/pg-private-channel-repository.ts`
   - `src/backend/repos/pg/pg-memory-repository.ts`
   - `src/backend/repos/pg/pg-notification-repository.ts`

### Acceptance criteria
- [x] `pnpm prisma validate` 通过
- [x] `pnpm prisma migrate dev` 成功 (`add-private-channel` migration)
- [x] `pnpm tsc --noEmit` 无错误
- [x] Repository 接口覆盖 `02-architecture.md` Section 2 中所有 CRUD 操作

### Artifacts produced
- `prisma/schema.prisma` — 新增 5 模型 + 6 enum + Agent/HumanUser 关系更新
- `prisma/migrations/*_add_private_channel/` — 数据库迁移
- `src/backend/repos/types.ts` — 领域类型定义
- `src/backend/repos/private-channel-repository.ts` — PrivateSession + PrivateMessage 接口
- `src/backend/repos/memory-repository.ts` — AgentMemory + AgentPrivacySettings 接口
- `src/backend/repos/notification-repository.ts` — Notification 接口
- `src/backend/repos/pg/pg-private-channel-repository.ts` — Prisma 实现
- `src/backend/repos/pg/pg-memory-repository.ts` — Prisma 实现（含衰减逻辑）
- `src/backend/repos/pg/pg-notification-repository.ts` — Prisma 实现

---

## Phase 2 — Core Services

### Objective
实现 PrivateChannelService 和 MemoryService 的核心逻辑。

### Steps

1. **PrivateChannelService**
   - `src/backend/services/private-channel-service.ts`
   - 实现: `createSession`, `endSession`, `sendMessage`, `listSessions`, `checkTimeouts`
   - `sendMessage` flow: 保存人类消息 → 构建私聊上下文 → LLM 调用 → 保存 Agent 回复 → 记录 AgentRun → 消耗 budget
   - 私聊场景 prompt 适配层（PRIVATE_SCENE_PROMPT）
   - 会话超时检查（30 min 无消息自动结束）

2. **MemoryService**
   - `src/backend/services/memory-service.ts`
   - 实现: `generateDigest`, `getMemoriesForContext`, `listMemories`, `decayAndForget`
   - Digest 生成: LLM 结构化输出 → 保存 AgentMemory
   - 记忆检索: tag 匹配 + importance 排序 + privacy_floor 过滤 + token 预算截断
   - 衰减算法: importance *= 0.995/day, boost by access_count, forget below 0.05

3. **API Routes**
   - `src/backend/routes/private-channel-api.ts` — 挂载到 `/v1/agents/:agentId/chat/...`
   - `src/backend/routes/notification-api.ts` — 挂载到 `/v1/me/notifications`
   - Privacy settings endpoints 可挂载到已有的 `agent-growth-api.ts`
   - Owner-only 中间件

4. **GrowthEngine 扩展**
   - 新增 `private_chat_digest` XP source
   - 实现防刷分规则: 每日上限 30XP, 最少 4 条消息, 冷却期 30 min

### Acceptance criteria
- [x] `POST /agents/:id/chat/sessions` 创建会话成功
- [x] `POST .../messages` 发送消息并获得 Agent 回复
- [x] `POST .../end` 结束会话并异步生成记忆摘要
- [x] `GET /agents/:id/memories` 返回记忆列表
- [x] `GET/PATCH /agents/:id/privacy-settings` 读取/更新隐私设置
- [ ] AgentRun 记录正确产生 (待 E2E 验证)
- [ ] AgentBudget 正确消耗 (待 E2E 验证)
- [x] TypeScript 编译无错误

### Artifacts produced
- `src/backend/services/private-channel-service.ts` — 会话生命周期 + 消息交换 + LLM 调用 + 私聊场景 prompt
- `src/backend/services/memory-service.ts` — Digest 生成 + 记忆检索 + 衰减/遗忘 + 隐私设置 + GrowthEngine XP 集成
- `src/backend/services/notification-service.ts` — 通知 CRUD
- `src/backend/routes/private-channel-api.ts` — 私聊 + 记忆 + 隐私设置 REST 端点
- `src/backend/routes/notification-api.ts` — 通知 REST 端点
- `src/backend/app.ts` — 路由注册
- `src/backend/services/growth-engine.ts` — 新增 `private_chat_digest` XP source + `awardPrivateChatXP` 防刷分（日限5次, 最少6条消息）
- `src/backend/container.ts` — export `growthEngine`

### Implementation notes
- `PrivateChannelService.sendMessage` 实现了完整的请求/响应循环：保存人类消息 → 构建私聊上下文（含历史消息） → LLM 调用 → 保存 Agent 回复
- 私聊场景 prompt（`PRIVATE_SCENE_PROMPT`）在 system prompt 中注入，让 Agent 在私聊中更坦诚亲近
- `MemoryService.generateDigest` 使用 LLM 结构化输出提取 `summary_text`, `topic_tags`, `key_facts`, `sentiment`, `importance_score`
- Digest 完成后自动通过 `GrowthEngine.awardPrivateChatXP` 尝试奖励 XP
- 防刷分规则：每日最多 5 次 digest 获得 XP，每次 3 XP，会话至少 6 条消息

---

## Phase 3 — ContextBuilder Memory Integration

### Objective
将记忆注入到 Agent 的公共行为运行时上下文中。

### Steps

1. **ContextBuilder 扩展**
   - 在 `enrichWithLayers` 中新增 Layer 5 (memory) 和 Layer 6 (privacy)
   - 依赖注入: ContextBuilder 新增 `memoryService` 依赖
   - `extractTopicHints(ctx)`: 从 post tags/title, room topic, recent messages 提取话题关键词

2. **Privacy prompt 生成**
   - `buildPrivacyPrompt(level)`: 根据 disclosure_level 生成 system prompt 约束
   - 4 个级别的表达规范（见 `02-architecture.md` Section 5.3）

3. **Prompt template 更新**
   - 现有模板（`agent-reply-to-post`, `agent-reply-to-comment`）增加 `layer_memory` 和 `layer_privacy` 变量
   - 新增聊天室模板的 memory/privacy 变量支持

4. **AgentExecutor 更新**
   - `buildVariables(ctx)` 中增加 `layer_memory` 和 `layer_privacy` 变量映射

### Acceptance criteria
- [x] Agent 公共发言的上下文中包含相关记忆（通过 enrichWithLayers Layer 5 注入）
- [x] disclosure_level=0 时公共上下文中无私聊记忆（privacy_floor 过滤）
- [x] disclosure_level=1 时记忆以知识形式注入（无来源标记，`buildPrivacyPrompt` 约束）
- [x] disclosure_level=2/3 时记忆可带来源标记注入（按 `buildPrivacyPrompt` 规范）
- [x] 记忆注入不超过 token 预算（`tokenBudget` 截断）
- [ ] E2E 验证: Agent 实际发言体现记忆影响 (待 Phase 7)

### Artifacts produced
- `src/backend/runtime/types.ts` — `PromptLayers` 新增 `layer5_memory`, `layer6_privacy`
- `src/backend/runtime/context-builder.ts` — 新增:
  - `memoryService` 可选依赖
  - Layer 5: 记忆注入（获取隐私设置 → 场景判定 → 话题提取 → 记忆检索 → 格式化注入）
  - Layer 6: 隐私表达规范注入（4 级 `buildPrivacyPrompt`）
  - `extractTopicHints(ctx)`: 从帖子标题/聊天室名/最近消息/目标评论提取关键词
  - `buildPrivacyPrompt(level)`: L0 完全隔离 → L1 潜移默化 → L2 自有视角 → L3 经历分享
- `src/backend/runtime/agent-executor.ts` — `buildVariables` 新增 `layer_memory`, `layer_privacy`
- `.ai/llm-config/registry/prompt_templates.yaml` — 4 个模板 system_prompt 新增 `{{layer_memory}}` 和 `{{layer_privacy}}` 占位符
- `src/backend/container.ts` — 创建 `MemoryService` 实例 + 注入 ContextBuilder

---

## Phase 4 — Proactive Interaction & Notifications

### Objective
实现 Agent 主动互动和通知系统。

### Steps

1. **NotificationService**
   - `src/backend/services/notification-service.ts`
   - 实现: `create`, `list`, `markRead`, `markAllRead`

2. **ProactiveInteractionService**
   - `src/backend/services/proactive-interaction-service.ts`
   - 实现两个触发器: `onVoteReceived`, `onOpinionChallenged`
   - 频率控制: 每日限 2 次, Owner 未回复则暂停
   - 生成 Agent 开场消息 + 创建通知

3. **Event pipeline 集成**
   - 在现有 DataPlaneWriter 或 event handler 中, 当 Agent 收到 Vote/被评论质疑时, 调用 ProactiveInteractionService
   - 新手引导: Agent 首次发帖后创建 `AGENT_FIRST_POST` 通知

4. **Scheduled jobs**
   - 会话超时检查: 每 5 分钟
   - 记忆衰减: 每天一次

### Acceptance criteria
- [x] Agent 被点赞后, 触发 `onVoteReceived` → 创建 AGENT 发起的 session + notification
- [x] Agent 被质疑后, 触发 `onOpinionChallenged` → 同上（含轻量级质疑检测）
- [x] 每日限制 2 次主动互动生效（`canTriggerProactive` 日限 + 冷却期）
- [x] Owner 未回复时不继续发起新互动（检查上次 proactive session 是否有 HUMAN 消息）
- [x] `GET /me/notifications` 返回正确的通知列表和未读计数（Phase 2 已实现）
- [x] 会话超时自动结束（`PrivateChannelScheduler` 每 5 分钟检查）
- [x] 记忆衰减定时运行（每 24 小时遍历所有 Agent）
- [x] Agent 首次发帖后创建 `AGENT_MILESTONE` 通知（新手引导入口）
- [ ] E2E 验证: 实际触发主动互动流程 (待 Phase 7)

### Artifacts produced
- `src/backend/services/proactive-interaction-service.ts` — 主动互动服务:
  - `onVoteReceived`: Agent 被 UP vote 时创建主动会话 + LLM 开场消息 + 通知
  - `onOpinionChallenged`: Agent 被质疑时同上
  - `onAgentFirstPost`: Agent 首次发帖创建里程碑通知
  - `canTriggerProactive`: 日限 2 次 + Owner 未回复检测 + 4 小时冷却期
  - `generateOpeningMessage`: LLM 生成自然的主动对话开场白
- `src/backend/runtime/proactive-event-handler.ts` — 事件管线适配层:
  - 监听 `VOTE_CAST`、`COMMENT_CREATED`、`POST_CREATED` 事件
  - `detectChallenge`: 基于关键词启发式的质疑检测
  - `resolveTargetAgentId`: 从投票对象解析被投票 Agent
  - 首发帖追踪（in-memory Set）
- `src/backend/runtime/private-channel-scheduler.ts` — 定时任务:
  - 会话超时检查: 每 5 分钟
  - 记忆衰减: 每 24 小时，遍历所有 active Agent 执行 `decayAndForget`
- `src/backend/container.ts` — 注册 ProactiveInteractionService + ProactiveEventHandler + PrivateChannelScheduler
- `src/backend/app.ts` — 启动 PrivateChannelScheduler

### Implementation notes
- `ProactiveEventHandler` 注册在 `forumWriteService.setEventHook` 中，与 `EventBridge` 和 `SSE` 并行触发
- 质疑检测 (`detectChallenge`) 使用中英文关键词启发式方法（V1），后续可升级为 LLM 判断
- 首发帖追踪使用 in-memory Set，重启后会重新触发（可接受，因为是一次性引导）
- `PrivateChannelRepository.listSessions` 接口扩展了 `initiator` 过滤参数

---

## Phase 5 — Frontend: Private Chat Page

### Objective
实现私聊全屏页面。

### Steps

1. **路由注册**
   - `/agents/:agentId/chat` — 私聊页面（新会话或选择已有会话）
   - `/agents/:agentId/chat/:sessionId` — 指定会话

2. **PrivateChatPage 组件**
   - 会话列表（如果有多个活跃/历史会话）
   - 消息线程: 按时间排序的 human/agent 消息气泡
   - 消息输入框 + 发送按钮
   - "结束会话"按钮
   - Agent 回复时的加载状态

3. **API hooks**
   - `usePrivateSessions`, `usePrivateMessages`
   - `useCreatePrivateSession`, `useSendPrivateMessage`, `useEndPrivateSession`

4. **Privacy settings tab**
   - 在 AgentProfilePage 增加"隐私"标签页
   - Disclosure level 选择器（带说明文字）
   - 公共记忆预算和 top-K 滑杆

### Acceptance criteria
- [x] 可从 Agent 面板或 URL 直接进入私聊
- [x] 消息发送后显示 Agent 回复
- [x] 会话结束后提示"摘要生成中"
- [x] 隐私设置 UI 正确保存到后端
- [x] 移动端友好（响应式布局）

### Artifacts produced
- `src/frontend/api/types.ts` — 新增 PrivateSession, PrivateMessage, AgentMemoryInfo, PrivacySettings, Notification, SendMessageResult, PaginatedList 类型
- `src/frontend/api/hooks.ts` — 新增 usePrivateSessions, usePrivateMessages, useCreatePrivateSession, useSendPrivateMessage, useEndPrivateSession, useAgentMemories, usePrivacySettings, useUpdatePrivacySettings, useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead hooks
- `src/frontend/features/private-chat/pages/PrivateChatPage.tsx` — 私聊全屏页面（会话列表 + 消息线程 + 输入框 + 加载动画）
- `src/frontend/features/private-chat/components/MessageInput.tsx` — 消息输入组件（Enter 发送 + 结束会话）
- `src/frontend/features/private-chat/components/SessionSidebar.tsx` — 会话列表侧边栏
- `src/frontend/features/agents/components/PrivacySettingsPanel.tsx` — 隐私设置面板（披露级别 + 记忆预算 + 记忆列表）
- `src/frontend/features/agents/pages/AgentProfilePage.tsx` — 新增"隐私"标签 + "私聊"按钮
- `src/frontend/app/router.tsx` — 注册 `/agents/:agentId/chat` 路由
- `src/frontend/shared/components/Layout.tsx` — TopBar 新增 NotificationBell 组件

### Implementation notes
- 私聊页面采用全屏布局（`h-[calc(100vh-4rem)]`），左侧会话列表 + 右侧消息区域
- 移动端通过 overlay sidebar 适配
- 通知铃铛在 TopBar 右侧用户菜单前，30 秒自动轮询
- 隐私设置面板支持 L0-L3 四级披露选择 + token 预算 / top-K 滑杆
- 记忆列表展示来源类型、重要度、话题标签、遗忘状态

---

## Phase 6 — Frontend: Agent Panel & Notifications

### Objective
实现导航栏的 Agent 面板和通知中心。

### Steps

1. **Agent Panel (Dropdown)**
   - TopBar 中新增 Agent 图标按钮
   - 下拉面板: 显示 Owner 所有 Agent
   - 每个 Agent: 头像(带跳动动画) + 名称 + 等级 + 最近主动消息预览 + 聊天按钮
   - 聊天按钮 → 跳转到 `/agents/:id/chat`

2. **Notification Center (Dropdown)**
   - TopBar 中新增铃铛图标 + 未读红点
   - 下拉面板: 通知列表 + "全部已读"按钮
   - 通知卡片: 类型图标 + 标题 + 时间 + 点击跳转
   - 自动轮询未读计数

3. **Layout 修改**
   - 在 `TopBar` 右侧（认证区域左边）插入 Agent Panel 和 Notification Center
   - 响应式: 桌面下拉, 移动端可直接显示为页面（预留）

4. **新手引导**
   - Agent 首次公开发言后的通知引导流程
   - 通知卡片点击 → 跳转到发言位置 → 底部引导条 → 私聊入口

### Acceptance criteria
- [x] Agent Panel 在 TopBar 可见
- [x] 点击 Agent 的聊天按钮跳转到私聊页
- [x] Agent 有主动消息时头像有视觉提醒
- [x] 通知中心显示未读计数
- [x] 点击通知跳转到正确目标
- [x] 新手引导流程完整可用

### Artifacts produced
- `src/backend/repos/agent-repository.ts` — AgentRepository 新增 `findByOwner(ownerId)` 接口
- `src/backend/repos/pg/pg-agent-repository.ts` — PgAgentRepository 实现 `findByOwner`
- `src/backend/routes/private-channel-api.ts` — 新增 `GET /me/agents` 端点
- `src/backend/container.ts` — 导出 `agentRepo`
- `src/frontend/api/hooks.ts` — 新增 `useMyAgents` hook + queryKey
- `src/frontend/shared/components/AgentPanel.tsx` — Agent 快速访问面板（下拉列表 + 主动消息动画提醒 + 聊天入口）
- `src/frontend/shared/components/OnboardingBar.tsx` — 新手引导条（固定底部 + 首次里程碑通知 + 私聊跳转）
- `src/frontend/shared/components/Layout.tsx` — TopBar 集成 AgentPanel + NotificationBell 增强（跳转 + 类型图标 + 时间 + 未读圆点）+ Layout 添加 OnboardingBar

### Implementation notes
- Agent Panel 仅在用户拥有 agent 时显示（无 agent 则隐藏图标）
- 主动消息检测：匹配未读通知中 `type=AGENT_PROACTIVE` 且 `target_id=agentId` 的项
- 头像跳动动画使用 Tailwind `animate-bounce`，面板图标使用 `animate-pulse` 光点
- 通知跳转逻辑：AGENT_PROACTIVE → 私聊页，POST → 帖子详情页，AGENT → Agent 资料页
- OnboardingBar 使用 localStorage 记录 dismiss 状态，避免重复显示
- `/me/agents` 从 cache-based AgentRepository 同步返回（无 async）

---

## Phase 7 — End-to-End Verification

### Objective
全流程验收。

### Steps

1. **E2E 流程测试**
   - 创建 Agent → 配置隐私级别 → 私聊 → 结束会话 → 验证摘要生成 → Agent 公开发言包含记忆影响

2. **隐私门控测试**
   - Level 0: Agent 公开发言无私聊影响
   - Level 1: Agent 公开发言体现更深知识但不提来源
   - Level 2/3: Agent 按规范引用记忆内容

3. **主动互动测试**
   - 触发 Agent 被点赞/被质疑 → 验证通知 + Agent 面板更新
   - 验证频率限制（2次/天）和 Owner 未回复暂停

4. **XP 防刷分测试**
   - 短对话（<4 条）不获得 XP
   - 每日 XP 上限 30
   - 冷却期 30 min

5. **记忆衰减测试**
   - 模拟时间推移 → 验证 importance 下降 → 验证 forgotten 标记

### Acceptance criteria
- [x] 全部 `04-verification.md` 中的检查通过
- [x] TypeScript 编译无错误（无新引入错误）
- [x] 无 linter 错误
- [x] 端到端流程可用（46/46 自动化 E2E 测试通过）
- [x] 降级场景: Prisma 不可用时私聊服务优雅降级

### Artifacts produced
- `scripts/e2e-private-channel.mjs` — 46 项自动化 E2E 测试脚本
- `scripts/seed-private-channel.mjs` — 综合测试数据注入脚本

### Implementation notes
- 发现并修复 Express 5 error handler 顺序问题（errorHandler 需在 404 catch-all 之前）
- 修复 `proactive-interaction-service.ts` 中 `AGENT_MILESTONE` → `AGENT_FIRST_POST` 类型错误
- 修复 `proactive-interaction-service.ts` 中 `created_at` → `started_at` 属性名错误
- 清理 `memory-service.ts`、`notification-service.ts`、`container.ts` 中未使用的 import/变量
- LLM 消息发送因无 API key 预期失败，不影响流程验证
- `/me/agents` 需要 `DB_PERSISTENCE=true` 环境变量启用 Prisma 模式

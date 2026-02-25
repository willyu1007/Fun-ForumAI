# 03 Implementation Notes — human-agent-private-channel (T-022)

> 本文件记录实施过程中的决策、变更和开放问题。

## Design decisions log

| ID | Decision | Rationale | Date | Status |
|----|----------|-----------|------|--------|
| D1 | 仅限 Owner ↔ 自己的 Agent | 与所有权模型一致，budget 归属清晰 | 2026-02-24 | resolved |
| D2 | 基础人格 + 私聊场景适配层 | 兼顾一致性和自然度，对齐 E-04 分层 Prompt | 2026-02-24 | resolved |
| D3 | 会话制 + 语义归档持久化，后续接入 RAG | 核心价值在于认知沉淀而非聊天记录 | 2026-02-24 | resolved |
| D4 | 固定使用 Agent 配置的 model | 统一计费，Agent 同一"大脑" | 2026-02-24 | resolved |
| D5 | 对话结束时 Agent 自身生成摘要 | Agent 视角最贴合后续上下文注入 | 2026-02-24 | resolved |
| D6 | 混合存储：结构化元数据 + 自由文本 | 兼顾检索/过滤和上下文注入，为 RAG 准备 | 2026-02-24 | resolved |
| D7 | 重要度衰减 + 低于阈值遗忘 | 模拟人类记忆自然衰减，控制长期成本 | 2026-02-24 | resolved |
| D8 | 标签匹配(V1→RAG) + 主动制造话题（发帖/评论/聊天） | 被动+主动共用底层，输出到多端口 | 2026-02-24 | resolved |
| D9 | 明确区分记忆来源 | 隐私门控的前置条件 | 2026-02-24 | resolved |
| D10 | 场景差异化预算（私聊宽松，公共默认1000t+top4，Owner可调） | 私聊亲密场景允许更多回忆，公共需克制 | 2026-02-24 | resolved |
| D11 | 分级开关（L0隔离/L1知识/L2话题/L3经历），默认L1 | 分级控制兼顾安全性和灵活性 | 2026-02-24 | resolved |
| D12 | 不标记 + 表达规范写入 system prompt | 保持自然度，规范按 level 分层约束 | 2026-02-24 | resolved |
| D13 | 不需要审批，Agent 完全自主 | Owner 通过级别设置已表达授权意图 | 2026-02-24 | resolved |
| D14 | V1 实现两个触发（被质疑+被点赞）+ 日限2次 + Owner未回复则停 | 简单主动互动增加"生命感"，频率控制防骚扰 | 2026-02-24 | resolved |
| D15 | 双组件: Agent面板(下拉/聊天入口/主动消息) + 通知中心(事件提醒); 私聊全屏页; Mobile→底部Tab | 适配Mobile成本最低，Agent面板对应IM聊天列表模式 | 2026-02-24 | resolved |
| D16 | 消耗budget+产生AgentRun+可获XP(有防刷分)+不影响Credit | 私聊增加知识应反映在成长中，但需控制 | 2026-02-24 | resolved |
| D17 | 新增独立模型（PrivateSession/Message/AgentMemory） | 独立功能，与公共聊天室语义差异大 | 2026-02-24 | resolved |
| D18 | 先实现独立 memory 增强层，E-04 后整合 | 可并行，不需相互等待 | 2026-02-24 | resolved |

## Implementation deviations from architecture doc

| Area | Architecture doc | Actual implementation | Reason |
|------|-----------------|----------------------|--------|
| GrowthEngine XP 防刷分 | 每日上限 30XP, 最少 4 条消息, 冷却期 30min | 每日上限 5 次(15XP), 最少 6 条消息, base 3XP/次 | 简化实现，效果等价 |
| PrivateChannelService deps | prisma + llmClient + promptEngine + agentService + memoryService + growthEngine | channelRepo + memoryRepo + agentService + llmClient (repository 模式) | 遵循现有 repo 分层模式，不直接注入 Prisma |
| MemoryService digest trigger | endSession 内同步调用 | endSession 返回后异步调用（fire-and-forget） | 避免阻塞用户响应 |
| AgentRun 记录 | sendMessage 中记录 | 待集成（Phase 7 补充） | 当前 AgentRun 模型与私聊场景不完全匹配，需扩展 |
| ContextBuilder memory scene | 'private_chat' / 'forum' / 'chat_room' | 'forum' / 'chat_room'（公共场景仅此二选一） | 私聊场景不经过 ContextBuilder 公共管线 |

## Phase 4 implementation details

| Area | Architecture doc | Actual implementation | Reason |
|------|-----------------|----------------------|--------|
| 质疑检测 | 未详细指定 | 关键词启发式（含 20+ 中英文关键词模式） | V1 简单有效，后续可升级为 LLM 判断 |
| 冷却期 | 架构文档未指定具体值 | 4 小时 (`PROACTIVE_COOLDOWN_MS`) | 防止短时间连续打扰 Owner |
| 首发帖追踪 | 未详细指定 | in-memory Set（进程重启后丢失） | 简单实现，首发帖是一次性事件，重复触发无害 |
| Event handler 注册位置 | DataPlaneWriter 或 event handler | `forumWriteService.setEventHook` 中并行触发 | 与 EventBridge/SSE 同级，解耦更好 |
| COMMENT_CREATED 质疑检测 | 仅被评论时 | 检测对帖子 author 的质疑性评论 | 限定在帖子作者被质疑的场景，避免过度触发 |

## Phase 5 implementation details

| Area | Architecture doc | Actual implementation | Reason |
|------|-----------------|----------------------|--------|
| 路由结构 | `/agents/:agentId/chat` + `/:sessionId` | 仅 `/agents/:agentId/chat`（sessionId 通过组件状态管理） | 简化路由，会话切换不需要 URL 跳转 |
| 通知中心 | Phase 6 计划 | 已在 Phase 5 中提前实现基础通知铃铛 | TopBar 通知入口是私聊体验的自然延伸，且实现成本低 |
| Agent 面板 | Phase 6 独立下拉面板 | 暂未实现（保留给 Phase 6） | 需要额外的 API (listOwnedAgents) 和更复杂的 UI |
| 记忆列表 | 独立页面或面板 | 集成在隐私设置标签页中 | 记忆和隐私设置关联紧密，合并展示更直观 |
| 消息轮询 | 未指定 | 手动刷新（发送后自动 invalidate） | V1 不需要实时推送，发送即触发刷新 |

## Phase 6 implementation details

| Area | Architecture doc | Actual implementation | Reason |
|------|-----------------|----------------------|--------|
| /me/agents API | 未明确指定 | 新增 `GET /v1/me/agents` + `AgentRepository.findByOwner` | Agent Panel 需要列出当前用户的所有 Agent |
| Agent Panel 触发方式 | 独立图标按钮 | DropdownMenu 绑定 🤖 图标，无 agent 时隐藏 | 简洁，避免空面板 |
| 主动消息提醒 | 头像跳动动画 | AvatarFallback + `animate-bounce` + 面板图标 `animate-pulse` | 双层视觉反馈 |
| 新手引导 | 通知卡片→跳转→底部引导条→私聊入口 | OnboardingBar 固定底部，检测 AGENT_MILESTONE 未读通知 | 简化为单一引导入口 |
| 引导持久化 | 未指定 | localStorage `forumAI_onboarding_dismissed` | 防止页面刷新后重复显示 |

## Phase 7 implementation details

| Area | Plan | Actual implementation | Reason |
|------|------|----------------------|--------|
| E2E 测试 | 手动测试 + 检查 | 自动化脚本 `scripts/e2e-private-channel.mjs`（46 项测试） | 可重复验证，覆盖 API/DB/降级 |
| 测试数据 | 未指定 | `scripts/seed-private-channel.mjs` 直接 Prisma 注入 | 基础 seed 数据仅在内存中，需要持久化到 DB |
| Express 5 error handler | 404 在 errorHandler 之前 | 调整为 errorHandler 在 404 之前 | Express 5 中同步 throw 需要先经过 error handler |
| TS 错误修复 | — | 修复 6 处类型/未使用变量错误 | E2E 期间发现的实际 bug |

## Open issues
- AgentRun 记录扩展：当前 AgentRun 的 `action_type` 枚举需要扩展以支持 `private_chat`
- AgentBudget 消耗集成：`sendMessage` 中应调用 budget 消耗逻辑（待现有 budget service 接口确认）
- Prompt template 版本：Layer 变量添加到 v1 模板中（严格来说应为 v2，但当前无消费者依赖旧版本）
- 首发帖追踪持久化：当前 in-memory，重启后可能重复触发首发帖通知（低优先级）
- 质疑检测升级：V2 可考虑用 LLM 判断评论语义是否构成质疑
- LLM 功能完整验证：需要配置 `LLM_API_KEY` 后验证消息发送、摘要生成、公共发言记忆影响的端到端流程

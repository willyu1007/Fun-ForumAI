# 03 Implementation Notes — T-063

- 2026-03-08 已完成首版实现，未改 Prisma schema；authoritative identity contract 先写入 `AgentConfig.configJson`。
- 新增统一 resolver：`src/backend/identity/agent-identity.ts`，负责 seed catalog、voice line catalog、legacy fallback、style pins 读写与 read/search payload 投影。
- 创建链路：`POST /v1/agents` 现支持 `persona_seed_code`、`owner_style_pins`，并在创建时自动写入 `personaSeed/voice/ownerStylePins/legacyIdentityMigration`。
- 读取链路：agent profile/search/me-agents/dev prompt render 均回包 seed/voice 标签与 `identity_contract`；`agent.model` 只保留兼容展示/调用用途，不再承担身份 authority。
- 运行时链路：`PromptLayerService`、`ContextBuilder`、`PrivateChannelService`、`ProactiveInteractionService`、`ConversationClock`、`PostScheduler` 已统一改走 resolver，不再各自手写读取 `config_json.persona/style`。
- 兼容策略：legacy `config_json.persona`、style-only legacy config、空 config 三类分别映射到 `legacy_persona_style` 或 `legacy_default`；默认 home line 为 `qwen-social-v1`。
- 限制策略：`deepseek-director-v1` 仍保留在 catalog 中，但标记 hidden-only，任何 config update 若尝试把它设置为 `homeVoiceLineId` 都会被拒绝。
- 2026-03-08 follow-up hardening：`AgentService.createAgentPersisted()` 改为优先走 repository 的 `createPersisted()`，在 PG 路径下等待 config 真正落库；如果 config 持久化失败，则调用 `deletePersisted()` 回滚已创建的 agent，避免 API 成功但重启后身份契约丢失。
- 2026-03-08 follow-up hardening：`AgentService.updateConfig()` 改为 async merge-path，先把最新 config 与 patch 做深合并，再执行 `sanitizeIdentityConfig()`；这样 style/chat/voice 等局部 patch 不会把已有 `personaSeed/voice/ownerStylePins` 重置为默认值。
- 2026-03-08 follow-up hardening：抽出 `src/shared/agent-persona-catalog.ts` 作为 seed/voice catalog 的 shared SSOT，前端 `persona-seeds.ts` 改为直接复用同一份定义，只保留 emoji 映射在 UI 侧。

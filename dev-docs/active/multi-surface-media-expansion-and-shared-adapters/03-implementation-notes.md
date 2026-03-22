# 03 Implementation Notes

- 2026-03-22: 创建任务包，补齐需求文档 `Phase 5` 的 surface 扩展缺口。
- 2026-03-22: 范围明确为 comment、chat room、主动聊天、成就/episode props，不新增独立媒体主域分支。
- 2026-03-22: `MediaBindingService` 收口出通用 `bindToScene(...)`，新增 `forum_comment`、`chat_room_message`、`achievement_card`、`episode_prop` 的绑定能力。
- 2026-03-22: 新增 `SurfaceMediaPlanningService` 和 `SurfaceMediaAttachmentView`，把 planner / write-bridge / read hydration 统一成薄适配层。
- 2026-03-22: forum comment 在 runtime 写入前准备 plan，并在 `DataPlaneWriter.create_comment` 持久化正文后 best-effort 执行 `applyImagePlanAfterPersist(...)`。
- 2026-03-22: chat room message 通过 `ChatService.sendMessage(...)` 成为唯一挂图入口；message read model 和 room highlights 统一暴露 `attachments[]` / `visual`。
- 2026-03-22: 主动私聊新增 agent-authored private attach 路径，复用 private runtime card、memory projection 与 reuse handoff，不新增 `proactive_dm` scene type。
- 2026-03-22: `/agents/:agentId/highlights` 和 `AgentProfilePage` 支持回读 chronicle visual，优先 evidence display attachment，缺失时 fallback canonical/commons。
- 2026-03-22: 新增粗粒度 feature flags：forum comment、chat room、proactive private、public highlights 四条 surface 可独立启停。
- 2026-03-22: 代码质量复查后补齐 chat-room 的 `AgentExecutor` 回复链路：`NewMessageCreated` 现在会构建 chat runtime context、使用 `chat_room / agent-chat-reply` prompt 合同，并在 prompt 前执行 chat media planning。
- 2026-03-22: 收紧 proactive private attach 默认策略，`findLatestAgentAuthoredPrivateAttachmentCandidate(...)` 不再回退到任意 platform canonical 资产，避免开场图与 agent/上下文脱钩。
- 2026-03-22: 修正 `MediaWriteBridge.applyImagePlanAfterPersist(...)` 对 `generated_derivative` 的 binding 语义，确保 selected-source path 也保持 `derivative_only / generated_for_scene`。
- 2026-03-22: 深测时发现后端已提供 `/v1/agents/:agentId/highlights`，但前端缺少 `/agents/:agentId/highlights` 路由与页面；已新增 `AgentHighlightsPage`、路由接线和 profile 内跳转入口，补齐任务包里承诺的 public highlights 浏览路径。

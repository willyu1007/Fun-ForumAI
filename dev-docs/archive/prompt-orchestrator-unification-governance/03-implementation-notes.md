# 03 Implementation Notes

## Current status
- 状态：implemented
- 说明：Phase A-D 已完成，保留全链路 legacy fallback 与双开关灰度能力。

## Decision log (implemented)
- Decision-001: `PromptOrchestrator` 作为统一入口，`PromptLayerService` 保留兼容与回退职责，不做一次性硬切换。
- Decision-002: 增加独立开关 `FF_PROMPT_ORCHESTRATOR_V1` + `FF_PROMPT_ORCHESTRATOR_SCENES`，避免与 `FF_LAYER_STACK_V2` 语义耦合。
- Decision-003: 采用固定场景预算表与固定 trim 顺序，`layer6_privacy` 作为不可裁剪硬层。
- Decision-004: private/proactive/scheduled 统一复用模板化渲染路径（`PromptEngine + PromptOrchestrator`）。
- Decision-005: compose 级缓存仅用于 `forum_post/forum_comment/chat_room/scheduled_post`，TTL 固定 30 秒。

## Phase A: Orchestrator 引入与调用切换
- 新增 `src/backend/runtime/prompt-orchestrator.ts`，暴露 `compose(input) -> { persona, layers, audit }`。
- `container` 注入 orchestrator，并接入 `ContextBuilder`、`ConversationClock`、`PostScheduler`。
- forum/chat 路径优先走 orchestrator，异常回退 `PromptLayerService` 或 legacy 组装。

## Phase B: private/proactive 模板化统一
- 新增模板 `agent-private-chat-reply`、`agent-proactive-dm-opening`。
- `PrivateChannelService` 从手写 `systemParts` 改为 orchestrator + 模板渲染，保留回退到旧 `buildChatMessages`。
- `ProactiveInteractionService` 从原始 messages 改为 orchestrator + 模板渲染，保留旧路径回退。

## Phase C: 治理能力落地（precedence/budget/lint/cache）
- `PromptScene` 扩展到 6 场景，并新增 `scheduled_post`。
- `PromptLayers` 扩展 `layer_community/layer_relationship/layer_showrunner`。
- Orchestrator 内落地：
  - 预算表：`forum_post=420/forum_comment=380/chat_room=280/private_chat=420/proactive_dm=220/scheduled_post=420`。
  - trim 顺序：`overrides -> style -> short_term_state -> community_soft -> instructions -> relationship -> persona_traits -> community_hard -> scene_rule`。
  - lint warnings 非阻断，进入 `audit.lintWarnings`。
  - `FF_PROMPT_AUDIT_V1=true` 时输出结构化 `PromptAudit` 元信息日志。

## Phase D: dev render 与可观测
- `/v1/dev/prompts/render` scene 扩展支持 `private_chat/proactive_dm/scheduled_post`。
- dev render 继续返回 `layers + audit + messages`，并补齐新层变量默认值。
- 审计输出保持元信息口径，不写入对话明文与记忆明文。

## Open follow-ups
- staging 灰度顺序按约定执行并观察 audit 日志体量（尤其 `private_chat/proactive_dm`）。
- 若后续出现跨进程命中需求，再评估将 30s 本地缓存升级为共享缓存。

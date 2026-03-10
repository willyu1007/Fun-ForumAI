# 00 Overview — guidance-platform-foundation (T-078)

## Status
- State: planned
- Next step: 冻结 `summary.modules[]`、reason code、actor/state 合同，再进入 schema、repo、API skeleton 和 hook 接线实现。

## Goal
落地 Guidance 平台基础设施子包，提供：
- `guidance_actor_states`、`guidance_inbox`、`guidance_event_log` 三类持久层事实；
- backend `guidance/` 模块、actor resolver、visitor/user merge、track inference、中央文案层；
- `GET /v1/guidance/summary`、`GET /v1/guidance/inbox`、`POST /v1/guidance/client-events`、`POST /v1/guidance/items/:id/action` skeleton；
- `GUIDANCE_UPDATED` SSE、`source_session_id` memories filter、read/control/private-channel/client event 接入矩阵、forum fan-out 和 digest hook 组合接线。

## Non-goals
- 不在本包内实现首页双入口、checklist、inbox 页面或 receipt UI。
- 不在本包内实现 bell 通知或教学型主动召回。
- 不把 Guidance 写进 prompt 层或交给 LLM 决策。

## Context
- repo 已有 `NotificationService`、`ProactiveInteractionService`、`sseHub`、forum event fan-out 与 private digest hook，但 Guidance 仍缺独立策略层和状态事实源。
- `AgentMemory.sourceSessionId` 已存在于 schema 与 repo 类型中，但读 API 尚未暴露 `source_session_id`。
- 首页与私聊页后续都需要消费统一 guidance state，因此 foundation 必须先冻结契约。

## Acceptance criteria (high level)
- [ ] 匿名访客和登录用户都能建立 Guidance actor state，且登录时能合并 visitor 状态。
- [ ] `dedup_key` 相同的 guidance item 只升级不重复插入。
- [ ] `summary.modules[]`、reason code、state merge 和 track inference 规则冻结并进入实现范围。
- [ ] 完整 Guidance 事件接入矩阵冻结：`read-api`、control-plane、private-channel、client events、forum fan-out、digest hook 都有 owner。
- [ ] 中央文案层能统一生成首页、inbox、bell、proactive 所需的 reason-based copy/CTA。
- [ ] guidance API 空态可读可写，不破坏既有 read/control/private-channel 路由行为。
- [ ] `GET /v1/agents/:agentId/memories` 支持 `source_session_id`。
- [ ] 在不覆盖现有 `setEventHook` 和 digest hook 的前提下完成 guidance 接线。

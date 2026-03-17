# 00 Overview — guidance-platform-foundation (T-078)

## Status
- State: done
- Next step: 无；本包已闭环并归档（2026-03-17）。8 条验收已满足，04-verification 场景已全部 [x]。

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
- repo 已有 Guidance 独立策略层与状态事实源（`guidance_actor_states` / `guidance_inbox` / `guidance_event_log`、`guidance/` 模块、`GET /v1/guidance/summary|inbox`、client-events、items/:id/action）。
- `GET /v1/agents/:agentId/memories` 已支持 `source_session_id`；04-verification 场景清单已全部 [x]（2026-03-10 执行记录）。
- 首页与私聊页已消费统一 guidance state（T-079 覆盖）。

## Acceptance criteria (high level)
- [x] 匿名访客和登录用户都能建立 Guidance actor state，且登录时能合并 visitor 状态。（`guidance-state-service.mergeVisitorIntoUser`、`guidance-orchestrator` 调用；04 已勾选 visitor 建档 + visitor->user merge）
- [x] `dedup_key` 相同的 guidance item 只升级不重复插入。（`guidance-state-service` 与 `guidance_event_log` unique；04 已勾选）
- [x] `summary.modules[]`、reason code、state merge 和 track inference 规则冻结并进入实现范围。（`guidance-types.ts`、`guidance-state-service`；04 场景全覆盖）
- [x] 完整 Guidance 事件接入矩阵冻结：`read-api`、control-plane、private-channel、client events、forum fan-out、digest hook 都有 owner。（04 已勾选 read/control/private-channel、forum fan-out、digest hook、GUIDANCE_UPDATED）
- [x] 中央文案层能统一生成首页、inbox、bell、proactive 所需的 reason-based copy/CTA。（`guidance-copy-service`；04 已勾选）
- [x] guidance API 空态可读可写，不破坏既有 read/control/private-channel 路由行为。（`guidance-api` + flag safe no-op；04 已勾选）
- [x] `GET /v1/agents/:agentId/memories` 支持 `source_session_id`。（`private-channel-api` + `memoryService.listMemories`；04 已勾选）
- [x] 在不覆盖现有 `setEventHook` 和 digest hook 的前提下完成 guidance 接线。（04 已勾选 forum fan-out 不覆盖旧 hook、digest 组合调用）

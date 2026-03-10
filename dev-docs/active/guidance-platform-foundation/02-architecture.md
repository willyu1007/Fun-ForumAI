# 02 Architecture

## Boundaries
- Guidance 作为独立 human-facing 子系统存在，不侵入 agent runtime 主干。
- 现有 `NotificationService`、`ProactiveInteractionService`、`sseHub` 是 delivery channel，不是 rules engine。
- v1 规则 deterministic 优先，不允许 LLM 决定 onboarding。

## Data contracts
- `GuidanceActorState`: actor、track、stage、explained/completed/firstSuccess、fatigue/cooldown。
- `GuidanceInbox`: canonical guidance item，支持 `dedup_key` 升级与 status 生命周期。
- `GuidanceEventLog`: client-only 高价值事件和系统事件的去重与处理日志。
- `GuidanceCopyService`: reason code 到 title/body/CTA/payload 的统一生成 contract。

## Interface contracts
- `GET /v1/guidance/summary`
- `GET /v1/guidance/inbox`
- `POST /v1/guidance/client-events`
- `POST /v1/guidance/items/:id/action`
- `GET /v1/agents/:agentId/memories?source_session_id=:sessionId`

## Event ingestion matrix
- `read-api`: `HIGHLIGHTS_VIEWED`、`FEED_VIEWED`、`POST_VIEWED`、`FOLLOWING_FEED_VIEWED`
- control-plane: `AGENT_CREATED`、`AGENT_FOLLOWED`、`ACHIEVEMENTS_VIEWED`、`CHRONICLE_VIEWED`
- private-channel: `PRIVATE_SESSION_CREATED`、`PRIVATE_FIRST_MESSAGE_SENT`、`PRIVATE_SESSION_ENDED`、`PRIVATE_DIGEST_READY`、`MEMORIES_VIEWED`
- client events: `POST_DWELL_20S`、`GUIDANCE_MODULE_VIEWED`、CTA clicks
- fan-out: `OWNER_AGENT_PUBLIC_EVENT`、`FOLLOWED_AGENT_PUBLIC_EVENT`

## Wiring rules
- forum fan-out 只允许“追加 guidance handler”，禁止重新 `setEventHook`。
- private digest 只允许“组合调用”，禁止覆盖 achievements digest hook。
- `T-079` 和 `T-080` 都只能消费 canonical guidance item，不新造平行卡片模型。

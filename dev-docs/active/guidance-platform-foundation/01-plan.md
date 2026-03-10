# 01 Plan — T-078

## Phase 0 Contract Freeze
1. 冻结 `GuidanceActorType`、`GuidanceTrack`、`GuidanceStage`、`GuidanceInboxStatus`。
2. 冻结 v1 reason code 集：`HOME_DUAL_ENTRY`、`FOLLOW_FIRST_AGENT`、`USE_FOLLOWING_FEED`、`START_FIRST_PRIVATE_CHAT`、`NURTURE_RECEIPT_PENDING`、`NURTURE_RECEIPT_READY`、`WATCH_PUBLIC_EFFECT`、`FOLLOWED_AGENT_STORY_ESCALATED`。
3. 冻结 `summary.modules[]` 只包含 `DUAL_ENTRY`、`CHECKLIST`、`CARD`、`RECEIPT`。

## Phase 1 Data Model And Services
1. 新增 guidance 三张表与对应 repo。
2. 新增 `src/backend/guidance/` 模块：
   - `guidance-types.ts`
   - `reason-codes.ts`
   - `rule-registry.ts`
   - `guidance-state-service.ts`
   - `guidance-orchestrator.ts`
   - `guidance-delivery-adapter.ts`
   - `guidance-copy-service.ts`
   - `metrics.ts`
3. 实现 actor resolver、signed visitor cookie、visitor/user merge 和 track inference。

## Phase 2 Event Ingestion Matrix
1. `read-api` 成功分支接入：
   - `/highlights` -> `HIGHLIGHTS_VIEWED`
   - `/feed` -> `FEED_VIEWED`
   - `/posts/:postId` -> `POST_VIEWED`
   - `following_only=true` -> `FOLLOWING_FEED_VIEWED`
2. control-plane 成功分支接入：
   - `POST /agents` -> `AGENT_CREATED`
   - `POST /agents/:agentId/follow` -> `AGENT_FOLLOWED`
   - `GET /agents/:agentId/achievements` -> `ACHIEVEMENTS_VIEWED`
   - `GET /agents/:agentId/chronicle` -> `CHRONICLE_VIEWED`
3. private-channel 成功分支接入：
   - create session -> `PRIVATE_SESSION_CREATED`
   - first message -> `PRIVATE_FIRST_MESSAGE_SENT`
   - end session -> `PRIVATE_SESSION_ENDED`
   - get memories -> `MEMORIES_VIEWED`
4. client-only 高价值事件接入：
   - `POST_DWELL_20S`
   - `DUAL_ENTRY_CTA_CLICKED`
   - `GUIDANCE_MODULE_VIEWED`

## Phase 3 API And Hook Wiring
1. 新增 `src/backend/routes/guidance-api.ts` 并注册到 `/v1`。
2. 扩展 memories route 支持 `source_session_id`。
3. 在 `forumWriteService.setEventHook(...)` fan-out 中追加 guidance public handler。
4. 将 digest hook 改为组合调用，不覆盖 achievements 现有路径。
5. 增加 `GUIDANCE_UPDATED` SSE 事件。
6. 用 `guidance-copy-service.ts` 统一 reason code -> title/body/cta/payload 生成。

## Phase 4 Verification
1. 单测：merge、stage promotion、dedup upgrade、track inference、copy contract。
2. 路由测试：guidance API contract、`source_session_id`、read/control/private-channel 事件接入、hook wiring。
3. 治理校验：feature flags 默认关闭时空态可运行。

## Exit criteria
- Web 子包可以只消费 frozen contract 开始实现。
- Recall 子包可以基于 canonical guidance item 扩展 bell / proactive。

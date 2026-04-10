# 03 Implementation Notes

- 2026-04-07
  - 创建任务包，明确与 `T-144` 的关系为“延伸 write plane / effective contract”，不是 reopen。
  - 接收 `T-941` exit review 的明确 follow-up：
    - `/viewer/*` 写入口必须直接复用 `T-941` 冻结后的 `actual_anchor_turn_id`、`display_parent_id` 相关语义，避免前端或 route 层重新发明 anchor reply 解释。
    - result envelope 与 audit record 需要把 `source_context`、auth context、feature-flag snapshot 一起固化下来，确保后续 `T-944` 消费 viewer feedback/telemetry 时看到的是稳定治理语义，而不是 ad-hoc route side effect。
    - 本包不承担新的 public-safe cue 生产；只负责确保 viewer write 不会绕过 `T-941` 的 visibility-first / non-leakage 边界。

- 2026-04-08
  - 将 `ParticipationContract` / `EffectiveParticipationContract` 切到 nested + versioned 形状，新增 `stage_open_reply` 与 `audience_lane`，并把 `post.moderation_metadata.participation_contract_override_v1` 设为唯一生效 override key；旧 `participation_contract` 仅作为 rollout fallback 读取，并在读取时自动重写到新 key。
  - 新增 `PublicWriteGovernanceService`，把 `CREATE_PUBLIC_THREAD`、`CREATE_PUBLIC_TURN`、`CREATE_AUDIENCE_MESSAGE` 的 contract allow、actor role、feature flag snapshot、risk-event rate limit、moderation mode、audit record、idempotency replay 与 result event 统一到同一条治理链路。
  - `ViewerPublicWriteService` 改为薄协调层；`HumanParticipationService` 与 `AudienceService` 只负责 accepted persistence，不再在 route 或 audience lane 各自复制治理逻辑。
  - `read-api` 新增/完成 `PUT|DELETE /posts/:postId/participation-contract-override`、`POST /viewer/posts/:postId/audience-messages`，并让 legacy `POST /posts/:postId/public-threads`、`POST /threads/:threadId/public-turns`、`POST /posts/:postId/audience-messages` 复用同一 governance result，而不再直读 community rules 做开关判断。
  - `PostDetailPage` 改为只消费 nested effective contract；stage / audience composer 统一按 `ACCEPTED | PENDING_MODERATION | REJECTED | RATE_LIMITED` 做 refetch、清 draft 或保留 draft 处理，不再假设写接口同步返回 hydrated thread/message。
  - `docs/context/api/openapi.yaml`、`api-index.json`、`glossary.json` 已同步 viewer write plane 与 participation contract vocabulary，供 `T-944` 直接消费。
  - 基于 kind + Chrome DevTools 的真实帖子详情验证补了两处收口修复：
    - `PostDetailPage` 将“讨论森林焦点”与“composer 显式锚点”拆开，避免在 `new_thread_enabled=true && turn_reply_enabled=true` 时被 guide/focus 自动选中的节点误导成默认 anchored reply；`清除锚点` 现在只清显式锚点，不再把 focus 一并抹掉。
    - `PublicWriteGovernanceService` 改为先创建 `risk_event_log`、再用真实 `riskEvent.id` 回写 `payload_json.audit_record.audit_id`，确保数据库中的审计载荷与返回给前端的 `audit_id` 一致。
  - 真实 staging rehearsal 还暴露出 dev seed 二次运行时的外键顺序问题：已有 `public_stage_turns` 时，重建 canonical threads 会先删 thread 再删 turn，导致 `POST /v1/dev/seed` 在 kind 复跑时失败。`dev-seed-runner` 已改为 thread reset / stale cleanup 都先 `deleteByThread` 再删 thread，并补了 e2e 回归覆盖“seeded thread 下存在人工 turn 时再次 reseed”场景。

- 2026-04-09
  - 在 `T-946` program closeout 下，`T-943` 的 active owner scope 收窄为三件事：
    - canonical viewer write route ownership
    - accepted-write unified fanout parity
    - legacy public write route compat 收口
  - 论坛主读模型/搜索内部热路径瘦身不再由本包承担，后续移交 `T-948`。

- 2026-04-10
  - 按 `T-943` phase cutover 方案把 canonical viewer write 物理拆出 `src/backend/routes/viewer-write-api.ts`，并新增 `src/backend/routes/viewer-write-shared.ts` 作为 shared controller helper：
    - `/v1/viewer/posts/:postId/public-threads`
    - `/v1/viewer/threads/:threadId/public-turns`
    - `/v1/viewer/posts/:postId/audience-messages`
  - `read-api.ts` 只保留 legacy compat wrappers：
    - `/v1/posts/:postId/public-threads`
    - `/v1/threads/:threadId/public-turns`
    - `/v1/posts/:postId/audience-messages`
    - wrappers 统一走 shared helper + `ViewerPublicWriteService`，只负责返回 legacy hydrated payload，不再手工 `refreshSearchProjectionForWrite(...)`。
  - 新增 shared internal dispatcher `src/backend/services/forum-event-dispatcher.ts` 并在 `container/index.ts` 实际接线：
    - `ForumWriteService.setEventHook(sharedDispatcher)`
    - `ViewerPublicWriteService.setAcceptedForumEventHook(sharedDispatcher)`
    - `ViewerPublicWriteService.setAcceptedAudienceWriteHook(audienceDispatcher)`
  - `ViewerPublicWriteService` 增加 accepted-write hooks，确保 human public thread/turn 在 governance `ACCEPTED` 后复用 `HumanParticipationService` 产出的 `DomainEvent` 进入与 agent/forum write 相同的 fanout 主链。
  - audience message 明确按动作分级收口：
    - 不伪装成 forum thread/turn runtime event
    - 只走最小 accepted-write side-effect matrix；当前落地为 post freshness refresh，保留 audience read / aftershow freshness。
  - runtime/allocator 补丁与本包一并收口：
    - `EventPayload.author_agent_id` 改为可空，并新增 `author_actor_type` / `author_user_id`
    - `EventBridge` 只在 `actor_type=agent` 时把 `event.actor_id` 视作 fallback `author_agent_id`
    - human-authored `THREAD_OPENED` / `THREAD_TURN_ADDED` 保留 human provenance，不再把 `userId` 冒充成 `author_agent_id`
    - admission / candidate selection / recall pair-key 兼容无 `author_agent_id` 的 human forum event；PPR source lookup 与 self-exclusion 在无 source agent 时跳过。
  - active route grep 结果确认：
    - frontend 活路径继续只写 `/viewer/*`
    - legacy `/posts/*/public-threads`、`/threads/*/public-turns`、`/posts/*/audience-messages` 仅保留在 backend compat route 与 tests 中，不再是前端演进入口。
  - Gate 1 review packet — canonical route map:
    | Route family | Ownership | Semantics |
    |---|---|---|
    | `/v1/viewer/posts/:postId/public-threads` | canonical viewer write plane | primary viewer thread creation contract |
    | `/v1/viewer/threads/:threadId/public-turns` | canonical viewer write plane | primary viewer turn reply contract |
    | `/v1/viewer/posts/:postId/audience-messages` | canonical viewer write plane | primary audience-lane write contract |
    | legacy `/v1/posts/:postId/public-threads` / `/v1/threads/:threadId/public-turns` / `/v1/posts/:postId/audience-messages` | compat-only wrappers in `read-api` | keep legacy HTTP shape only; no new fanout or product behavior |
  - Gate 1 review packet — unified fanout matrix:
    | Accepted write kind | Shared dispatcher path | Expected side effects |
    |---|---|---|
    | viewer public thread | `HumanParticipationService -> DomainEvent -> forum-event-dispatcher` | search, event bridge/runtime, SSE, stats, relation, guidance/proactive, downstream forum consumers |
    | viewer public turn | `HumanParticipationService -> DomainEvent -> forum-event-dispatcher` | same as agent/forum thread-turn writes |
    | viewer audience message | `AudienceService -> accepted-audience dispatcher` | post freshness/search refresh only; intentionally not masqueraded as forum stage runtime event |
  - Compat note:
    - legacy wrappers remain hydration bridges only.
    - `/votes/human` route-level `refreshVoteTarget(...)` is recorded in `T-946` as a Phase 1 adjacent cross-pack issue and is not part of the viewer write-plane parity claim.
- 2026-04-10 Compat-removal landing
  - `T-946` compat-removal adjudication reopen 已记录；本次落地不改 frozen semantics，只移除已过审的 compat 面。
  - `read-api.ts` 已彻底删除 legacy public-write wrappers：
    - `/v1/posts/:postId/public-threads`
    - `/v1/threads/:threadId/public-turns`
    - `/v1/posts/:postId/audience-messages`
  - canonical `/viewer/*` route ownership 保持不变；frontend hooks 与 active docs 继续只绑定 `/viewer/*`，legacy 路径不保留 301/302/软转发。
  - `ParticipationContractService` 已删除对 legacy metadata key `participation_contract` 的读时 fallback；active service 现在只认 `participation_contract_override_v1`。
  - 新增 backfill tooling：
    - `pnpm forum:audit:participation-contract-overrides`
    - `pnpm forum:backfill:participation-contract-overrides`
  - 本地 audit 在迁移后的 local Postgres 上返回零遗留 row，因此 fallback 删除不再被数据面阻塞。
  - local-kind live API revalidation 额外确认：
    - seeded `audience_sidecar` post 继续只暴露 audience lane，canonical audience write 返回 `201` 且写后可在 `audience-thread` 读取到新消息。
    - seeded `open_reply` post 继续暴露 stage open reply；canonical `/viewer/threads/:threadId/public-turns` 已在 `reply_allowed=true` 的 soft-close / follow-route thread 上成功写入并保留 anchor turn 语义。
    - 三条 legacy public-write routes 在 live backend 上都返回 `404`，不再存在 compat HTTP alias。

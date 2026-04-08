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

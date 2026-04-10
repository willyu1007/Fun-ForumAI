# 00 Overview — forum-participation-contract-and-viewer-write-plane-v1

## Status

- State: in-progress
- Depends on: `T-144 governance-and-public-participation-cutover`, `T-941 forum-semantic-lifecycle-projection-foundation-v1`
- Current status: canonical `/viewer/*` 写接口、shared dispatcher、accepted-write fanout parity 与治理回归证据都已补齐；legacy public-write wrappers 已从 `read-api` 删除，public write contract 现只剩 `/viewer/*`。
- Next step: keep viewer write-plane semantics stable and prevent alias/fallback reintroduction; any future write-plane change must preserve `/viewer/*` as the only public write contract.

## Goal

把人类公开参与从当前 read router 附属能力，升级为独立的 `Participation Contract + Viewer Public Write Plane + Public Write Governance Plane`，并在 accepted path 上与 agent/forum write 拥有同一基础副作用面。

## Scope Additions From Requirement Coverage Re-check

- 显式承接需求文档里的帖子级 contract override 能力：社区默认之外，owner/admin 可对单帖做 override 和清除。
- 显式增加 rate-limit / moderation / audit / feature-flag snapshot 的治理入口，避免 viewer public write 继续散落在 read router 分支里。
- 结果语义要为 `ACCEPTED` / `PENDING_MODERATION` / `REJECTED` / `RATE_LIMITED` 预留稳定 contract，即使首个 rollout 仍以 auto-approve 为主。
- accepted viewer write 必须进入与 agent/forum write 等价的域事件下游管线，search refresh、runtime bridge、SSE、stats、proactive 不再靠 route 手工补齐。

## Non-goals

- 不在首版完成完整审核队列产品。
- 不重写 audience lane 的底层存储结构。
- 不在本包内重做投诉/申诉后台；这里只负责 viewer public write 的治理接入与审计闭环。
- 不拥有论坛主读模型瘦身；相关 hot path 收口由 `T-948` 负责。

## Acceptance Criteria

- [x] 社区默认与帖子生效 contract 读接口存在。
- [x] `/viewer/posts/{post_id}/public-threads` 与 `/viewer/threads/{thread_id}/public-turns` 已建立。
- [x] `PUT /posts/{post_id}/participation-contract-override` 与 `DELETE /posts/{post_id}/participation-contract-override` 已建立。
- [x] viewer write 输入支持 `idempotency_key`、`source_context`、`actual_anchor_turn_id`、`quoted_excerpt`。
- [x] 帖子详情已依据 effective contract 驱动 audience / stage composer。
- [x] 存在显式 `PublicWriteGovernanceService` 或等价模块，统一负责 allow check、rate limit、moderation、audit record。
- [x] viewer write 结果 contract 固定支持 `ACCEPTED` / `PENDING_MODERATION` / `REJECTED` / `RATE_LIMITED`。
- [x] audit 记录包含 auth context、community role、feature flag snapshot、result、resource ref。
- [x] accepted viewer write 进入与 agent/forum write 等价的 unified fanout / event-hook surface。
- [x] route 层不再承担 projection refresh 等业务 fanout 责任。
- [x] 旧 `/posts/:postId/public-threads`、`/threads/:threadId/public-turns`、`/posts/:postId/audience-messages` 已删除并返回 `404`；新前端与活文档只认 `/viewer/*`。
- [x] feature flag、权限、open-reply、audience lane、审核模式、rate limit、idempotency、audit 等关键治理场景存在稳定回归集。

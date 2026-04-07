# 00 Overview — forum-participation-contract-and-viewer-write-plane-v1

## Status

- State: in-progress
- Depends on: `T-144 governance-and-public-participation-cutover`, `T-941 forum-semantic-lifecycle-projection-foundation-v1`
- Current status: effective contract read endpoints and viewer write plane have started landing; `T-941` exit review 已冻结 lifecycle/anchor/display semantics，因此本包的剩余缺口已收敛到 owner/admin override、显式 governance plane、以及把 write result / audit context 做成唯一可信 contract。
- Next step: extend the contract plane from “可读 + 可写” 到 “可 override + 可治理 + 可审计”，并把 `actual_anchor_turn_id` / `quoted_excerpt` / `source_context` 等冻结语义完整接进 `/viewer/*` 写平面。

## Goal

把人类公开参与从当前 read router 附属能力，升级为独立的 `Participation Contract + Viewer Public Write Plane + Public Write Governance Plane`。

## Scope Additions From Requirement Coverage Re-check

- 显式承接需求文档里的帖子级 contract override 能力：社区默认之外，owner/admin 可对单帖做 override 和清除。
- 显式增加 rate-limit / moderation / audit / feature-flag snapshot 的治理入口，避免 viewer public write 继续散落在 read router 分支里。
- 结果语义要为 `ACCEPTED` / `PENDING_MODERATION` / `REJECTED` / `RATE_LIMITED` 预留稳定 contract，即使首个 rollout 仍以 auto-approve 为主。

## Non-goals

- 不在首版完成完整审核队列产品。
- 不重写 audience lane 的底层存储结构。
- 不在本包内重做投诉/申诉后台；这里只负责 viewer public write 的治理接入与审计闭环。

## Acceptance Criteria

- [ ] 新增社区默认与帖子生效 contract 读接口。
- [ ] 新增 `/viewer/posts/{post_id}/public-threads` 与 `/viewer/threads/{thread_id}/public-turns`。
- [ ] 新增 `PUT /posts/{post_id}/participation-contract-override` 与 `DELETE /posts/{post_id}/participation-contract-override`，支持 owner/admin 调整单帖参与方式。
- [ ] viewer write 输入支持 `idempotency_key`、`source_context`、`actual_anchor_turn_id`、`quoted_excerpt`。
- [ ] 帖子详情能依据 effective contract 驱动 audience / stage composer。
- [ ] 旧接口保留兼容期，但新前端只接 `/viewer/*`。
- [ ] 存在显式 `PublicWriteGovernanceService` 或等价模块，统一负责 allow check、rate limit、moderation、audit record。
- [ ] viewer write 结果 contract 固定支持 `ACCEPTED` / `PENDING_MODERATION` / `REJECTED` / `RATE_LIMITED`；首版即便只走 `ACCEPTED`，也不能把结果语义写死成即时通过。
- [ ] audit 记录包含 auth context、community role、feature flag snapshot、result、resource ref。

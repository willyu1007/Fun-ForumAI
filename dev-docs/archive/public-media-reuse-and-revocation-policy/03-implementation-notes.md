# 03 Implementation Notes

- 2026-03-22: 创建任务包，冻结复用治理和 revoke 默认策略。
- 2026-03-22: 明确默认语义为 “阻断未来使用，不追删已发布内容”。
- 2026-03-22: 对齐需求文档后，将 `platform_canonical` / `community_commons` authoring、cross-agent original quote 边界、origin disclosure 与版权 guardrail 并入本包。
- 2026-03-22: 在 `prisma/schema.prisma` 与 `prisma/migrations/20260322170000_t121_t122_media_governance_generation/migration.sql` 中新增 `media_reuse_policies`，把复用治理从 planner 隐式判断提升为显式持久化。
- 2026-03-22: 新增 `MediaReusePolicyRepository`、`MediaReuseGovernanceService`，实现 asset/projection policy upsert、source-kind 默认矩阵、revoke 立即失效和 queued generation cancel。
- 2026-03-22: `ImagePlannerService` 改为 adapter + policy-first filter，接入 `owner_private_pool`、`self_public_archive`、`same_episode_public`、`community_commons`、`platform_canonical`、`private_runtime_projection`、`generated_public`，并把 selection audit 写入 `selected_sources + planner_audit`。
- 2026-03-22: 新增 admin control-plane routes：`POST /v1/admin/media/platform-canonical/assets`、`POST /v1/admin/communities/:communityId/media/commons/assets`、`PATCH /v1/admin/media/reuse-policies/:policyId`、`POST /v1/admin/media/reuse-policies/:policyId/revoke`。
- 2026-03-22: 复核后修正 `MediaWriteBridge` 的 public/private 边界，`applyImagePlanAfterPersist()` 不再因为 `selected_sources` 把 raw private-origin asset 以 `runtime_only_no_display` 的隐藏 binding 写入 `forum_post`。现在只有真实 display attachment 会创建 public scene binding。
- 2026-03-22: 复核后补齐 planner policy gate，`allow_private_inspired_generation=false` 时不会对私域候选创建 generation plan；`sync_generation_ms_budget=0 && async_generation_allowed=false` 时不会错误排异步 generation。

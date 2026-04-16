# 00 Overview — staging-release-verification-followup

## Status

- State: planned
- Depends on: `T-156 staging-public-forum-warmup-governance-v1` Gate 4, `T-973 media-injection-catalog-and-retrieval-v1`, immutable image publish, staging env injection, operator approval
- Current status: repo-side warm-up/governance lifecycle 已落地；`T-973` 的 media injection/retrieval 主链也已在 local-kind + real PG/pgvector + DashScope 下闭环。本包不再沿用旧 `T-952` 直接 warm-start 叙事，而是承接真实 staging 上两类待验证项：
  - candidate -> review -> activation -> readiness -> growth admitted
  - media injection / retrieval / duplicate suppression / planner retrieval 的真实 staging 执行与证据采集
- Next step: 先按 [02-operator-checklist.md](/Users/phoenix/Desktop/project/Fun-ForumAI/dev-docs/active/staging-release-verification-followup/02-operator-checklist.md:1) 锁定 staging image ref、operator inputs 和 media feature flags/env render 结果，然后按新 lifecycle 执行真实 staging。

## Goal

Verify the real staging release for the warm-up/governance package and the new media injection/retrieval mainline: published immutable image, ECS web rollout, worker startup without admitted growth, candidate kickoff/warmup generation, admin review/activation, readiness verification, media import/retrieval execution on true cloud topology, and rollback evidence.

## Non-goals

- Do not reopen repo-side warm-up/governance implementation unless staging rollout exposes a concrete blocker.
- Do not reopen `T-973` repo-side schema / repository / service design unless real staging exposes a concrete blocker.
- Do not roll prod in this bundle.
- Do not broaden scope into unrelated staging issues that are not on the critical path to cutover verification; media checks here are limited to release-critical runtime parity, not new feature expansion.

## Context

- `T-156`/`T-157`/`T-158`/`T-159` 已完成 repo-side implementation 与本地验证。
- `T-973` 已完成 schema / worker / CLI / retrieval / planner 接线、真实 PG + pgvector migration、local-kind 大样本回归与 planner 质量回归，但当前仍缺真实 staging 证据。
- worker 现在可以先启动，但只有 active baseline admission 通过后才允许自治 public growth。
- local-kind 证明了 media 功能逻辑成立，但仍不能等价替代真实 staging：
  - staging API / worker 运行在 `ecs` / `aliyun-eci-container-group` 拓扑，而不是 retained local-kind K8s
  - staging media storage 走真实 `s3` backend，而不是本地 PVC / `MEDIA_LOCAL_DIR`
  - staging 是 `NODE_ENV=production` + Redis queue/leader/broadcast，而不是 local-kind 的 development baseline
- 剩余工作是 staging 环境执行与证据采集，不是 repo-side 语义重构。

## Acceptance Criteria

- staging immutable image ref is recorded and matches the release intent
- ECS web deploy and same-host worker startup both run against the same immutable image
- worker startup completes with `allow_public_growth=false` before activation
- candidate kickoff + warmup suite is created on staging
- admin review + activation completes and yields an active baseline
- `verify:launch:staging` passes only after activation
- staging rendered env and runtime logs confirm `FF_MEDIA_INJECTION_V1`, `FF_MEDIA_RETRIEVAL_V1`, and `FF_MEDIA_PLANNER_RETRIEVAL_V1` are enabled as intended
- a real staging media import job completes on cloud topology with `PG authoritative + OSS artifact` outputs and no ECS/ECI claim or heartbeat drift
- real staging media storage path proves `staging -> canonical` promote / retrieval / cleanup against the true `s3` backend
- a real staging retrieval path produces `searchable` snapshots and returns scoped hits without leaking private docs into public-safe retrieval
- planner retrieval on staging proves "retrieval off -> legacy candidate", "retrieval on -> semantic canonical target" without duplicate-cluster drift
- runtime growth admission evidence and rollback notes are captured

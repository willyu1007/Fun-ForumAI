# 00 Overview — staging-release-verification-followup

## Status

- State: planned
- Depends on: `T-156 staging-public-forum-warmup-governance-v1` Gate 4, immutable image publish, staging env injection, operator approval
- Current status: repo-side warm-up/governance lifecycle 已落地；本包不再沿用旧 `T-952` 直接 warm-start 叙事，而是只负责真实 staging 上的 candidate -> review -> activation -> readiness -> growth admitted 验证。
- Next step: 锁定 staging image ref 和 operator inputs，然后按新 lifecycle 执行真实 staging。

## Goal

Verify the real staging release for the warm-up/governance package: published immutable image, ECS web rollout, worker startup without admitted growth, candidate kickoff/warmup generation, admin review/activation, readiness verification, and rollback evidence.

## Non-goals

- Do not reopen repo-side warm-up/governance implementation unless staging rollout exposes a concrete blocker.
- Do not roll prod in this bundle.
- Do not broaden scope into unrelated staging issues that are not on the critical path to cutover verification.

## Context

- `T-156`/`T-157`/`T-158`/`T-159` 已完成 repo-side implementation 与本地验证。
- worker 现在可以先启动，但只有 active baseline admission 通过后才允许自治 public growth。
- 剩余工作是 staging 环境执行与证据采集，不是 repo-side 语义重构。

## Acceptance Criteria

- staging immutable image ref is recorded and matches the release intent
- ECS web deploy and same-host worker startup both run against the same immutable image
- worker startup completes with `allow_public_growth=false` before activation
- candidate kickoff + warmup suite is created on staging
- admin review + activation completes and yields an active baseline
- `verify:launch:staging` passes only after activation
- runtime growth admission evidence and rollback notes are captured

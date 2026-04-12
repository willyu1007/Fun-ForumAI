# 00 Overview — runtime-baseline-admission-and-launch-gate-v1

## Status

- State: done
- Governance mapping: 暂挂 `F-000 Inbox / Untriaged`；本包是 `T-156` 的 runtime / verification 子包。
- Depends on: `T-156 staging-public-forum-warmup-governance-v1`, `T-157 warm-start-candidate-review-promote-v1`
- Current status: `RuntimeLoop` 已绑定 `active_baseline` 准入；worker 可启动但无 baseline 不得产生自治 public growth；`/v1/admin/runtime/stats`、runbook 与 `verify:launch:staging` 已收敛到同一 activation 叙事。
- Next step: 归档本包；真实 staging 继续由 `T-954` 消费该合同。

## Goal

让 runtime 和 staging 发布校验切换到“active baseline first”的正式叙事，包括：

- runtime 生产资格绑定 active baseline
- warm-up top-up lineage 继承
- launch/staging verification 更新
- runbook 顺序更新

## Non-goals

- 本包不创建 candidate suite/batch 或 activation API。
- 本包不负责 batch/slice governance UI。
- 本包不做聊天室 runtime 或房间治理。

## Context

- 当前 `startBackgroundServices()` 看到 `RUNTIME_ENABLED=true` 就会启动 runtime loop。
- 当前 `RuntimeLoop` 在 queue backlog 为 0 时就允许 `postScheduler.createPost()` 增量生产。
- 当前 `verify:launch:staging` 直接检查 `/v1/home`、`/v1/feed` 的可见供给，没有 review/activation 口径。

## Acceptance Criteria

- runtime 增量生产必须要求 `has_active_baseline=true`。
- warm-up 触发的 top-up 产物必须继承同一批次 lineage，而不是掉到普通 runtime 内容。
- `verify:launch:staging` 能校验 candidate/review/activation 后的新主链。
- runbook 更新为：
  - deploy
  - worker startup without growth
  - candidate warm-up
  - review/activation
  - readiness verification
  - runtime growth enabled

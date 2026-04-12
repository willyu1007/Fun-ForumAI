# 00 Overview — warm-start-candidate-review-promote-v1

## Status

- State: done
- Governance mapping: 暂挂 `F-000 Inbox / Untriaged`；本包是 `T-156` 的 backend 主链子包。
- Depends on: `T-156 staging-public-forum-warmup-governance-v1`
- Current status: `launch:warm-start` 已切到 candidate suite；`warmup_suites`、`warm_start_batches`、`warmup_suite_reviews`、`active_baselines`、suite list/detail/admin actions 与 activation 幂等均已落地。
- Next step: 归档本包；runtime / UI 下游合同已由 `T-158` / `T-159` 消费。

## Goal

把现有 `launch:warm-start` 升级为正式的 candidate warm-up executor，并补齐：

- `WarmStartBatch`
- content lineage fields
- batch summary/read API
- review decision
- activation
- `ActiveBaseline`

## Non-goals

- 本包不负责 runtime admission guard 和 verify/staging smoke 脚本改造。
- 本包不负责 batch/slice governance preview/execute。
- 本包不负责完整 admin UI；只负责支撑 UI 的 backend contract。
- 本包不扩展到聊天室/私聊。

## Context

- 公开读面当前只认 `APPROVED + PUBLIC/GRAY`，这为 candidate 隔离提供了硬基础。
- `launch:warm-start` 已走真实 `ForumWriteService.createPost()` 链路，不能退回 seed/mock。
- `ForumWriteService` 的事件与 scene side effects 在写入时即固化，因此 candidate 语义最好在写入期生效，而不是事后 patch。

## Acceptance Criteria

- 新增 `warmup_suite` / `WarmStartBatch` / review record / `ActiveBaseline` 的数据模型与仓库接口。
- post / thread / turn / 相关 projection 至少具备 `warm_start_batch_id`、`generation_mode` 等最小 lineage 能力。
- `launch:warm-start` 能创建 `state=PENDING` 的 candidate 批次，而不是直接创建公开基线。
- 支持 suite summary 查询、review decision、activation，并且 activation 幂等。
- activation 后形成唯一 active baseline，供 runtime 和 staging verification 使用。

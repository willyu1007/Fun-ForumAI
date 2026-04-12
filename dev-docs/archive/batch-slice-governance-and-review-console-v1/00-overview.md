# 00 Overview — batch-slice-governance-and-review-console-v1

## Status

- State: done
- Governance mapping: 暂挂 `F-000 Inbox / Untriaged`；本包是 `T-156` 的 governance/control-plane 子包。
- Depends on: `T-156 staging-public-forum-warmup-governance-v1`, `T-157 warm-start-candidate-review-promote-v1`
- Current status: `governance_batches` preview/execute、suite review actions、Warm-up admin tab、suite summary/detail、coverage/density/media stats、samples、`pass_to_active` confirm 和 `not_passed` 结构化原因均已接入现有 admin panel。
- Next step: 归档本包；后续仅在 `T-954` 暴露 staging 现场阻塞时再回到 repo-side UI。

## Goal

交付 staging public forum v1 的最小治理和人工 review 控制面，包括：

- governance batch/slice preview/execute
- review suite list/detail/read model
- review/retry/rebuild/quarantine 入口
- 最小 admin UI

## Non-goals

- 本包不负责 `WarmStartBatch` / `ActiveBaseline` 主模型定义。
- 本包不做高级运营工作台、自动打分或自动治理建议。
- 本包不覆盖聊天室治理。

## Context

- 当前 `GovernanceAdapter` 的动作是单目标导向，适合单帖/单 turn，不适合整批/切片。
- 当前 admin 已有 programming ops、runtime stats、hot-topic dashboard，可复用为 control-plane 风格基底。
- 用户已明确：本轮不仅要有上线前检验，也要有上线后的删除/治理基础能力。

## Acceptance Criteria

- 新增 `GovernanceBatch` 与 slice preview/execute contract。
- 支持按 batch/run/agent/community/time-window 做最小 preview 和执行。
- 支持最小动作集：
  - `quarantine`
  - `archive`
  - `restore`
- admin UI 至少支持：
  - warm-up suite 列表
  - suite detail summary
  - kickoff / warmup layer summary
  - community coverage / content density stats
  - media coverage stats
  - sample content review
  - review decision（通过 / 不通过）/ retry / rebuild
  - `not_passed` 时的结构化原因选择 + 可选备注
  - governance slice preview / execute

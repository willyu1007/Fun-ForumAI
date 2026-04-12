# 00 Overview — staging-public-forum-warmup-governance-v1

## Status

- State: done
- Governance mapping: 暂挂 `F-000 Inbox / Untriaged`；该总包用于冻结设计、拆分实施子包，并为后续 `T-954 staging-release-verification-followup` 提供前置能力。
- Depends on: `/Users/yurui/Downloads/staging_warmup_governance_design_v1.md`、现有 `launch:warm-start` / `verify:launch:staging` / admin runtime ops 基线
- Current status: `T-157`/`T-158`/`T-159` 已完成并经本地 + local-kind 回归收口；candidate suite lifecycle、review/activation/active baseline、runtime baseline admission、verify/runbook、最小 admin review/governance UI 已形成闭环。
- Next step: 归档本总包；真实 staging 执行继续由 `T-954 staging-release-verification-followup` 承接。

## Goal

把 staging 灰度前的公共论坛面内容生命周期从“直接 warm-start + 直接 runtime + 事后治理”升级为“candidate warm-up suite -> 人工 review -> activation -> active baseline -> runtime 增长 -> batch/slice governance”的正式机制。

## Non-goals

- 本轮不开放聊天室功能，灰度范围仅覆盖论坛公共面。
- 本轮不为聊天室、私聊、private session、memory baseline 建立正式 warm-up 批次。
- 本轮不引入候选层/正式层的物理分表体系。
- 本轮不追求自动评分、全自动治理或复杂策略引擎。
- 本轮不直接执行真实 staging 发布；真实环境验证仍由 `T-954` 承接。

## Scope Freeze

- 灰度范围仅包含论坛公共面：community / feed / post / thread / turn / vote / home / highlights。
- 本轮必须包含最小 batch/slice governance；删除/治理功能既服务上线前检验，也服务上线后运营。
- 本轮必须提供最小 admin UI 人工点审界面；CLI-only 不满足最终交付口径。

## Context

- 当前 `launch:warm-start` 已走真实 `forumWriteService.createPost()` 写链路，但直接生产可见内容，缺少正式 candidate 生命周期。
- 当前公共读面只读 `APPROVED + PUBLIC/GRAY`，因此仓库具备 candidate 隔离的硬基础。
- 当前 `LaunchProgrammingOpsService` 已能提供 `visual_ratio_ok` 和 `aftershow_pipeline_ok`，但 warm-start 验收尚未纳入这些信号。
- 当前 runtime 只受 `RUNTIME_ENABLED` 和 LLM 可用性控制，没有 `active baseline` 业务门禁。
- 当前治理已有 `GovernanceAdapter`、hot-topic dashboard 和 admin moderation action，但仍偏单目标操作。

## Acceptance Criteria

- 总包给出一份可执行的 `roadmap.md`，明确 workstream、子包边界、先后顺序、前后依赖和 staging 发布衔接点。
- 子包完整覆盖：
  - candidate warm-up suite lifecycle
  - review / activation / active baseline
  - runtime admission guard 与 launch verification 更新
  - batch/slice governance
  - 最小 admin review / governance UI
- 总包明确冻结三项产品决策：
  - 仅论坛公共面
  - Phase A + 最小治理闭环
  - 最小 admin UI 人工点审

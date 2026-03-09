# 00 Overview — persona-observability-eval-v1 (T-066)

## Status
- State: done
- Next step: `T-070 persona-rollout-shadow-review` 承接带 `migrated_visible` 的真实样本、blind review、staging shadow logging 与非 `not_run` gate verdict。

## Goal
定义人格/声线/provider 的观测、评测与灰度门槛，让后续实现具备可解释、可归因、可回滚的质量控制。

## Non-goals
- 不在本包内完成 blind review 实填、staging shadow logging 或 rollout 最终 verdict。
- 不定义 persona contract 或 routing contract 本身。
- 不替代 `T-070` 的 rollout evidence execution。

## Context
当前 repo 中已有 prompt audit、runtime feature metrics、model latency log 等局部能力，但尚不足以系统回答：
- 为什么这次用了这条 line/tier/model
- 为什么人格漂移
- 哪条 line 更适合哪个 seed

## Acceptance criteria (high level)
- [x] 冻结 render log schema 与最小必填字段。
- [x] 冻结 blind review rubric 与 offline replay/eval set 规范。
- [x] 冻结 rollout gate、rollback trigger 与失败归因口径。
- [x] 明确与 `T-064/T-065` 的 contract 依赖关系。
- [x] 将观测合同接入 `agent_runs`、`GET /v1/admin/runtime/features` 与 `GET /v1/agents/:agentId/runs`。
- [x] 将 blind review / shadow logging / rollout verdict 拆分到独立 follow-up 任务，避免 `T-066` 长期停留在假 `in-progress`。

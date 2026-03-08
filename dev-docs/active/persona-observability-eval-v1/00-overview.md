# 00 Overview — persona-observability-eval-v1 (T-066)

## Status
- State: planned
- Next step: 冻结 render log schema、eval rubric 与 rollout gate 表。

## Goal
定义人格/声线/provider 的观测、评测与灰度门槛，让后续实现具备可解释、可归因、可回滚的质量控制。

## Non-goals
- 不实现 telemetry、dashboard 或 eval pipeline。
- 不定义 persona contract 或 routing contract 本身。

## Context
当前 repo 中已有 prompt audit、runtime feature metrics、model latency log 等局部能力，但尚不足以系统回答：
- 为什么这次用了这条 line/tier/model
- 为什么人格漂移
- 哪条 line 更适合哪个 seed

## Acceptance criteria (high level)
- [ ] 冻结 render log schema 与最小必填字段。
- [ ] 冻结 blind review rubric 与 offline replay/eval set 规范。
- [ ] 冻结 rollout gate、rollback trigger 与失败归因口径。
- [ ] 明确与 `T-064/T-065` 的 contract 依赖关系。

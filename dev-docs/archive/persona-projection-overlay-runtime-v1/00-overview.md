# 00 Overview — persona-projection-overlay-runtime-v1 (T-065)

## Status
- State: done
- Next step: `T-070 persona-rollout-shadow-review` 将消费 runtime floor / overlay 命中 / writeback 漂移样本做 blind review 与 gate snapshot；本包范围内无未决实现项。

## Goal
定义 persona projection、overlay runtime 与 render tier 规则，让现有 prompt/orchestrator 主链路可以承接稳定人格与短期波动。

## Non-goals
- 不改 provider 真实切换 / model routing authority。
- 不新增 owner-facing API 或 UI。
- 不回收 T-066 的观测评测与 gate 逻辑。

## Outcome Snapshot
- 冻结 `PersonaVector / PersonaState / OverlayTemplate / ActiveOverlay` 接口。
- 冻结 projection 顺序与 relation state 分离规则。
- 冻结 overlay 激活、TTL、cooldown、sampling 与 writeback 政策。
- 为六条 visible path 产出固定 integration plan 并接入实现。

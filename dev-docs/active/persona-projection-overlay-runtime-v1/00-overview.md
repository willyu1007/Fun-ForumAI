# 00 Overview — persona-projection-overlay-runtime-v1 (T-065)

## Status
- State: planned
- Next step: 冻结 persona axes、overlay lifecycle 和六场景 integration matrix。

## Goal
定义 persona projection、overlay runtime 与 render tier 规则，让现有 prompt/orchestrator 主链路可以承接稳定人格与短期波动。

## Non-goals
- 不实现 runtime 代码。
- 不定义 provider routing/profile 或 render log schema。

## Context
当前 repo 中：
- `PromptLayerService` 已能把 style/traits/instructions/memory 注入 prompt；
- `PromptOrchestrator` 已支持 `shortTermState`、`sceneRule`、budget/trim/audit；
- `stats` 既影响 prompt 又影响 chat tick；
- 但目前没有统一 `persona_vector`、stateful overlay 或 tier floor 规则。

## Acceptance criteria (high level)
- [ ] 冻结 `PersonaVector / PersonaState / OverlayTemplate / ActiveOverlay` 接口。
- [ ] 冻结 projection 顺序与 relation state 分离规则。
- [ ] 冻结 overlay 激活、TTL、cooldown、sampling 与 writeback 政策。
- [ ] 为六条 visible path 产出固定 integration plan。

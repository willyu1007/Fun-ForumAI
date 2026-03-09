# 00 Overview — persona-projection-overlay-runtime-v1 (T-065)

## Status
- State: implemented
- Next step: 联动 T-066 观测评测，把 runtime floor / overlay 命中 / writeback 漂移纳入评测与灰度看板。

## Goal
定义 persona projection、overlay runtime 与 render tier 规则，让现有 prompt/orchestrator 主链路可以承接稳定人格与短期波动。

## Non-goals
- 不改 provider 真实切换 / model routing authority。
- 不新增 owner-facing API 或 UI。
- 不回收 T-066 的观测评测与 gate 逻辑。

## Context
当前 repo 中：
- `PromptLayerService` 已能把 style/traits/instructions/memory 注入 prompt；
- `PromptOrchestrator` 已支持 `shortTermState`、`sceneRule`、budget/trim/audit；
- `stats` 既影响 prompt 又影响 chat tick；
- 但目前没有统一 `persona_vector`、stateful overlay 或 tier floor 规则。
- `T-066` 已开始消费 runtime 侧观测字段，因此本包需要预留 `active_overlay_id / overlay_cause / overlay_rng_seed / drift_score / tier_floor / tier_floor_reason` 的合同位置。

## Acceptance criteria (high level)
- [x] 冻结 `PersonaVector / PersonaState / OverlayTemplate / ActiveOverlay` 接口。
- [x] 冻结 projection 顺序与 relation state 分离规则。
- [x] 冻结 overlay 激活、TTL、cooldown、sampling 与 writeback 政策。
- [x] 为六条 visible path 产出固定 integration plan 并接入实现。

## Delivered
- Prisma SSOT 已新增 `AgentPersonaState`、`AgentActiveOverlay`、`AgentPersonaDeltaLog`，并补 repo migration 资产。
- 已实现 `persona-projector`、`overlay-engine`、`render-tier-policy`、`persona-state-service`。
- `PromptLayerService` / `PromptOrchestrator` 已消费统一 runtime envelope，支持 projection、overlay short-term state、critical scene rule 和 cache salt。
- 六条可见路径已接线：
  `AgentExecutor`、`ConversationClock`、`PrivateChannelService`、`ProactiveInteractionService`、`PostScheduler`、`ContextBuilder`。
- owner 写回已接入 style pin / trait equip-unequip / instruction mutation / private digest。

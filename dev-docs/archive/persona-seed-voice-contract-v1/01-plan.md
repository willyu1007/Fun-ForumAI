# 01 Plan — T-063

## Phase 0 Contract Table
1. 定义 `PersonaSeed` 字段表，逐项覆盖 `publicMask/privateDrive/baselineVector/starterTraits/starterInstructions/starterStyleProjection/volatilityBias/compatibleVoiceLines`。
2. 定义 seed 生命周期规则：baseline immutable、`seedReflections[]` append-only、`driftScore` 语义。
3. 定义 `PersonaState`、`PersonaMaturity`、`RareReanchorPolicy`。

## Phase 1 Voice Contract Freeze
1. 定义 `AgentVoiceConfig` 与 `VoiceLineCatalog` 的字段分工，覆盖 `homeVoiceLineId`、`locked`、`selectedAt`、`identityWriteTier`、tier profile refs、migration policy。
2. 定义 visible/hidden policy、identity-write eligibility、rare reanchor、max migrations。

## Phase 2 Authority and Migration
1. 定义 config state / runtime state 的落点与权威来源。
2. 定义旧字段到新契约的映射、废弃与保留策略。
3. 明确当前创建向导 style 模板如何映射为 seed 输入与 owner pins。

## Phase 3 Downstream Handoff
1. 为 `T-064` 固定 voice/tier/profile 的前置约束。
2. 为 `T-065` 固定 vector/overlay 可依赖的 authority contract。

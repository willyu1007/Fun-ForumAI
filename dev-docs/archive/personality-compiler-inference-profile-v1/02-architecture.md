# 02 Architecture

## Boundaries

- `PersonaState` 仍是长期人格权威状态；`AgentInferenceProfile` 仅保存派生治理状态。
- `home_voice_line` 仍由身份契约持有；rare reanchor 生效时才写回身份契约。
- compile 结果不得进入 prompt 主文本，只允许进入 routing、observability、admin/debug。

## Key interfaces and contracts

- `TemperamentAxes = warmth | spine | spark | composure | depth | stageAffinity`
- `InferenceSignals = risk | initiative`
- `AgentInferenceProfile` 保存 incumbent/challenger family、challenger voice line、migration state、freeze/lock 和最近 snapshot。
- `AgentInferenceShadowReview` 保存 shadow compare 的 evidence window、review case、compare dimensions、collect/approve/reject 状态；它不改写身份契约，只为 rare reanchor 提供审批依据。
- `ProviderAdmissionPool` 按 `voice_line_id` 建模 visible provider/model 候选，使用 `admitted | shadow | blocked` 明确准入状态。
- visible routing 决策必须同时消费：
  - identity contract 中的 `homeVoiceLineId`
  - runtime `renderTierDecision`
  - compiler profile 的 tier floor / pin / migration state
  - provider admission pool 的 admitted-only 候选过滤结果

## Shadow compare lifecycle

- `start_shadow_review`：冻结一个 evidence window 起点，记录 incumbent/challenger 与当前 snapshot。
- `collect_shadow_review`：读取 window 内 usage ledger / observability / fallback evidence，生成 compare dimensions 和 recommendation。
- `approve_shadow`：仅当 review 已 `collected` 且 recommendation 为 `approve` 时允许 rare reanchor；生效单位是 `home_voice_line` 写回身份契约。
- `block_challenger` / `set_manual_lock`：会把活跃 review 标记为 rejected，并冻结或锁定后续迁移。

## Test/runtime compatibility

- growth gate 依赖 XP，而不仅依赖 stats；因此非 Prisma 环境也需要可用的 `XpService` 实现，避免 compiler 在测试/本地 runtime 中永久停留在 `growth_locked`。

## Compatibility strategy

- 所有新增 payload 字段保持 optional；旧调用方按“有则使用、无则回退”。
- `agent.model` 保持兼容/debug pin 角色，不再恢复为人格主字段。

## Risks

- compiler 与 overlay 语义重叠。
- owner 面暴露过多调试术语，破坏养成感。
- migration state 写回 config 时产生并发漂移。
- provider admission registry 与 model profiles 漂移，导致 visible voice line 没有可用 admitted 候选。

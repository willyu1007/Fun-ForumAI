# 02 Architecture — T-063

## Boundaries
- 本包定义“谁是这个 agent”的权威契约。
- provider/model 的解析链路不在本包内实现，但本包定义其上游输入 `homeVoiceLineId`。
- prompt 层只消费本包产出的 contract，不反向定义 contract。

## Contract areas to freeze
- `AgentPersonaConfig`
  - `personaSeed`
  - `voice`
  - `ownerStylePins`
- `AgentPersonaRuntime`
  - `state`
  - `activeOverlay`
  - `lastRenderDecision`
- `VoiceLineCatalog`
  - line id
  - line version
  - visible vs hidden policy
  - identity-write eligibility
  - tier profile refs
- `PersonaSeed`
  - `seedCode`, `seedVersion`, `displayName`
  - `publicMask`
  - `privateDrive`
  - `baselineVector`
  - `starterTraits`, `starterInstructions`, `starterStyleProjection`
  - `volatilityBias`, `compatibleVoiceLines`
- `AgentVoiceConfig`
  - `homeVoiceLineId`
  - `locked`
  - `selectedAt`
  - `identityWriteTier`
  - `migrationPolicy`

## Authority rules
- Authority order:
  1. `persona_seed`
  2. `home_voice_line`
  3. `persona runtime state`
  4. projection / pin layers
- Legacy fields:
  - `agent.model`: migration input only
  - `config_json.persona`: normalized into new persona config
  - `style`: normalized into projection / owner pins

## Lifecycle invariants to freeze
- `persona_seed` is create-only for baseline semantics.
- `seedReflections[]` is append-only and cannot overwrite `baselineVector`.
- `rare_reanchor` must preserve previous seed and voice history.
- `driftScore` belongs to runtime state, not versioned config.

## Risks
- 若 authority 顺序不清晰，`T-064` 会继续保留 raw model 旁路。
- 若 `VoiceLineCatalog` 不冻结 visible/hidden 边界，director line 容易误入 visible generation。

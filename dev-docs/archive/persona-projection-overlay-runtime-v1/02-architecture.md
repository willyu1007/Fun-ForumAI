# 02 Architecture — T-065

## Boundaries
- 本包定义人格运行时规则，不定义 provider 解析链或 render log 归档。
- 本包依赖 `T-063` 的 config/runtime authority contract。
- 本包输出的 runtime 规则将被 `T-064` 的 gateway 和 `T-066` 的评测/观测消费。

## Runtime layers to freeze
- Long-term:
  - `PersonaVector`
  - `PersonaState`
  - `PersonaMaturity`
- Short-term:
  - `OverlayTemplate`
  - `ActiveOverlay`
  - prompt atoms / sampled atoms
  - `cause`
  - `rngSeed`
- Request-scoped:
  - scene integration inputs
  - render tier floors

## Integration principles
- `persona_traits` 承载长期人格核心摘要。
- `style` 只承载 projection / owner pin。
- `shortTermState` 承载 overlay 文本化状态。
- `sceneRule` 承载 critical state 或场景硬规则。
- overlay TTL 不得等于 prompt cache TTL。

## Default constants to freeze
- `overlayDefaultTtlTurns = 4`
- `overlayMaxTtlMinutes = 45`
- `sameOverlayCooldownMinutes = 20`
- `normalOverlayTriggerCap = 0.35`
- `highVolatilityTriggerCap = 0.60`
- `chatRoomShortTermStateMaxChars = 60`
- `forumCommentShortTermStateMaxChars = 90`
- `privateChatShortTermStateMaxChars = 120`
- `sceneRuleMaxChars = 45`

## Reproducibility requirements
- activation score inputs must be explicit: seed volatility, vector stability, recent tension, scene pressure, social shock, novelty, cooldown penalty.
- overlay activation must persist `rngSeed`.
- sampled prompt atoms must be reproducible from persisted state.

## Risks
- 若 projection 与 owner pins precedence 不清晰，style 仍会反向污染人格本体。
- 若 scene integration matrix 不完整，六条 visible path 会继续各自解释 overlay/tier 语义。

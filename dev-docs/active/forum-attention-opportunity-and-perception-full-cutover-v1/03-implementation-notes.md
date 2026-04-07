# 03 Implementation Notes

- 2026-04-07
  - 创建任务包，明确首版会以“真实接管 + 明确回退门”为实施方式，而不是长期 shadow-only。
  - 接收 `T-941` exit review 的明确 follow-up：
    - pack1 已提供 `ThreadCapsule` / `PostSemanticCapsule` / `RuntimeContextEnvelope` 的稳定入口，本包不得重新散读 raw thread detail 或私域字段来推导演机会。
    - `public_persona_cues` / `public_growth_cues` 当前已能在真实样本中稳定返回 `PUBLIC_BIO` / `PUBLIC_PROJECTION` / `PUBLIC_PROOF`；本包负责定义这些 cues 如何影响“谁更容易被吸引进入”，而不是扩展 cue 来源。
    - `T-942` 的 viewing telemetry 与 `T-943` 的 write/audit semantics 被视为本包 cutover 前置输入，缺失时只能停在 compare/debug，不得直接 full cutover。

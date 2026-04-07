# 01 Plan — badge-semantic-sot-and-surface-usage-governance-v1

1. 建立 task bundle 并同步 project governance，挂到 `F-100 / M-030`，显式记录依赖 `T-145 / T-146`。
2. 收口 shared semantic contract：
   - `AgentPublicIdentity.identity_badges`
   - compat-only field annotations
   - shared surface policy definitions
3. 收口 backend/public author projection：
   - 从 semantic identity badges 派生 compat `display_badges`
   - profile/read/search/forum 输出统一 contract
4. 收口 frontend helper：
   - semantic selector
   - compat adapter
   - structured badge slots
5. 扩展 dev debug：
   - semantic SoT 字段
   - compat derivation state
   - surface policy introspection
6. 补 targeted tests、typecheck、governance sync/lint，并回写 verification。

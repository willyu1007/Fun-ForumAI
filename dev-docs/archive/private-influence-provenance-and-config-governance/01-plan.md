# 01 Plan — T-090

1. 新增 `public_disclosure_cap_overrides` 持久层与统一 cap resolution service。
2. 给 `PromptLayerService` / `ContextBuilder` / `PromptOrchestrator` public scene 接入 agent/community/runtime clamp，并把 provenance 扩到 server-cap source list。
3. 在 `PolicyGatewayService` 增 owner spillover guard，命中 `owner_private_leak` / `owner_endorsement_public` 时记录 risk event/case 并自动压帽。
4. 将 `AgentConfigLintService` 升级为语义拒绝规则，明显隐私绕过 patch 直接 `REJECTED`，不再进入人工待审。
5. 扩 admin risk profile、disclosure-cap API 与 AdminPanel 最小运营入口。

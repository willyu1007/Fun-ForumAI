# 05 Pitfalls

- 不要把外部 gap report 的措辞直接当成 repo 事实；先沿真实 `PromptOrchestrator -> PromptEngine -> LLMGateway` 主路径确认 visible scenes 到底消费的是 legacy layers 还是 compiled blocks。
- 不要把 sign-off evidence 缺口和 runtime defect 缺口混在同一个任务里；前者应该由 `T-905` 这类验收包承担，后者应该外提成独立 remediation task。

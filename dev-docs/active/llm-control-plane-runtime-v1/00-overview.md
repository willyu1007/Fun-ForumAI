# 00 Overview — llm-control-plane-runtime-v1 (T-068)

## Status
- State: in-progress
- Next step: 当前 PR 稳定化已完成；等待合并并在后续 rollout / runtime 观测中继续消费 control-plane 指标。

## Goal
实现 LLM Control Plane runtime，使 provider/key/budget/fallback/cost 由统一网关管理，而不是散落在业务层。

## Non-goals
- 不新增控制台 UI。
- 不重新定义 `T-064` contract。
- 不在本包内实现 Context Plane typed stores。

## Acceptance criteria (high level)
- [x] env contract 改为 `secret: true + secret_ref`。
- [x] 存在 `SecretResolver`、`CredentialBroker`、`LLMGateway`、`UsageLedgerWriter`、`BudgetGuard`。
- [x] visible/private/proactive/scheduled/hidden digest 路径不再直接依赖全局 `config.llm`。

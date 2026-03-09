# 01 Plan — T-068

## Phase 0 Secret Contract
1. 修正 env contract / values / secret refs。
2. 生成 `env/.env.example`、`docs/env.md`、`docs/context/env/contract.json`。

## Phase 1 Control Plane Services
1. 引入 credential pool 与 routing policy registry。
2. 实现 `SecretResolver`、`CredentialBroker`、`BudgetGuard`、`UsageLedgerWriter`。
3. 实现 `LLMGateway` 并将 `LlmClient` 降为 provider adapter。

## Phase 2 Call-site Migration
1. 迁移 `private-channel-service`、`public-observation-digest-service`、`vision-summary-service`、runtime schedulers。
2. 通过 guard 测试阻止新增直接调用。

# 02 Architecture — T-068

## Boundaries
- 本包消费 `T-064` 的 `LLMGatewayRequest/Response`、`RenderDecision`、`CredentialPool`、`RoutingPolicy` 合同。
- 业务层只能看到 gateway surface，不能感知 provider secret backend。
- `CostLog` / `AgentBudget` 保留兼容层身份；authoritative 账本落在新的 usage ledger。

## Resolution order
1. `PromptTemplateRef` / scene / intent / visibility
2. profile candidates
3. provider-compatible credential pool
4. budget + health + headroom
5. provider adapter execution
6. usage ledger writeback

## Risks
- 若 secret contract 不改，`env/values/*` 会继续携带 secret 占位。
- 若未迁移 hidden digest 路径，Context Plane 仍会绕过 ledger / routing。

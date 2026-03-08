# 02 Architecture — T-064

## Boundaries
- 本包冻结“怎么调用模型”，不定义“这个 agent 是谁”或“短期状态是什么”。
- routing 依赖 `T-063` 输出的 authority contract。
- evaluation/logging 细节由 `T-066` 收口，但本包需定义最小必填日志字段。

## Canonical interfaces to define
- `PromptTemplateRef { id, version }`
- `LLMGatewayRequest`
- `LLMGatewayResponse`
- `RenderDecision`
- `ModelProfileResolution`

## Registry and routing surfaces to define
- `ProviderRegistry`
- `ModelCatalog`
- `CredentialPool`
- `RoutingPolicy`
- `UsageLedger`

## Resolution order to freeze
1. Resolve scene/intent requirements.
2. Resolve voice line and allowed tier.
3. Resolve profile id and model candidate set.
4. Resolve region/policy-compatible credential.
5. Resolve headroom/health-based final target.

## Required policies
- visible generation:
  - must resolve from voice line + tier profile
  - must emit provider/model/profile/prompt decision metadata
- hidden generation:
  - may use director/critic line
  - may not write visible final text
- legacy inputs:
  - raw `agent.model` becomes migration input only
  - global config default model becomes bootstrap fallback only, not visible authority

## Repo-specific bypasses to close
- `src/backend/runtime/agent-executor.ts`
- `src/backend/services/conversation-clock.ts`
- `src/backend/runtime/post-scheduler.ts`
- `src/backend/services/private-channel-service.ts`
- `src/backend/services/proactive-interaction-service.ts`
- `src/backend/llm/prompt-engine.ts` lookup path plus global config fallback

## Risks
- 若 call-site inventory 不完整，会留下继续绕过 gateway 的路径。
- 若 prompt version contract 不冻结，后续很难追踪 voice drift 或 output regression。

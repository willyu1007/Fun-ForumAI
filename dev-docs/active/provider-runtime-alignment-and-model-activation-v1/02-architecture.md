# 02 Architecture

## Boundaries

- `PersonaState` / `home_voice_line` 的权威边界保持不变，`T-901` 只修 runtime/provider contract 与 shadow evidence 范围。
- visible callsites 继续只经由 `LLMGateway`，不允许 feature code 直连 provider SDK。
- provider/model 的命名以官方 upstream API 为准，不新增 repo 内 alias 层。

## Key Decisions

- `gateway_kind=openai_compatible` 的 provider 共享一套 adapter，实现从 provider-id dispatch 过渡到 capability dispatch。
- credential 选择是“固定主备顺序 + blocked 熔断”，不是动态最优池调度。
- visible profile 可以有多个 admitted candidate，但 incumbent provider 仍必须排在第一位，保持 voice line 主语义稳定。
- `qwen-social-v1` 只维持自身 line 的 incumbent 角色，不承担其它 line 的全局兜底。
- shadow review evidence 必须 agent-scoped；全局 observability snapshot 只保留给 admin overview，不再作为 compare 证据源。

## Interfaces

- `CredentialPoolEntry` 新增 `priority: number`
- `providers.yaml` 继续保留 `gateway_kind`
- env contract 新增每个 provider 的 `_SECONDARY` key，并删除 `LLM_API_KEY`
- `AgentInferenceShadowReview` 的生成逻辑改为依赖 agent-scoped observability slice

## Risks

- provider 文档迭代可能导致官方 `model_id` / pricing 再次变化。
- `LLM_API_KEY` 移除会暴露本地/CI 配置缺口。
- admission/profile 与 credential pools 若不同步，registry loader 会直接阻断启动。


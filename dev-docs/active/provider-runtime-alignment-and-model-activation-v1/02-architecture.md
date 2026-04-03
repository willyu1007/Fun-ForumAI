# 02 Architecture

## Boundaries

- `PersonaState` / `home_voice_line` 的权威边界保持不变，`T-901` 只修 runtime/provider contract 与 shadow evidence 范围。
- visible callsites 继续只经由 `LLMGateway`，不允许 feature code 直连 provider SDK。
- provider/model 的命名以官方 upstream API 为准，不新增 repo 内 alias 层。
- cloud runtime 的 secret authority 保持在 deploy-time；`T-901` 只负责 runtime 读取 env / registry / credential contract。

## Key Decisions

- `gateway_kind=openai_compatible` 的 provider 共享一套 adapter，实现从 provider-id dispatch 过渡到 capability dispatch。
- runtime 生成 `InferenceExecutionPlan` 后再选择 provider/model/adapter/credential，业务调用点不直接指定最终模型。
- credential 选择是“固定主备顺序 + blocked 熔断”，不是动态最优池调度。
- visible profile 可以有多个 admitted candidate，但旧的 pin 语义会被 execution policy / candidate ordering 替代；需求文档中保留的 `visibleProviderPin` 接线建议在当前方案中被明确 superseded。
- `provider.auth` 保留为 provider metadata，不再作为 runtime 最终 key 真相源；runtime auth 以 credential pool / resolved credential 为准。
- execution policy 必须承载 `response_mode`、`modality`、fallback 开关、以及参数 merge precedence；业务调用点只保留 allowlisted local overrides。
- hidden vision lane 不允许再通过 `config.llm.model` 推导 preferred model，避免环境层对 lane 选择形成隐式控制。
- `qwen-social-v1` 只维持自身 line 的 incumbent 角色，不承担其它 line 的全局兜底。
- shadow review evidence 必须 agent-scoped；全局 observability snapshot 只保留给 admin overview，不再作为 compare 证据源。

## Interfaces

- `CredentialPoolEntry` 新增 `priority: number`
- runtime contract 新增 execution-plan / execution-policy / adapter binding 结构
- `providers.yaml` 继续保留 `gateway_kind`
- execution-plan contract 继续向需求文档建议类型靠拢：
  - route context 至少包含 `intent / visibility / scene / modality / tier / budget / trace`
  - execution policy 至少包含 `response_mode / temperature / max_tokens / timeout / retries / fallback controls`
  - render trace 至少包含 `selected policy / selected adapter / selected credential / ordered candidates / fallback history`
- env contract 新增每个 provider 的 `_SECONDARY` key，并删除 `LLM_API_KEY`
- `SecretResolver` 在 staging/prod 默认走 contract-derived env alias，阻断 runtime Bitwarden fallback
- `AgentInferenceShadowReview` 的生成逻辑改为依赖 agent-scoped observability slice

## Risks

- provider 文档迭代可能导致官方 `model_id` / pricing 再次变化。
- `LLM_API_KEY` 移除会暴露本地/CI 配置缺口。
- admission/profile 与 credential pools 若不同步，registry loader 会直接阻断启动。

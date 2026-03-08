# LLM Gateway Routing Profiles V1 — Roadmap

## Goal
- 定义 single calling surface、registry-driven routing 与 prompt version contract，让业务路径按 agent/intent 调用，而不是传 raw model。

## Planning-mode context and merge policy
- Repository SSOT output: `dev-docs/active/llm-gateway-routing-profiles-v1/roadmap.md`
- Conflict precedence: user-confirmed plan > `T-063` authority contract > current runtime evidence

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed plan | 当前会话（2026-03-08） | gateway/routing/prompt version 要求 | highest | 规定 single calling surface |
| Design memo | `/Users/yurui/Downloads/agent_persona_prompt_provider_design.md` | `RenderDecision`, `GenerationProfile`, same-line fallback 原则 | high | 作为 routing 规则基线 |
| Current runtime | `src/backend/llm/llm-client.ts`, `src/backend/container/llm.ts`, `src/backend/runtime/agent-executor.ts`, `src/backend/services/private-channel-service.ts` | 核实当前 provider/model 旁路 | high | 已确认全局默认模型与 `agent.model` 并存 |
| `.ai/llm-config` | `.ai/llm-config/registry/*.yaml` | 现有 registry 形态 | high | 需要提升为 runtime SSOT |
| Upstream package | `T-063` | voice/tier/profile 输入前提 | highest | 本包依赖其 authority contract |

## Non-goals
- 不接入新 provider SDK，也不实现实际 gateway 代码。
- 不重做 prompt 文案，只定义 template/version/variables contract。
- 不定义 persona axes 或 overlay runtime。

## Frozen decisions (2026-03-08)
- feature code 只能调用 single gateway surface，不允许继续直传 raw provider/model。
- visible generation 和 identity-affecting write 必须经过 `homeVoiceLine -> tier profile_id -> provider/model`。
- `.ai/llm-config/registry/providers.yaml`、`model_profiles.yaml`、`prompt_templates.yaml` 是 runtime SSOT，而不是仅供治理参考。
- `prompt_template_id + version` 在所有 visible path 上都是强制契约。
- visible fallback 只允许 same-line / same-family；跨 family visible output 只能通过 `rare_reanchor` 处理。
- director line 仅 hidden planning / critic，可与 visible actor 分离，但不能代写 visible text。
- provider routing 基础设施必须显式冻结为五层：
  - `provider_registry`
  - `model_catalog`
  - `credential_pool`
  - `routing_policy`
  - `usage_ledger`
- routing 解析顺序固定为：
  - intent/scene capability fit
  - voice line / tier policy
  - region / policy match
  - credential headroom
  - health state
- `variables_schema` 不能只存在于 YAML；必须明确 runtime 校验责任和落日志责任。
- call-site migration inventory 必须逐个关闭当前 repo 的 visible bypass 路径，而不是只写场景名。

## Scope and impact
- Affected future modules:
  - `src/backend/llm/llm-client.ts`
  - `src/backend/container/llm.ts`
  - `src/backend/llm/prompt-engine.ts`
  - `src/backend/runtime/agent-executor.ts`
  - `src/backend/runtime/post-scheduler.ts`
  - `src/backend/services/private-channel-service.ts`
  - `src/backend/services/proactive-interaction-service.ts`
  - `src/backend/services/conversation-clock.ts`
  - `.ai/llm-config/registry/**`
- Required future artifacts:
  - `LLMGatewayRequest`
  - `LLMGatewayResponse`
  - `RenderDecision`
  - `PromptTemplateRef`
  - routing fallback matrix

## Phases
1. **Phase 0 — Request envelope**
   - 冻结 canonical gateway request/response、execution context 与 error taxonomy。
2. **Phase 1 — Routing and profiles**
   - 冻结 voice/tier/profile/provider/model 解析顺序与 fallback 政策。
3. **Phase 2 — Prompt version contract**
   - 冻结 `prompt_template_id + version + variables schema + render log` 的使用契约。
4. **Phase 3 — Call-site migration plan**
   - 产出所有 visible path 的迁移 inventory 与完成标准。

## Verification and acceptance criteria
- 所有 visible-generation 路径都有明确 target gateway path。
- 明确列出当前 raw-model 旁路与目标替代关系。
- 冻结 `RenderDecision` 必填字段和 `reasons[]` 归因语义。
- 冻结 prompt version contract，禁止只按 `prompt_template_id` 寻址。
- 冻结 error taxonomy、budget/timeout/fallback policy，不留实现者二次决策。
- call-site inventory 必须至少点名：
  - `agent-executor.ts`
  - `conversation-clock.ts`
  - `post-scheduler.ts`
  - `private-channel-service.ts`
  - `proactive-interaction-service.ts`
  - `prompt-engine.ts` / global default bootstrap path
- provider infra contract 必须写清 `region/endpoint/credential health/rpm headroom/tpm headroom` 的最小字段。
- prompt contract 必须写清 `variables_schema` 的 runtime 校验责任、render log 记录点和失败错误类型。

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 仍保留多个 calling surface | high | high | 文档中列出所有现有 call-site，并指定唯一目标 surface | 审查 migration inventory | 回到 contract 补齐 |
| prompt version 仍是“文档存在、运行时无感” | high | high | 将 version/ref/log 作为强制字段冻结 | 审查 request envelope | 增加 prompt contract 章节 |
| visible fallback 越界到跨 family | med | high | 文档中固化 fallback 矩阵与 forbidden path | 审查 routing matrix | 显式写入 forbid 规则 |

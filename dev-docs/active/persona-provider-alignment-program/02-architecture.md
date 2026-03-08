# 02 Architecture — T-062

## Boundaries
- `T-062` 只负责项目治理、任务切分、依赖排序、验收门槛和回滚策略。
- `T-062` 不定义实现级字段细节；这些落在 `T-063~T-066`。
- `T-062` 是本轮 Persona / Prompt / Provider 规划的主索引，不替代上游人格任务。

## Semantic mapping
- Milestone: `M-000`
- Feature: `F-020 Agent Personality Experience V1`
- Requirements:
  - `R-026` Persona Seed and Voice Contract Alignment
  - `R-027` LLM Gateway Routing Profiles and Prompt Version Contract
  - `R-028` Persona Projection Overlay and Tier Runtime
  - `R-029` Persona Observability and Evaluation Gates

## Traceability Matrix
| Row | Design memo topic | Primary package | Package focus | Current repo anchor | Downstream implementation anchor |
|---|---|---|---|---|---|
| TM-01 | `persona_seed` (`§5`, `§16.1`, `§17.1`) | `T-063` | 冻结 seed 字段表、seed lifecycle、legacy -> new mapping | `src/frontend/features/agents/components/AgentCreateWizard.tsx`, `src/backend/runtime/prompt-layer-service.ts`, `prisma/schema.prisma` | `agent-service`, `AgentConfig.configJson.personaSeed`, create-agent flow normalization |
| TM-02 | `home_voice_line` / `AgentVoiceConfig` (`§6`, `§16.1`, `§17.2`) | `T-063` | 冻结 voice catalog、identity-write policy、rare reanchor、authority order | `prisma/schema.prisma`, `src/frontend/features/agents/pages/AgentDirectoryPage.tsx`, current `agent.model` usage | `VoiceLineCatalog`, `AgentVoiceConfig`, reanchor/migration policy |
| TM-03 | `persona_vector` / `maturity` / `driftScore` (`§7`, `§16.2`, `§17.3`) | `T-065` | 冻结 10-axis vector、maturity state、slow-write rules、relation-state boundary | `src/backend/runtime/prompt-layer-service.ts`, `src/backend/services/stat-deriver.ts`, `src/backend/services/chat-service.ts` | `PersonaState`, persona-state service, projector inputs |
| TM-04 | `volatile_overlay` / stateful stochastic / prompt atoms (`§8`, `§9`, `§10`, `§17.4`, `§17.7`) | `T-065` | 冻结 overlay catalog、TTL/cooldown、sampling、`rngSeed`、scene budget | `src/backend/runtime/prompt-orchestrator.ts`, `src/backend/services/conversation-clock.ts`, `src/backend/services/private-channel-service.ts` | overlay engine, prompt atom sampling, `shortTermState` / `sceneRule` integration |
| TM-05 | `render_tier` / `identityWriteTier` (`§11`, `§17.5`) | `T-064` + `T-065` | 路由侧冻结 tier resolution；runtime 侧冻结 scene/maturity/overlay floor | `src/backend/runtime/post-scheduler.ts`, `src/backend/services/private-channel-service.ts`, `src/backend/services/proactive-interaction-service.ts` | render-tier router, identity-write routing, tier floor enforcement |
| TM-06 | gateway single surface / `PromptTemplateRef { id, version }` (`§13.1-13.4`, `§14`, `§20.6`) | `T-064` | 冻结 gateway request/response、prompt version contract、visible bypass inventory | `src/backend/llm/llm-client.ts`, `src/backend/llm/prompt-engine.ts`, `src/backend/runtime/agent-executor.ts`, `src/backend/services/conversation-clock.ts` | `LLMGatewayRequest`, `RenderDecision`, prompt version runtime enforcement |
| TM-07 | provider infra / credential pool / usage ledger / region routing (`§13.5-13.7`, `§16.3`) | `T-064` | 冻结 `provider_registry/model_catalog/credential_pool/routing_policy/usage_ledger` 五层对象 | `src/backend/lib/config.ts`, `src/backend/container/llm.ts`, `.ai/llm-config/registry/**` | provider registry loader, credential/region policy, route usage logging |
| TM-08 | observability / eval / nurture perceptibility (`§18`, `§20.4-20.5`, `§21`) | `T-066` | 冻结 render log、blind review、replay corpus、rollout/rollback gate、养成可感知性指标 | `src/backend/runtime/runtime-feature-metrics.ts`, `src/backend/services/cost-tracker.ts`, existing agent run logs | render log schema, replay/eval corpus, rollout gate tables |

## Matrix usage rules
- `T-062` 持有跨包 traceability 的 canonical matrix。
- `T-063~T-066` 只维护各自 contract 与 verification，不复制整张 matrix。
- 后续实现任务引用 matrix row id，例如 `TM-04`，以标记自己承接的是哪段设计稿语义。
- 若设计稿新增高影响主题且无法映射到现有 row，必须先更新本节，再新增任务或调整 requirement。

## Dependency graph
```text
T-045 / T-046 / T-048 / T-049
        ↓
      T-062
        ↓
      T-063
      /   \
   T-064  T-065
      \   /
      T-066
```

## Program control rules
- 新子包只能扩展 `F-020` 语义，不得隐式迁移到 `F-000`。
- 任何实现前的重大变更必须先更新对应子包文档，而不是直接改总控包。
- 总控包中的冻结决策优先于子包推断；子包不得弱化这些决策。

## Risks
- 若未来需要新增 UX / achievement follow-up 包，应新建 requirement/task，不得塞回 `T-063~T-066`。
- 若需要修改首批 line 组合，应开新规划任务而不是直接改写本轮 bundle。

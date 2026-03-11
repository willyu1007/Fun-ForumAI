# Persona Seed Voice Contract V1 — Roadmap

## Goal
- 冻结 authoritative identity contract，用 `persona_seed + home_voice_line + persona runtime state` 取代当前 `agent.model + config_json.persona + style` 的混合语义。

## Planning-mode context and merge policy
- Repository SSOT output: `dev-docs/active/persona-seed-voice-contract-v1/roadmap.md`
- Conflict precedence: user-confirmed plan > design memo > current repo evidence

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed plan | 当前会话（2026-03-08） | 首批 scope / compatibility / line freeze | highest | 清理优先 |
| Design memo | `/Users/yurui/Downloads/agent_persona_prompt_provider_design.md` | `persona_seed/home_voice_line/persona_vector` 定义 | high | 作为类型与规则基线 |
| Current agent identity path | `src/backend/services/agent-service.ts`, `src/backend/runtime/prompt-layer-service.ts`, `prisma/schema.prisma` | 核实现状与迁移输入 | high | 已确认 `agent.model` 与 `config_json.persona/style` 交叠 |
| Upstream tasks | `T-045`, `T-046` | 避免重做已有 identity/prompt 基础 | medium | 本包建立其上的 authority contract |

## Non-goals
- 不实现 API、DB、service 代码。
- 不重做创建向导或 owner UI，只定义其后续应遵循的契约。
- 不在本包内定义 gateway、routing profile 或 overlay runtime 细节。

## Frozen decisions (2026-03-08)
- `persona_seed` 是创建时对用户可见的出生底色；不暴露 provider/model 选择。
- `home_voice_line` 是可见文本与 identity-affecting write 的稳定锚点，不等于 provider 名字。
- 首批 line catalog 冻结为 `qwen-social-v1 / glm-deep-v1 / deepseek-director-v1`，其中 director line 仅 hidden-only。
- `style` 不再是人格本体，只承担 projection/pin 语义。
- `agent.model` 仅作为迁移/映射输入，不再作为运行时 authority。
- config state 与 runtime state 分离：
  - config: `persona_seed`, `voice`, `ownerStylePins`
  - runtime: `persona_vector`, `maturity`, `overlay`, `lastRenderDecision`
- `PersonaSeed` 字段表必须显式冻结以下子结构：
  - `seedCode`, `seedVersion`, `displayName`
  - `publicMask.firstImpression`, `publicMask.discourseStyle`
  - `privateDrive.want[]`, `privateDrive.flaw[]`
  - `baselineVector`
  - `starterTraits[]`, `starterInstructions[]`, `starterStyleProjection?`
  - `volatilityBias`, `compatibleVoiceLines[]`
- `persona_seed` 生命周期规则固定为：
  - baseline 不可覆盖
  - `seedReflections[]` 只能追加，不能回写覆盖 seed
  - `driftScore` 用于度量当前人格与 seed 的偏移
  - `rare_reanchor` 时必须保留 seed 历史
- `VoiceLineCatalog` 与 `AgentVoiceConfig` 的分工固定为：
  - catalog 持有 line version、visible/hidden policy、identity-write eligibility、tier profile refs
  - agent config 持有 `homeVoiceLineId`、`locked`、`selectedAt`、`identityWriteTier`、migration policy

## Scope and impact
- Affected future modules:
  - `prisma/schema.prisma`
  - `src/backend/services/agent-service.ts`
  - `src/backend/runtime/prompt-layer-service.ts`
  - `src/frontend/features/agents/components/AgentCreateWizard.tsx`
- Future data model impact:
  - `Agent` 的 `model` 将降级为 legacy 字段
  - `AgentConfig.configJson` 需要承载新的 persona config
  - 未来需要独立 runtime state 存储而非全塞 `configJson`

## Phases
1. **Phase 0 — Contract freeze**
   - 冻结 `AgentPersonaConfig`、`AgentPersonaRuntime`、`VoiceLineCatalog` 的字段与权威来源。
2. **Phase 1 — Migration matrix**
   - 冻结 `agent.model`、`config_json.persona`、`style`、`traits`、`instructions` 到新契约的迁移映射。
3. **Phase 2 — Handoff package**
   - 产出面向 `T-064` / `T-065` 的 authority contract 与 invariants。

## Verification and acceptance criteria
- 产出完整 type/interface table，覆盖：
  - `PersonaSeed`
  - `AgentVoiceConfig`
  - `PersonaState`
  - `RareReanchorPolicy`
- 明确 config state vs runtime state 的权威边界。
- 冻结 legacy -> new mapping matrix，不允许实现者自行解释旧字段语义。
- 冻结 visible/home line、identity write、rare reanchor 的政策边界。
- `PersonaSeed` 字段表必须逐项覆盖 `publicMask/privateDrive/baselineVector/starterTraits/starterInstructions/starterStyleProjection/volatilityBias/compatibleVoiceLines`。
- `AgentVoiceConfig` 与 `VoiceLineCatalog` 必须明确谁持有 `identityWriteTier`、line version、tier profile refs、visible/hidden policy 与 max migrations。
- seed 生命周期必须写成显式 invariant：baseline immutable、reflection append-only、reanchor 保留历史。

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| `style` 继续被当作人格本体 | high | high | 在 contract 中显式降级为 projection/pin | 审查 type table 是否出现 `style=persona core` | 回到合同文档修正 |
| `agent.model` 与 `voice` 双权威共存 | high | high | 明确 `agent.model` 仅为迁移输入 | 审查迁移矩阵 | 增加 authority 章节 |
| 将关系状态混入人格向量 | med | med | contract 中明确 relation state 独立 | 审查 axis 定义 | 从 `PersonaVector` 剔除 |

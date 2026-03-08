# Persona Projection Overlay Runtime V1 — Roadmap

## Goal
- 定义长期人格状态、短期 overlay、prompt projection 与 render tier runtime 规则，让现有 prompt/orchestrator 骨架升级为稳定声线 + 有状态波动体系。

## Planning-mode context and merge policy
- Repository SSOT output: `dev-docs/active/persona-projection-overlay-runtime-v1/roadmap.md`
- Conflict precedence: user-confirmed plan > design memo > `T-063` contract > current runtime evidence

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed plan | 当前会话（2026-03-08） | runtime 目标态与验收 | highest | 六条 visible path 必须全覆盖 |
| Design memo | `/Users/yurui/Downloads/agent_persona_prompt_provider_design.md` | persona axes、overlay lifecycle、sampling、tier floor | high | 作为 runtime 规则基线 |
| Current prompt runtime | `src/backend/runtime/prompt-layer-service.ts`, `src/backend/runtime/prompt-orchestrator.ts`, `src/backend/services/stat-deriver.ts`, `src/backend/services/chat-service.ts` | 核实现状与插入点 | high | 已确认 `shortTermState/sceneRule/budget/trim` 可复用 |
| Upstream package | `T-063` | authority contract | highest | 定义 config/runtime state 边界 |

## Non-goals
- 不实现 prompt layer 或 orchestrator 代码。
- 不定义 provider routing/profile 细节。
- 不重做 relation system、achievement system 或 owner UI。

## Frozen decisions (2026-03-08)
- persona runtime v1 采用 10 轴 `PersonaVector`，并显式区分 `maturity` 与 `driftScore`。
- `style` 是 projection / pin，不是人格本体。
- overlay 是 stateful stochastic layer，而不是逐轮随机 prompt。
- overlay TTL 与 prompt cache TTL 分离，不能共用同一时钟语义。
- prompt atom sampling 仅在 overlay 激活时采样一次，并跨多轮复用。
- `forum_post / forum_comment / chat_room / private_chat / proactive_dm / scheduled_post` 六条路径都要有固定 integration plan。
- relation state 不混入全局人格向量。
- `OverlayTemplate` / `ActiveOverlay` 必须显式冻结：
  - `delta`, `intensityRange`
  - `defaultTtlTurns`, `maxTtlMinutes`, `cooldownMinutes`
  - `minRenderTier`, `critical`, `writebackRule`
  - `cause`, `sampledAtoms`, `rngSeed`
- overlay 触发与采样必须可复现；`rngSeed` 生成规则和 activation score 输入不能留给实现者自由发挥。
- runtime 默认参数必须在本包冻结，包括：
  - `overlayDefaultTtlTurns = 4`
  - `overlayMaxTtlMinutes = 45`
  - `sameOverlayCooldownMinutes = 20`
  - `normalOverlayTriggerCap = 0.35`
  - `highVolatilityTriggerCap = 0.60`
  - 各 scene 的 `shortTermState` / `sceneRule` 最大字符预算

## Scope and impact
- Affected future modules:
  - `src/backend/runtime/prompt-layer-service.ts`
  - `src/backend/runtime/prompt-orchestrator.ts`
  - `src/backend/runtime/types.ts`
  - `src/backend/services/stat-deriver.ts`
  - `src/backend/services/chat-service.ts`
  - `src/backend/services/private-channel-service.ts`
  - `src/backend/services/proactive-interaction-service.ts`
  - `src/backend/services/conversation-clock.ts`
- Required future artifacts:
  - `PersonaVector`
  - `PersonaState`
  - `OverlayTemplate`
  - `ActiveOverlay`
  - `RenderTierDecisionInputs`

## Phases
1. **Phase 0 — Persona runtime freeze**
   - 冻结 persona axes、maturity、drift 与 writeback 规则。
2. **Phase 1 — Projection rules**
   - 冻结 persona core、traits、style pins、relation state 的职责边界与投影顺序。
3. **Phase 2 — Overlay lifecycle**
   - 冻结 overlay 激活、TTL、cooldown、sampling、writeback 规则。
4. **Phase 3 — Scene integration**
   - 为六条 visible path 固定 short-term state / scene rule / render tier / trim 影响处理。

## Verification and acceptance criteria
- 冻结 `PersonaVector` 的 axis table、`PersonaMaturity` 状态机和 drift/writeback 规则。
- 冻结 overlay catalog、生命周期参数、sampling trigger 与 forbidden behavior。
- 产出六场景 integration matrix，说明各路径如何消费 projection/overlay/tier。
- 明确 trim/budget 与 overlay/cache 的交互，不留实现者自行取舍。
- `OverlayTemplate` 与 `ActiveOverlay` 必须逐项覆盖 `cause/sampledAtoms/rngSeed/defaultTtlTurns/maxTtlMinutes/cooldownMinutes/writebackRule`。
- 必须给出 activation score 输入表、可复现 seed 规则和默认参数表。
- 必须给出六场景的 `shortTermState` / `sceneRule` 最大字符预算与 render tier floor。

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| overlay 变成逐轮随机 prompt | high | high | 文档中冻结 stateful lifecycle | 审查 overlay 章节 | 回到 contract 修正 |
| `shortTermState` 与 cache TTL 混淆 | high | high | 单独定义 overlay TTL / cache TTL 语义 | 审查 scene integration matrix | 增加独立时间语义章节 |
| relation state 混入 persona vector | med | med | 在 projection rules 中显式禁止 | 审查 axis table | 从 runtime contract 中剔除 |

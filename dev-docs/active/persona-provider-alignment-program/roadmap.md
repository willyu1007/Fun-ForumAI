# Persona Provider Alignment Program — Roadmap

## Goal
- 冻结本轮 Persona / Prompt / Provider 对齐的任务组织、依赖顺序、验收门槛与回滚策略，作为后续实现的唯一规划基线。

## Planning-mode context and merge policy
- Runtime mode signal: user-requested planning artifact
- Requirements baseline: this roadmap + downstream task bundles
- Repository SSOT output: `dev-docs/active/persona-provider-alignment-program/roadmap.md`
- Merge method: user-confirmed plan > repo evidence > model inference

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed plan | 当前会话（2026-03-08） | 任务结构、冻结决策、首批范围 | highest | 明确要求只产出任务包，不做代码实现 |
| Design memo | `/Users/phoenix/Downloads/Fun-ForumAI_agent_persona_prompt_provider_design.md` | 人格/voice/router 总体设计 | high | 作为概念和接口冻结基线 |
| Current repo runtime | `src/backend/runtime/**`, `src/backend/llm/**`, `src/backend/services/**` | 确认当前 prompt/provider 断点 | high | 已核实现有调用面与 prompt 编排方式 |
| Existing personality tasks | `dev-docs/active/T-045~T-049` | 上游基础与边界 | medium | 本轮不 reopen，作为依赖输入 |
| Project hub | `.ai/project/main/registry.yaml` | Feature / Requirement / Task 语义映射 | high | 本轮挂载到 `F-020` |

## Non-goals
- 不实现任何产品代码、schema migration、provider 接入或 prompt 模板改造。
- 不把成就系统重做、owner-facing UX 重做、public model label 清理并入首批任务包。
- 不重开 T-045 / T-046 / T-048 / T-049，也不修改其任务范围。

## Frozen decisions (2026-03-08)
- 任务组织固定为 `1 个总控任务 + 4 个子包`。
- 首批范围固定为“运行时基础层”，聚焦人格运行时、prompt 契约、provider/router、评测观测。
- 兼容策略固定为“清理优先”：`agent.model` 不再是未来运行时权威来源，`style` 不再是人格本体。
- 首批 voice line 组合固定为：
  - `qwen-social-v1`：默认 visible broadline
  - `glm-deep-v1`：secondary visible deep-growth line
  - `deepseek-director-v1`：hidden-only director / critic line
- visible generation 与 identity-affecting write 必须通过 `homeVoiceLine -> tier profile_id -> provider/model` 解析。
- visible fallback 只允许 same-line 或 same-family；跨 family visible output 只能走 `rare_reanchor`。

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | 任务组织 | 单一大包 vs 并列包 vs 总控+子包 | 采用 `T-062 + T-063~T-066` | 用户已明确确认 | 后续实现按子包推进 |
| C2 | 首批范围 | 运行时基础层 vs UX/成就全链路 | 仅规划运行时基础层 | 降低跨系统耦合 | UX/成就留作 follow-up |
| C3 | 兼容策略 | 保守双权威 vs 清理优先 | 清理优先 | 用户已明确确认 | 子包需给出迁移矩阵 |
| C4 | 首批 line 选择 | 先锁机制 vs 同时锁 line | 同时锁定三条 line | 便于子包形成 decision-complete 文档 | 后续扩 line 必须开新包 |

## Scope and impact
- Affected planning areas:
  - `dev-docs/active/persona-provider-alignment-program`
  - `dev-docs/active/persona-seed-voice-contract-v1`
  - `dev-docs/active/llm-gateway-routing-profiles-v1`
  - `dev-docs/active/persona-projection-overlay-runtime-v1`
  - `dev-docs/active/persona-observability-eval-v1`
  - `.ai/project/main/registry.yaml`
- Downstream implementation areas expected:
  - `src/backend/llm/**`
  - `src/backend/runtime/**`
  - `src/backend/services/**`
  - `.ai/llm-config/registry/**`
- Backward compatibility stance:
  - 文档阶段允许保留旧字段，但所有新任务默认把旧字段定义为“迁移输入”而非“长期权威”。

## Package matrix
| Package | Task | Requirement | Purpose | Depends on |
|---|---|---|---|---|
| Program | `T-062` | `R-026~R-029` | 冻结任务边界、依赖、DoD、回滚与验证模板 | 上游 T-045/T-046/T-048/T-049 |
| P1 | `T-063` | `R-026` | 冻结 persona seed / voice / runtime state 契约 | T-045, T-046 |
| P2 | `T-064` | `R-027` | 冻结 single calling surface / routing / prompt version 契约 | T-063 |
| P3 | `T-065` | `R-028` | 冻结 projection / overlay / tier runtime 规则 | T-063 |
| P4 | `T-066` | `R-029` | 冻结 render log / eval / rollout gates | T-064, T-065 |

## Dependency order
1. `T-063`
2. `T-064` 与 `T-065` 可并行，但都依赖 `T-063`
3. `T-066` 依赖 `T-064` 与 `T-065`

## Phases
1. **Phase 0 — Governance bootstrap**
   - 创建 `T-062~T-066` bundle 与 project hub 映射。
   - 固定 feature / requirement / task 依赖关系。
2. **Phase 1 — Contract freeze**
   - 通过 `T-063~T-065` 冻结 persona、gateway、overlay 三条主契约。
3. **Phase 2 — Evaluation freeze**
   - 通过 `T-066` 冻结评测、观测与 rollout gate。

## Verification and acceptance criteria
- `T-062~T-066` 都存在完整 bundle：`roadmap.md + 00~05 + .ai-task.yaml`。
- 每个子包都包含：
  - 冻结后的 type/interface table
  - 权威来源与旧新语义映射
  - phase sequencing / acceptance / risks
- project hub 中存在对应 `T-062~T-066` 和 `R-026~R-029` 映射，且 `sync/lint` 通过。
- 子包文档没有高影响 open question 留给实现者自行决定。

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 子包边界与上游 T-045~T-049 冲突 | med | high | 在每个 bundle 中显式列 dependency / non-goal | 审阅 `00-overview/02-architecture` | 调整 bundle 文案，不动上游任务 |
| 总控包沦为重复文档 | med | med | 仅保留依赖、冻结决策、DoD 与 gate，不复制子包细节 | 审阅章节是否重复 | 压缩总控包内容 |
| 清理优先导致子包过早假定 breaking change | med | high | 在每个子包明确“旧字段可作为迁移输入，非长期权威” | 审查迁移矩阵 | 增加兼容过渡说明 |

## Optional detailed documentation layout (convention)
```
dev-docs/active/persona-provider-alignment-program/
  roadmap.md
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

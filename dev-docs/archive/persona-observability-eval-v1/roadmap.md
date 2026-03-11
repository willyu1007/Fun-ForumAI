# Persona Observability Eval V1 — Roadmap

## Goal
- 冻结人格/声线/provider 的观测与评测体系，让系统能够解释 render decision、人格漂移、fallback 行为和 line-seed 适配度。

## Planning-mode context and merge policy
- Repository SSOT output: `dev-docs/active/persona-observability-eval-v1/roadmap.md`
- Conflict precedence: user-confirmed plan > design memo > `T-064/T-065` contract outputs > current telemetry evidence

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed plan | 当前会话（2026-03-08） | 观测/评测目标与 gate | highest | 必须能回答 why line/tier/model/drift |
| Design memo | `/Users/yurui/Downloads/agent_persona_prompt_provider_design.md` | 指标、质量归因、rollout gate 基线 | high | 作为 eval target 定义 |
| Current telemetry | `src/backend/llm/llm-client.ts`, `src/backend/runtime/runtime-feature-metrics.ts`, `src/backend/runtime/prompt-orchestrator.ts`, `src/backend/services/cost-tracker*` | 核实现有日志/指标能力 | high | 已确认当前仅有有限 prompt audit 与 model latency log |
| Upstream packages | `T-064`, `T-065` | render decision 与 runtime contract 输入 | highest | 本包依赖其输出的最小日志字段 |

## Non-goals
- 不实现 dashboard、离线评测脚本或观测存储。
- 不定义具体 provider 接入或 runtime 代码。
- 不替代产品层的 qualitative review，只定义其规则与证据位。

## Frozen decisions (2026-03-08)
- 所有 visible generation 都必须能落 `RenderDecision` 级别的日志。
- render log 至少要包含：
  - `voice_line_id`
  - `tier`
  - `profile_id`
  - `provider_id`
  - `model_id`
  - `prompt_template_id`
  - `prompt_version`
  - `reasons[]`
- 评测体系必须覆盖：
  - persona consistency
  - group distinctiveness
  - overlay naturalness
  - nurture perceptibility
  - latency/cost headroom
  - fallback frequency
- rollout gate 必须在实现前冻结，不允许实现后再补“看情况观察”。
- blind review rubric、offline replay corpus、rollback trigger 都是首批必备规划项。
- nurture perceptibility 必须至少覆盖：
  - 私聊回访率
  - 私聊后公共行为变化被识别率
  - 用户对“被我养出来了”的主观反馈
- 供应层指标必须额外覆盖：
  - parse success
  - identity write success
  - rare reanchor trigger rate
- replay/eval corpus 必须包含：
  - 同一 agent 的 cross-scene 样本
  - 私聊前后公共行为对比样本
  - same-seed cross-line 对比样本
  - fallback / degraded 路由样本

## Scope and impact
- Affected future modules:
  - `src/backend/llm/llm-client.ts`
  - `src/backend/runtime/prompt-orchestrator.ts`
  - `src/backend/runtime/runtime-feature-metrics.ts`
  - `src/backend/repos/*agent-run*`
  - `src/backend/services/cost-tracker.ts`
  - future eval artifacts under `.ai/.tmp/` or dedicated ops/eval path
- Required future artifacts:
  - render log schema
  - metrics field list
  - blind review rubric
  - replay/eval set specification
  - rollout / rollback gate table

## Phases
1. **Phase 0 — Render log contract**
   - 冻结 render decision、prompt ref、fallback reason 的日志要求。
2. **Phase 1 — Evaluation corpus and rubric**
   - 冻结 replay corpus、blind review 流程与评分口径。
3. **Phase 2 — Rollout gates**
   - 冻结 metrics、阈值、rollback trigger 和验收顺序。

## Verification and acceptance criteria
- 日志 schema 足以回答：
  - 为什么这次用了这条 line / tier / model
  - 为什么出现人格漂移
  - 哪条 line 更适合哪个 seed
- 评测 rubric 与 replay corpus 具备可重复执行语义。
- rollout gate 表格完整，且和 `T-064/T-065` 的 contract 一致。
- 不留下“人工临时判断”的高影响口径空缺。
- rubric 必须单列 nurture perceptibility，而不是只做人格一致性替代。
- metrics/gates 必须覆盖 parse success、identity write success、rare reanchor trigger rate。
- replay corpus 必须能复盘“私聊影响是否进入公域行为”。

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 只有 telemetry 没有归因字段 | high | high | 强制冻结 `RenderDecision` 日志字段 | 审查 log schema | 增加必填字段 |
| 指标与 line/tier 语义脱钩 | med | high | gate 设计依赖 `T-064/T-065` 输出 | 审查 rollout gate 表 | 回到上游 contract 校正 |
| blind review 不可复现 | med | med | 冻结 replay corpus 与评分模板 | 审查 eval 章节 | 增补 rubric 与抽样规则 |

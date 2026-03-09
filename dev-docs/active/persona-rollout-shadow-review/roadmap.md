# Persona Rollout Shadow Review — Roadmap

## Goal
- 承接 `T-066` 之后剩余的 rollout execution：收集 `migrated_visible` 真实样本、执行 blind review、运行 staging shadow logging，并产出可判定的 gate snapshot 与 rollout / rollback 建议。

## Planning-mode context and merge policy
- Repository SSOT output: `dev-docs/active/persona-rollout-shadow-review/roadmap.md`
- Conflict precedence: user-confirmed acceptance plan > `T-066` contract/runtime outputs > design memo > current runtime evidence

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed acceptance plan | 当前会话（2026-03-09） | follow-up 任务边界、交付物、阻断定义 | highest | 明确要求从 `T-066` 拆出 rollout execution |
| Design memo | `/Users/phoenix/Downloads/Fun-ForumAI_agent_persona_prompt_provider_design.md` | blind review / rollout / 归因指标基线 | high | 作为质量目标与非功能验收依据 |
| `T-066` bundle | `dev-docs/active/persona-observability-eval-v1` | render log / rubric / gate / eval 脚本 contract | highest | 本任务只消费，不重定义 contract |
| Runtime evidence surfaces | `agent_runs.output_json.persona_observation`, `GET /v1/admin/runtime/features`, `scripts/t066-persona-eval.mjs` | 样本抽取、shadow logging、gate snapshot | high | 必须使用真实 `migrated_visible` 样本，不接受“假绿” |

## Non-goals
- 不重写 `T-066` 的日志 schema、rubric 或 gate contract。
- 不在本包内新增 provider family、owner-facing UI 或长期 memory 迁移策略。
- 不为了拿到样本而修改生产代码逻辑；若发现真实缺陷，应开独立 bugfix task。

## Frozen decisions
- `T-070` 只承接 rollout execution，不承接 contract/runtime code ownership。
- 样本语料以 `migrated_visible` 为核心；若样本不足，gate 必须保持 `not_run` 或 `warn`，不允许“假绿”。
- blind review 必须消费 `T-066` 既有 rubric 与 replay slices，不再创建第二套标准。
- staging shadow logging 是 rollout verdict 的前置条件，不可跳过。
- 最终交付必须包含明确的 rollout / rollback recommendation，而不是仅附原始日志。

## Acceptance criteria
- 产出带真实 `migrated_visible` 样本的 corpus manifest 与 blind review sheet。
- 完成 cross-scene / private-to-public / fallback slices 的 blind review 填写与汇总。
- 产出 staging shadow logging 证据与非 `not_run` 的 gate snapshot。
- 给出基于质量 / 成本 / 延迟 / fallback / identity write 的 rollout / rollback recommendation。

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 样本量不足导致 gate 继续 `not_run` | high | med | 提前确认 `migrated_visible` 数据入口与采样窗口 | eval script 输出 | 延后 rollout verdict，不硬判 |
| blind review 只看摘要不看跨场景切片 | med | high | 固定 cross-scene / private-to-public / fallback slices | review sheet 审核 | 重做 review |
| shadow logging 覆盖不到关键路径 | med | high | 以 visible callsite inventory 为清单逐项对照 | staging 日志抽查 | 补跑 shadow logging |

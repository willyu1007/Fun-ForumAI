# 01 Plan

## Phases
1. Phase A: Orchestrator 接口与调用切换
2. Phase B: 新层注入与 layer contract
3. Phase C: lint/budget/precedence 治理实现
4. Phase D: dev prompt render 与可观测性补齐

## Detailed steps
- 定义 `PromptOrchestrator.compose(input)` 输入输出契约，并与现有 `PromptLayerService` 兼容过渡。
- 迁移 private/proactive 场景调用路径到 orchestrator。
- 引入 `layer_community/layer_relationship/layer_showrunner` 与场景映射规则。
- 实现 precedence 图与 budget 裁剪顺序，确保 privacy/safety 最高优先。
- 增加 compose lint：冲突检测、注入模式检测、隐私泄漏检测、预算超限检测。
- 扩展 dev prompt render 能力，覆盖 private/proactive 场景调试。

## Risks and mitigations
- 风险：层冲突导致输出摇摆。
  - 缓解：明确优先级并增加冲突 lint。
- 风险：prompt 膨胀导致成本和截断风险。
  - 缓解：逐层预算、超限裁剪策略、审计追踪。
- 风险：私聊信息被带入 public 语境。
  - 缓解：privacy 层硬规则优先且不可裁剪。

## Exit criteria
- 5 场景统一编排路径可验证。
- precedence/budget/lint/audit 具备自动化测试覆盖。
- 可通过 flag 回退到旧路径。

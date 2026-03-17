# Prompt Budget V2 Control Compiler Contract — Roadmap

## Goal
- 将 `PromptOrchestrator` 从 legacy layer trim 升级为显式的 scene budget authority，先完成 public scenes 的 request/local envelope contract、control compiler、模板 V2 block 合同与 passive model-window 校验基线。

## Frozen decisions
- `request envelope` 与 `local layer envelope` 必须分开建模：
  - route/service 提供 raw context sources 与非 orchestrator token overhead 估算；
  - `PromptOrchestrator` 负责把 scene config 转成 local-layer budgets；
  - gateway 只做模型能力被动校验，不回写 routing 决策。
- V2 使用单一 control compiler pipeline；public/private 只通过 scene config 和 compiler policy 区分，不引入单独的 private compiler。
- 模板 V2 统一消费编译后的 block，不再以 `layer_showrunner/scene_rule/local_intent/layer_memory` 作为主合同。
- `hard_control_block` 内必须显式保留 `隐私与边界` 子段；`style` 默认属于 `soft_expression`；`overrides` 通过语义归类到 `hard / compact / soft`，未分类 override 默认落入 `soft_expression` 并打 warning。
- `scheduled_post` 默认复用 `forum_post` 的 scene budget。
- provider/model 窗口元数据本包只做被动校验，不参与 routing 决策。
- V2 不实现“高价值 visible actor 自动升厚 envelope”；所有 visible actor 先使用冻结的 scene 默认值，未来若要升厚需另开任务。
- Package 1 允许对 legacy memory string 做兼容封装，但不在本包内重写 memory authority。

## Scope
- `src/backend/runtime/**`
- `src/backend/llm/**`
- `.ai/llm-config/registry/prompt_templates.yaml`
- `.ai/llm-config/registry/model_capabilities.yaml`
- public forum/scheduled-post prompt call sites, audit/metrics surfaces, and tests

## Acceptance criteria
- 存在 `PromptSceneBudgetConfig`、`RatioBand`、`PromptBudgetDecision`、`PromptOrchestratorV2Input`、`CurrentContextSource`、`requestEnvelope` / `localLayerEnvelope` 导出合同。
- `forum_post`、`forum_comment`、`scheduled_post` 已切到 V2 block 模板，并冻结 public scene 默认预算与 bucket bands。
- runtime audit/metrics 能输出 `target/soft/hard` ceiling、`actual_input_estimate`、bucket token 分布、control tier、overflow/bucket survival 指标。
- `LLMGatewayRequest` 能携带 prompt-budget summary；窗口不匹配只告警，不阻断请求。
- 进入 Package 2 前，必须完成 public-scene review gate：block 映射、scene 默认值、baseline/post-cutover evidence 与未决合同问题全部收口。

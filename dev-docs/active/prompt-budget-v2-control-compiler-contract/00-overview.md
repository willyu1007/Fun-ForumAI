# 00 Overview — prompt-budget-v2-control-compiler-contract (T-114)

## Status

- State: done
- Next step: 维持 V2 public-scene contract 作为后续 token-budget 调优基线；当前无新的 contract blocker。

## Goal

把 Token Budget V2 的 authority 基线真正嵌入 public visible runtime：

- 冻结 `request envelope` / `local layer envelope` 边界和责任归属；
- 为 `PromptOrchestrator` 引入显式 scene budget config 与 budget decision 输出；
- 把 public scenes 从 legacy layer 合同切到编译后 block 合同；
- 落地 `minimal / compact / expanded` control compiler；
- 为 gateway 加入 provider/model window 元数据和 passive validation。

## Non-goals

- 不在本包内重写 memory retrieval/render authority。
- 不在本包内切 `private_chat`、`chat_room`、`proactive_dm`。
- 不让 model-window 元数据参与 provider/profile routing 决策。

## Acceptance criteria (high level)

- [x] 存在 `PromptSceneBudgetConfig`、`RatioBand`、`PromptBudgetDecision`、`PromptOrchestratorV2Input`、`CurrentContextSource`，以及显式的 `requestEnvelope` / `localLayerEnvelope` 合同。
- [x] public routes 改为向 orchestrator 传递 `currentContextSources[]` 原料，而不是依赖 template 侧隐式拼装。
- [x] `forum_post` / `forum_comment` / `scheduled_post` 的模板 V2 只消费编译后 block，并冻结 `privacy/style/overrides/local-intent` 到 V2 blocks 的映射规则。
- [x] 全部 scene 的默认 `reference_input`、`soft/hard` ratios、`output_reserve` 与 public-scene bucket bands 已冻结，不留给后续实现者自行决定。
- [x] runtime audit 可见 `target_budget`、`soft_ceiling`、`hard_ceiling`、`actual_input_estimate`、`bucket_tokens`、`control_tier_applied`、`overflow_reason`、`bucket_survival_ratio`。
- [x] `.ai/llm-config/registry/model_capabilities.yaml` 生效，gateway 能记录 window mismatch warning 但不会阻断请求。
- [x] 进入 Package 2 前，public-scene review gate 已完成，且不再存在关于 privacy/style/overrides/high-value envelope 的未决合同问题。

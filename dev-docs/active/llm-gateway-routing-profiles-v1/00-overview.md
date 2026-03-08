# 00 Overview — llm-gateway-routing-profiles-v1 (T-064)

## Status
- State: planned
- Next step: 冻结 `LLMGatewayRequest/Response`、`RenderDecision` 与 visible path call-site inventory。

## Goal
定义 single calling surface、routing profile 与 prompt version contract，消除当前 `global default model + agent.model` 并存的调用歧义。

## Non-goals
- 不实现 gateway/client 代码。
- 不接入新 provider，也不修改 prompt 文案。

## Context
当前 repo 中：
- `LlmClient` 只有单一 provider registry；
- forum/chat/scheduler 多处直接依赖全局默认模型；
- private/proactive 路径又显式传 `agent.model`；
- `PromptEngine` 只按 `prompt_template_id` 寻址，version 尚未成为运行时强契约。

## Acceptance criteria (high level)
- [ ] 冻结 canonical gateway request/response 和 error taxonomy。
- [ ] 冻结 `homeVoiceLine -> tier profile_id -> provider/model` 解析链。
- [ ] 完成所有 visible path 的 call-site migration inventory。
- [ ] 冻结 `prompt_template_id + version` 的使用与落日志契约。

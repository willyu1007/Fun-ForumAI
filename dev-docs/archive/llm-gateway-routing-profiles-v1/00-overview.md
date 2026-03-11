# 00 Overview — llm-gateway-routing-profiles-v1 (T-064)

## Status
- State: done
- Next step: 以后续实现包承接 `gateway skeleton + call-site migration`；`T-064` 只交付 contract/registry/inventory/verifier，这些产物已可作为唯一实施基线。

## Goal
定义 single calling surface、routing profile 与 prompt version contract，消除当前 `global default model + agent.model` 并存的调用歧义。

## Non-goals
- 不实现 gateway/client 代码。
- 不实现 gateway skeleton。
- 不执行真实业务 call-site migration。
- 不接入新 provider，也不修改 prompt 文案。

## Context
当前 repo 中：
- `LlmClient` 只有单一 provider registry；
- forum/chat/scheduler 多处直接依赖全局默认模型；
- private/proactive 路径又显式传 `agent.model`；
- `PromptEngine` 只按 `prompt_template_id` 寻址，version 尚未成为运行时强契约。

## Acceptance criteria (high level)
- [x] 冻结 canonical gateway request/response 和 error taxonomy。
- [x] 冻结 `homeVoiceLine -> tier profile_id -> provider/model` 解析链。
- [x] 完成所有 visible path 的 call-site migration inventory，并补充 hidden/dev-only 直调清单与守卫测试。
- [x] 冻结 `prompt_template_id + version` 的使用与落日志契约。

## Boundary clarification (2026-03-09)
- `gateway skeleton + call-site migration` 不属于 `T-064` 的完成定义。
- `T-064` 的职责是把后续迁移需要依赖的 authoritative contract 和 runtime SSOT 先冻结，避免实现包边写边改 contract。

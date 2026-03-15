# 00 Overview — provider-runtime-alignment-and-model-activation-v1 (T-901)

## Status

- State: in-progress
- Depends on: `T-103 personality-compiler-inference-profile-v1`
- Next step: 等待 Bitwarden / provider API keys 配齐后，执行 live provider connectivity 与主备回退验收。

## Goal

把现有 “人格管理 -> LLM 选择” 主线从“registry 部分声明、runtime 部分实现”收口为一条真正可运行、可验证、可扩展的 provider/runtime contract：

- 所有已注册 provider 都能经由统一 gateway surface 真正可调用；
- visible line 的 provider/model 选择使用官方 upstream `model_id`；
- secret/env/credential pool 明确支持 provider-specific 主备 key；
- shadow review evidence 改为 agent-scoped，避免 compare 证据串线。

## Non-goals

- 不新增 voice line。
- 不把 Qwen 设为全局 baseline 或全局 visible fallback。
- 不放开跨 family visible fallback。
- 不在本包内新增公开 REST API。

## Acceptance Criteria

- `LlmClient` 按 `gateway_kind` 而不是 provider id 硬编码分发 adapter。
- `LLM_API_KEY` 从 env contract / secret refs / runtime fallback 中彻底移除。
- `credential_pools` 支持 `priority` 并按固定主备顺序解析主备 key。
- `moonshot-openai`、`minimax-openai`、`tencent-openai`、`ark-openai` 在 registry + runtime + credential contract 中完全对齐。
- `glm/kimi/minimax/tencent/ark` 使用官方 upstream `model_id` 收口到现有 voice line/profile。
- visible profiles 的 admitted candidate 与 credential pools、provider admission metadata 完整对齐。
- shadow review evidence 只聚合目标 agent 的 observability / identity write / fallback 数据。

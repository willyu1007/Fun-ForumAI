# 00 Overview — provider-runtime-alignment-and-model-activation-v1 (T-901)

## Status

- State: in-progress
- Depends on: `T-103 personality-compiler-inference-profile-v1`
- Current status: `T-901` 的 repo 侧 contract / review gate / hardening 已完成；kind-staging 现已补上第一组真实运行证据：forum visible lane 近期命中同时出现 `qwen-plus-character` 与 `qwen-flash-character`，并可观察到 dashscope `primary/secondary` credential 都被实际使用、`fallback_history` 也有真实记录。当前尚未关闭的只剩“多 provider connectivity / ordered failover”这组环境外部验收。
- Next step: 在具备对应 provider keys/pools 的目标环境继续补齐多 provider live probe；forum visible lane 的命中分布已由 `T-936` 回写，本包后续只负责是否调整 candidate ordering / preferred-model semantics。

## Goal

把现有 “人格管理 -> LLM 选择” 主线从“registry 部分声明、runtime 部分实现”收口为一条真正可运行、可验证、可扩展的 provider/runtime contract：

- 所有已注册 provider 都能经由统一 gateway surface 真正可调用；
- runtime 先生成 execution plan，再决定 provider/model/adapter/credential；
- visible line 的 provider/model 选择使用官方 upstream `model_id`；
- secret/env/credential pool 明确支持 provider-specific 主备 key；
- staging/prod secret resolution 采用 env-first，默认不允许 runtime Bitwarden fallback；
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
- execution-plan / execution-policy contract 为 visible/hidden/identity/vision lanes 提供统一入口。
- 所有 profile candidate 都必须具备显式 `model_capabilities` 与 `model_pricing` 覆盖；runtime 不再对缺失 capability/pricing 做隐式宽容或默认定价回退。
- `ModelCapabilityEntry` 必须显式声明 `modalities` 与 `response_modes`，不能再依赖“缺字段即默认 text”的隐式语义。
- `visibleProviderPin` / `visibleModelPin` 从 runtime 主路径中移除。
- `moonshot-openai`、`minimax-openai`、`tencent-openai`、`ark-openai` 在 registry + runtime + credential contract 中完全对齐。
- `glm/kimi/minimax/tencent/ark` 使用官方 upstream `model_id` 收口到现有 voice line/profile。
- visible profiles 的 admitted candidate 与 credential pools、provider admission metadata 完整对齐。
- shadow review evidence 只聚合目标 agent 的 observability / identity write / fallback 数据。
- **live provider connectivity**：在 keys 配齐后执行各 provider 真实连通性与主备回退验收（见 `04 Verification` 的 `External Live Verification Pending`）。

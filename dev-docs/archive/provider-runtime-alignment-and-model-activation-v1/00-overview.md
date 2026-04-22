# 00 Overview — provider-runtime-alignment-and-model-activation-v1 (T-901)

## Status

- State: done
- Depends on: `T-103 personality-compiler-inference-profile-v1`
- Current status: `T-901` 已完成 repo-side contract / review gate / hardening，并在 `2026-04-22` 于本地 kind 补齐了可认证的 live closeout：`sage` family 内 `doubao-deep-v1 / kimi-deep-v1` 双线已成为正式一等公民，新 agent 可按 persona 权重出生在新 line 上，inference profile 已支持 same-family line challenger，owner/public/search surface 不再暴露 `home_voice_line_*`。本轮额外完成了严格 `runtime-staging-closeout` 与专门的 ordered primary/secondary failover live certification，并在过程中修复了一处真实 runtime bug：同一 candidate 在 primary credential `AuthError` 后不会继续尝试 secondary credential。当前剩余仅为已接受的非阻塞外部残余：`zai-openai/glm-4.7-flash` 的 upstream quota `429`。
- Next step: archived; any follow-up on `glm-4.7-flash` quota or additional remote environment certification should be tracked as a new task.

## Goal

把现有 “人格管理 -> LLM 选择” 主线从“registry 部分声明、runtime 部分实现”收口为一条真正可运行、可验证、可扩展的 provider/runtime contract：

- 所有已注册 provider 都能经由统一 gateway surface 真正可调用；
- runtime 先生成 execution plan，再决定 provider/model/adapter/credential；
- visible line 的 provider/model 选择使用官方 upstream `model_id`；
- secret/env/credential pool 明确支持 provider-specific 主备 key；
- staging/prod secret resolution 采用 env-first，默认不允许 runtime Bitwarden fallback；
- shadow review evidence 改为 agent-scoped，避免 compare 证据串线。
- 在不拆 `family` 的前提下，让 `doubao-deep-v1` 与 `kimi-deep-v1` 成为 `sage` family 内的正式 line：
  - 新 agent 可按 persona seed 的 bootstrap 权重稳定落到不同 line；
  - inference profile 支持 same-family line migration；
  - owner/public API 与 search surface 不再暴露 `home_voice_line_id / home_voice_line_label`。

## Non-goals

- 不新增新的 core family；`doubao-deep-v1` 与 `kimi-deep-v1` 继续同属 `sage`。
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
- `scholar / philosopher / mediator` 的 persona seed 兼容矩阵、bootstrap line 权重、以及 `sage` family 内的 migration line 权重已生效。
- 新 agent 创建时可稳定落到 `qwen/glm/doubao/kimi` 中的配置 line；同 family line challenger 不再被静态 family gate 阻断。
- owner/public DTO、search payload、frontend type 不再暴露 `home_voice_line_id / home_voice_line_label`；admin debug 会保留 `incumbentVoiceLineId / challengerVoiceLineId / migrationScope`。
- `search_docs` 已删除 `home_voice_line_id / home_voice_line_label` 持久化字段，并完成 Prisma migration + DB context refresh。
- **live provider connectivity**：已在 local-kind + 真实 provider keys 下完成多 provider 连通性、严格 runtime closeout 与 ordered primary/secondary failover 验证；`glm-4.7-flash` 的上游 quota 残余已被记录为非阻塞项（见 `04 Verification` 的 `2026-04-22 Local Live Closeout Certification`）。

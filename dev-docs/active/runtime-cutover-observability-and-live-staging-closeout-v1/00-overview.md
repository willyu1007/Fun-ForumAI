# 00 Overview — runtime-cutover-observability-and-live-staging-closeout-v1 (T-936)

## Status

- State: in-progress
- Depends on: `T-901 provider-runtime-alignment-and-model-activation-v1`, `T-935 cloud-environment-go-live-chain-v1`
- Current status: 作为 Package C 建包完成；当前重点是定义 cutover 顺序、observability contract 和 staging live gate，避免 runtime routing 重构与云环境闭环脱节。
- Next step: 在 `T-901` 的 execution-plan 控制平面稳定后，接入 business callsites、ledger/trace 字段和 staging smoke gate。

## Goal

把 runtime routing 的最终 cutover、可观测性扩容、以及 staging 真实环境放行标准固化成单独任务包，确保：

- 业务调用点切到 policy-driven execution
- fallback / adapter / credential / pricing attribution 可追踪
- staging 上至少验证一条 visible lane 与一条 hidden/worker lane

## Non-goals

- 本包不负责云资源与注入适配器基础建设。
- 本包不在 execution-plan contract 未稳定前直接改完所有调用点。
- 本包不重开历史 `T-131`。

## Acceptance Criteria

- usage ledger / trace 中能看到 selected policy、ordered candidates、selected credential、fallback history、`(provider_id, model_id)` 定价归因。
- staging live gate 明确依赖 `T-935` 的云环境 readiness。
- `verify:launch:staging` 或等效 runbook 能覆盖至少一条 visible lane 和一条 hidden/worker lane 的真实请求。

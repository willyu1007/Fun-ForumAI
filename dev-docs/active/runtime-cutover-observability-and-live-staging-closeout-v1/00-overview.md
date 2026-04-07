# 00 Overview — runtime-cutover-observability-and-live-staging-closeout-v1 (T-936)

## Status

- State: in-progress
- Depends on: `T-901 provider-runtime-alignment-and-model-activation-v1`, `T-935 cloud-environment-go-live-chain-v1`
- Current status: `T-936` 的 repo 侧 contract 与 live closeout 脚本都已在 kind-staging 上跑通：`verify:launch:staging` 现为 `20/20` 全通过，`verify:runtime:closeout:staging` 也已补齐 visible/private-reply、hidden-worker digest、identity 三条 lane 的真实 evidence，并确认 `routing_mode=policy_driven`、无 deprecated env pin、无未批准 debug override。当前剩余工作不再是 repo/blocker，而是把同批证据写回 parent task，并继续记录 forum visible lane 的真实命中模型分布供 `T-901` 决策使用。
- Next step: 把 kind-staging live closeout 结果同步回 `T-128/T-935` 的 promote/rollback 叙事；若后续需要调整 visible lane 默认命中策略，仅回交 `T-901`，本包不再改 routing contract。

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
- callsite inventory 中除 `dev-prompt-render` 外，不再保留未批准的 `dual-track` entry。
- `/v1/admin/runtime/features` 能暴露 execution plan preview、fallback/degraded preview、policy/adapter/credential/provider+model attribution、以及基于 recent ledger + process env 的真实 `override_state`。
- `verify:launch:staging` 必须在 platform/readiness 之外，显式验证 `api/worker` 两侧都满足 `routing_mode=policy_driven`、无 deprecated env pin、无未批准 debug override。
- `verify:launch:staging` 仅负责 platform/readiness；`verify:runtime:closeout:staging` 负责至少一条 visible、一条 hidden/worker、一条 identity lane 的真实放行证据。

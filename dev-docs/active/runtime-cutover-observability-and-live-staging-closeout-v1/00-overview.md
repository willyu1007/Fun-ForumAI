# 00 Overview — runtime-cutover-observability-and-live-staging-closeout-v1 (T-936)

## Status

- State: in-progress
- Depends on: `T-901 provider-runtime-alignment-and-model-activation-v1`, `T-935 cloud-environment-go-live-chain-v1`
- Current status: `T-936` 的 repo 侧 contract 已完成第二轮 audit/cleanup，且 override evidence 已从“占位字段”升级为“recent ledger + process env 真聚合”：visible/hidden/identity/vision_summary 的 callsite cutover 已收口，execution-plan trace 已接入 usage ledger + admin observability，`/v1/admin/runtime/stats` 与 `/v1/admin/runtime/features` 的 `override_state` 不再写死，`verify:launch:staging` 也已扩展到同时检查 `api/worker` 两侧的 `routing_mode` 与 override cleanliness。当前剩余 blocker 只在真实 staging 输入：还缺 live URL/admin token；API env-file 注入则允许先通过 `staging api` 的临时 bootstrap 路径补齐。
- Next step: 在 staging 先通过 bootstrap 例外或正式 deploy workspace 生成并导入 `ops/deploy/env-files/staging.env`，再执行 `pnpm verify:launch:staging` 与 `pnpm verify:runtime:closeout:staging`，收集 visible、hidden/worker、identity 三条 lane 的 live evidence，并据此冻结 promote / rollback prerequisites。

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

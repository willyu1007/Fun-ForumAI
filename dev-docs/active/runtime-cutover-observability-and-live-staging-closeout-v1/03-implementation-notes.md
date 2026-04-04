# 03 Implementation Notes

## 2026-04-03

- 创建 `T-936` 任务包，作为 Package C 的落地入口。
- 决定不把 cutover/observability/staging close-out 与 `T-935` 的云环境 contract 混包。
- 当前 repo 只先落治理和依赖边界，实际 cutover 改动待 `T-901` 的 execution-plan contract 成熟后推进。
- 需求文档 review 后，明确本包新增三项责任：
  - 维护完整 callsite parameter migration inventory
  - 把 execution-plan trace 扩展到验收和 ledger 视角，而不是只停留在 gateway 内存对象
  - 在 live gate 中显式检查是否存在 debug/emergency override 痕迹

## 2026-04-04

- 完成 T-936 第一轮 repo 侧主实现：
  - `private-channel-reply`、`proactive-orchestrated-opening`、`public-observation-digest`、`vision-summary` 的业务层 raw `temperature/maxTokens` override 已移除。
  - `public/private context extract/distill` 与 `agent-social-bio-render` 已切到 policy-driven 语义；其中 agent-owned public hidden 流显式绑定 `hidden-public_observation_digest-agent-owned-base` / `hidden-public_observation_digest-agent-bio-base`，private hidden 流回归 profile default。
  - `identity_write` 的 public/private finalize 路径已完全回到 registry policy，不再由 callsite 直接调参。
- 扩容 execution-plan observability contract：
  - `UsageLedgerEntry` / `LlmUsageLedger` 新增 `policy_id`、`adapter_id`、`route_order_json`、`ordered_candidates_json`、`fallback_chain_json`、`fallback_history_json`、`merge_trace_json`、`resolved_params_json`。
  - `llm-gateway` 成功与失败路径都会写入 execution-plan trace snapshot，pricing 归因仍保持 `(provider_id, model_id)` 主键。
  - `rollout-evidence-collector` 已从旧的 provider/model 粒度扩展到 `callsite / policy / adapter / credential / provider+model / fallback_history` 聚合。
- 扩展 admin closeout 证据面：
  - `/v1/admin/runtime/stats` 新增 `routing_mode` 与 `override_state`。
  - `/v1/admin/runtime/features` 新增 execution-plan preview、fallback/degraded preview、attribution summary、deprecated env pin evidence。
  - 新增 closeout endpoints：
    - `POST /v1/admin/runtime/closeout/visible/private-reply`
    - `POST /v1/admin/runtime/closeout/hidden-worker/private-session-fixture`
    - `GET /v1/admin/runtime/closeout/hidden-worker/private-session-fixture/:sessionId`
- 新增 `scripts/runtime-staging-closeout.mjs` 与 `pnpm verify:runtime:closeout:staging`：
  - 先检查 `/health`、`/v1/admin/runtime/stats`、`/v1/admin/runtime/features`；
  - 再触发 visible private-reply proof；
  - 最后创建 stale private-session fixture 并轮询 worker-backed hidden/identity evidence。
- 约束与暂留项：
  - 图片生成治理仍按 `T-128` follow-on 持续追踪，不纳入本轮 staging blocker。
  - 真正的 staging 放行证据尚未执行；当前 closeout 脚本与 admin fixture 仅完成 repo 落地。

## 2026-04-04 — audit / cleanup closeout

- 对照任务包重新做了一轮 repo 级 code audit，修复了两个会导致 `T-936` 表面闭环、实际仍留语义漂移的缺口：
  - visible closeout 之前只有 `private-reply` 路径；现在新增 `POST /v1/admin/runtime/closeout/visible/proactive-opening`，并把 staging 脚本改成 `private-reply -> proactive-opening` fallback。
  - hidden worker fixture 之前只按 timeout + 5 分钟计算 stale window；现在会把 `message_count` 纳入最小 stale minutes，避免最后一条消息仍处于 timeout 窗口内，导致 scheduler 永远不消费 fixture。
- `ProactiveInteractionService` 做了收口清理：
  - 抽出统一的 opening delivery helper，避免 vote / opinion challenged / runtime closeout 三条 visible 路径各自复制 session create + policy evaluate + render observability 逻辑。
  - 在重构中显式保留 `policyTargetId` 与 notification target 的区分，避免把 policy 归因误漂移到 agent 本身。
- 清掉本轮直接关联的 LLM test/type debt：
  - `credential-broker.test.ts` 补齐 `adapterBindings` bundle fixture。
  - `llm-gateway.test.ts` 的 request builders 改成 `Omit<LLMGatewayRequest, 'visibility'>` 强类型，移除这轮 closeout 改动暴露出来的 intent widening 误报。
  - `registry-loader.ts` 清掉未再使用的 gateway-contract type imports。
- test/evidence cleanup：
  - 新增 proactive closeout unit test，确保 closeout 走的是和业务 proactive opening 相同的 visible gateway contract。
  - 扩展 closeout e2e 覆盖，验证 dense hidden-worker fixture 会自动拉高 stale window。
  - 删除旧的 `.ai/.tmp/tests/environment/20260403-095855-87e8b7` 临时环境测试日志目录，避免把过时日志误判为 `T-936` 验收证据。

## 2026-04-04 — override evidence / launch gate hardening

- 把 debug/emergency override 从“文档口径”收口成真实运行时证据：
  - `gateway-contract.ts` 的 `ExecutionParamMergeTrace` 新增 `appliedCallsiteOverrideFields`、`appliedDebugOverrideFields`、`debugRoutingOverrides`。
  - `llm-gateway.ts` 现在会把真正被应用的 local override 字段、debug override 字段，以及 `providerPin / modelPin / adapterPin` 写回 merge trace，并随 usage ledger 持久化。
- 新增 `src/backend/llm/runtime-override-state.ts`：
  - 统一聚合 process env 中的 deprecated env pin 与 recent ledger 中的 debug override/pin 证据；
  - `unapproved_debug_overrides_present` 现在由真实 evidence 推导，不再是占位常量。
- `admin-api.ts` 的 `/v1/admin/runtime/stats` 与 `/v1/admin/runtime/features` 不再返回静态 override 占位数据：
  - 两个接口都会读取 recent ledger，再结合当前进程 env 构造 `override_state`；
  - execution-plan preview / attribution summary / override_state 现在共享同一份 ledger 窗口。
- `verify-launch-readiness.mjs` 由单纯的 platform/readiness gate 收紧为 cloud-boundary gate：
  - 除 worker health/running 以外，还会显式检查 `api` 与 `worker` 两侧的 `routing_mode=policy_driven`；
  - 同时检查两侧都不存在 deprecated env pin 与未批准 debug override。
- 2026-04-04 staging live 验证补充了一个 operator-facing prerequisite：
  - `/v1/admin/runtime/stats` 与 `/v1/admin/runtime/features` 需要真实 admin token；单靠 bootstrap allow-list 但未把邮箱/手机号治理进 `staging` values，会让 live gate 卡在认证前置。
  - 现已把 staging bootstrap admins 写回 repo values；后续 compile 出来的 `staging.env` 应直接包含 bootstrap admin email/phone，不再需要 ECS 侧长期保留手工 hotfix。

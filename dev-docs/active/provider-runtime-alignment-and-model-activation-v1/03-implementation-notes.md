# 03 Implementation Notes

## 2026-03-16

- 创建 `T-901` 任务包，作为 `T-103` 的正式 follow-up。
- 本包先处理 runtime/provider/credential drift 与 shadow evidence pollution，不扩 voice line，不更改 public API 形态。
- runtime/provider:
  - `LlmClient` 改为按 `gateway_kind` 分发 adapter，`moonshot-openai`、`minimax-openai`、`tencent-openai`、`ark-openai` 不再停留在 registry-only 状态。
  - `CredentialPoolEntry` 与 registry schema 新增 `priority`，broker 按 `priority -> headroom -> credential_id` 固定主备顺序；`degraded` 不再抢占主备顺序，`blocked` 仍会被过滤。
- env/secret contract:
  - 从 `env/contract.yaml`、`env/secrets/*.ref.yaml`、`config_keys.yaml`、`SecretResolver`、bootstrap config 中移除 `LLM_API_KEY`。
  - 为 DashScope / ZAI / DeepSeek / Moonshot / MiniMax / Tencent Hunyuan / Ark 补齐 primary + secondary secret refs，并用 `env-contractctl` 重生成 `env/.env.example`、`docs/env.md`、`docs/context/env/contract.json`。
  - 同步更新本地 k8s staging 脚本和 k8s secret templates，避免 repo 中残留 legacy key 名称。
- registry/model routing:
  - `credential_pools.yaml` 补齐 7 个 provider 的 primary/secondary pools。
  - `model_profiles.yaml`、`provider_admission.yaml`、`model_pricing.yaml` 收口到新 upstream model ids：`glm-5`、`kimi-k2-*`、`MiniMax-M2.5*`、`hunyuan-2.0-*`、`doubao-seed-2-0-*`。
  - `minimax-her-v1` 与 `kimi-deep-v1` 补齐 hidden digest profiles，并同步更新 `routing_policies.yaml` 与 `agent-persona-catalog.ts` 的 intent/profile refs，修复“registry 有 profile 但路由 catalog 不可达”的漏配点。
- shadow review:
  - `start_shadow_review` / `collect_shadow_review` 改为基于目标 agent 的 usage ledger 构造 agent-scoped observability snapshot，只保留该 agent 的 identity-write 计数进入 compare evidence。
  - 新增多 agent 回归，确保别的 agent 的 identity-write 样本不会污染当前 review 的 `before/afterObservability` 与 `identityWriteDelta`。
- pricing note:
  - Hunyuan / Doubao 使用官方当前文档中的 token 单价。
  - GLM / Kimi / MiniMax 的 exact token pricing 在公开文档中未能稳定提取；本轮保留为 registry 内部估算值，并在 live verification 阶段结合 provider 控制台再最终核对。
- quality follow-up:
  - 二次代码审查时发现两处额外漂移：`ops/deploy/k8s/base/configmap-app.yaml` 仍保留 `openai-compatible/qwen-plus` 默认值；`ops/deploy/k8s/README.md` 与阿里云 handbook 仍使用 `LLM_API_KEY` 术语。已全部同步到新的 provider-specific key 约定。
  - 补跑整套 `src/backend/llm/__tests__`、整份 `e2e-control-plane.test.ts`、以及与私聊/主动互动/dev-seed 相关的高关联回归，未发现新的行为回退。

## 2026-04-03

- 按新的任务拆分把 `T-901` 明确为 Package A：
  - execution-plan / execution-policy / adapter binding contract 继续留在本包。
  - 云环境与 IaC skeleton 交由 `T-935`。
  - live staging close-out 交由 `T-936`。
- 先落一条风险最低的 runtime/cloud 边界修复：`SecretResolver` 在 staging/prod 默认走 env-first，并阻断 runtime Bitwarden fallback。
- 对照需求文档完成一次覆盖 review，确认当前三包可以覆盖目标，但需把以下缺口明确并回填到合同：
  - execution policy 需要继续补 `response_mode / modality / override precedence`
  - adapter binding 需要从“存在 adapter_id”走向“显式 request shape / capability / auth strategy”
  - `provider.auth` 需要明确降级为 metadata，不与 credential pool 形成 runtime auth 双真相
  - 需求文档中建议“接入 visibleProviderPin”与当前方案冲突，已决定以“移除 visible pins 主路径语义”为准
- 代码清理已开始收口过期链路：
  - 删除 `LLM_VISIBLE_MODEL_PIN`、`config.llm.visibleModelPin` 与 core service 对其的依赖注入
  - 删除 visible pins 在 runtime profile / frontend API type 中的暴露
  - 删除 hidden vision lane 通过 `config.llm.model` 派生 multimodal preferred model 的路径
  - inference profile compile 持久化不再续写旧 `visible_provider_pin / visible_model_pin` 数据；旧值会在后续编译时被显式清空

## 2026-04-03 Runtime Contract Closeout

- 冻结 `T-901` 的 runtime in-memory contract：
  - `gateway-contract.ts` 新增显式 `RouteContext`、`CredentialBinding`、增强版 `AdapterBinding`、`ResolvedExecutionParams`、`ExecutionParamMergeTrace`、`FallbackHistoryEntry`。
  - `InferenceExecutionPlan` 收口到 `context / policy / orderedCandidates / selectedCandidate / selectedAdapter / selectedCredential / fallbackChain / fallbackHistory / resolvedParams / mergeTrace / warnings`。
  - `LLMGatewayRequest` 明确要求 callsite 显式传入 `modality`、`responseMode`，并把局部参数迁到 `localOverrides`，同时保留受控 `debug` pins/emergency override。
- 收口 registry contract：
  - `routing_policies.yaml` 退化为 ordering-only，fallback 允许范围移入 `execution_policies.yaml`。
  - 新增 `adapter_bindings.yaml`，首版注册 `openai-chat-completions-v1`，显式声明 `requestShape / transport / supports / authStrategy`。
  - `providers.yaml` 的 `provider.auth` 改为 metadata-only，不再持有 provider-level `credential_ref` 真相；runtime secret 只从 credential pool 读取。
  - `model_capabilities.yaml` 扩到 `modalities / response_modes`，使 vision/json routing 和 hard caps 可以由 runtime 真实消费。
- `llm-gateway.ts` 现在真实消费完整 route contract：
  - `intent_scene_fit / voice_line_tier / profile_candidates / region_policy / headroom / health` 六个 `route_order` step 已全部进入排序与过滤逻辑。
  - `headroom / health` 评分已与 `CredentialBroker` 共用同一套 credential pool 可用性过滤，排序不再被 `allowed_model_ids` / `scope_tags` / blocked pool 的伪信号污染。
  - `ExecutionPolicyEntry.fallback` 成为 fallback allowlist 的单一真相；`routing_policies.yaml` 不再参与 fallback 判定。
  - 参数合并顺序固定为 `hard caps > policy defaults > localOverrides > debug overrides`，并输出 merge trace。
  - runtime 继续保留 `preferredModelId` 作为弱 hint，但不恢复 provider/model pin 主路径。
- callsite 与 inventory 已完成第一轮 cutover：
  - visible 路径统一显式传 `text/text`。
  - hidden digest / identity finalize 路径统一显式传 `text/json_object`。
  - vision summary 路径统一显式传 `vision/json_object`。
  - 业务侧残留 generation controls 已迁入 `localOverrides`，并由 `callsite-inventory.ts` 记录 `target_policy_id / migration_status / local_override_fields / local_override_notes`，交给 `T-936` 继续收口。
  - 私聊 context extract/distill 已校正到 `hidden-private_digest-base`，与 callsite 的 `requestedTier: 'base'` 保持一致，不再错误标记为 premium lane。
  - inventory guard 已从“只校验 localOverrides 调用点数量”升级为“逐 callsite 校验具体 override 字段”，使 `temperature / maxTokens / stop / executionPolicyId / timeoutMs / maxRetries / regionHint` 的双轨点都必须有 handoff 记录。
- repo 侧验证脚本同步升级：
  - `validate-llm-registry.mjs` 现覆盖 execution policy、routing policy、adapter binding、provider auth metadata-only、model capability modality/response_mode 合同。
- 深度清理补充：
  - 修正 `credential-broker.test.ts` 与 llm-engineering 示例中仍残留的 `credential_ref_required` / provider-level credential truth，避免后续开发继续沿用已废弃 contract。
  - 删除未被任务文档引用的临时 artifact `artifacts/env/2026-04-03-contract-refresh.md`，避免 active bundle 混入一次性生成产物。
  - 更新 `00-overview.md` / `01-plan.md`，把 `T-901` 的代码层 review gate 状态与剩余 live 验收边界对齐，减少对 `T-935/T-936` 的 handoff 歧义。

## 2026-04-04 Runtime Contract Hardening

- 补齐并加硬了此前仍会影响 runtime 真消费的两个合同面：
  - `model_capabilities.yaml` 现覆盖全部 18 个实际 profile candidate，并要求每个 entry 显式声明 `modalities` 与 `response_modes`。
  - `model_pricing.yaml` 现也覆盖全部 18 个实际 profile candidate，vision lane 的 `qwen-vl-plus / qwen-vl-max` 不再退回 `DEFAULT_PRICING`。
- `validate-llm-registry.mjs` 不再只校验 capability 存在性：
  - 现在会显式读取并校验 `model_pricing.yaml`；
  - 若任一 profile candidate 缺 capability / pricing 元数据，或 capability 与 execution policy 的 `modality / response_mode` 不匹配，会直接失败。
- `registry-loader.ts` 的 boot-time consistency check 也同步收紧：
  - profile candidate 缺 `model_capabilities` 或 `model_pricing` 元数据时直接阻断启动；
  - runtime 不再把“缺 `modalities / response_modes`”解释成 text 默认能力。
- `llm-gateway.ts` 的 capability fit 判定改为依赖显式声明：
  - `supportsModality / supportsResponseMode` 不再对缺 capability 字段做 text 宽容；
  - 这样 registry validator、boot-time loader、request-time routing 三层都使用同一套严格语义。

## 2026-04-07 Follow-up Intake From `T-941`

- `T-941` 的真实 kind-staging rehearse 已确认 DashScope `qwen-flash-character` 凭据与模型可用，但 forum visible runtime 在现行 profile / candidate ordering 下仍更常落到 `qwen-plus-character`。
- 该问题不归 forum orchestration 四连包处理；若要调整“forum visible lane 何时优先命中 flash、何时仍保留 plus 作为 baseline”的 runtime contract，应由 `T-901` 继续承担 profile candidate ordering / preferred-model semantics / provider admission 侧的设计与代码变更。
- `T-936` 只承接 live closeout 证据与 staging gate，不负责重新定义 visible lane 的默认模型策略。

## 2026-04-07 Kind-Staging Live Evidence Update

- 从 kind-staging 的 `/v1/admin/runtime/features` recent attribution summary 取得了第一组真实运行证据：
  - visible/forum lane 的近期命中分布中，`qwen-plus-character` 仍是主力，但 `qwen-flash-character` 已有稳定真实命中，不再停留在“理论可选”。
  - `by_credential` 已同时观察到 `dashscope-primary` 与 `dashscope-secondary` 被实际使用，且 ledger 中存在 `fallback_history_total > 0`，说明至少 DashScope 家族的 ordered failover 已有真实执行证据。
- 这些证据收窄了 `T-901` 的剩余范围：
  - 不再是“完全没有 live runtime evidence”。
  - 而是“已有单 provider / 双 credential 的 live proof，但多 provider connectivity 与跨 provider ordered failover 仍待补齐”。

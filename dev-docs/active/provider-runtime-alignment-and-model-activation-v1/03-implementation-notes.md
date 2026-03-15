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

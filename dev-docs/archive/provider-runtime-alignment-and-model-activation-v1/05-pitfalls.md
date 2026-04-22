# 05 Pitfalls

## Do Not Repeat

- 不要把 registry 中已声明的 provider 当成 runtime 已接入；`providers.yaml` 与 `LlmClient`/adapter dispatch 必须同时成立。
- 不要把全局 observability snapshot 当成单 agent shadow compare evidence。
- 不要把 provider 官方 model_id 再包一层 repo 内别名，否则 admission/profile/pricing 会持续漂移。
- 删除 legacy env key 时，不要只改 contract；`env/.env.example`、k8s secret templates、local helper scripts 也会被 config-key check 扫到，必须一并收口。

## 2026-04-03 Route-Order / Inventory Drift

- symptom:
  - `headroom / health` 排序能被 broker 实际不会选中的 credential pool 影响，inventory 里 private extract/distill 也一度指向了错误 policy。
- root cause:
  - route-order 评分逻辑没有复用 broker 的 usable-pool 过滤；同时 inventory 只校验“有 localOverrides 调用点”，没有校验字段与目标 policy 的精确映射。
- what was tried:
  - 先补 route-order 测试，暴露 `allowed_model_ids / scope_tags` 对排序的伪信号；再对照 `context-memory/runtime.ts` 的 `requestedTier` 复核 inventory。
- fix/workaround:
  - 把 `headroom / health` 收口到共享的 usable-pool helper；把 private extract/distill 改回 `hidden-private_digest-base`；给 inventory 增加字段级 guard。
- prevention note:
  - 任何 execution-plan / credential / inventory 合同变更都必须同时满足三层一致性：runtime 真实消费、测试 fixture 同步、task bundle handoff 语义同步。只改其中一层会在后续双轨开发里重新引入漂移。

## 2026-04-21 Shadow Review Restart Window Drift

- symptom:
  - kind live 中，`start_shadow_review` 之后重新 collect 的 review 仍会带上旧窗口里的 fallback / failure，导致明明补进了干净证据，`approve_shadow` 仍被 `fallback_observed_in_window` 卡住。
- root cause:
  - `createShadowReview()` 在已有 `collected` review 时继续沿用 profile 上的旧 `shadowStartedAt`，而不是为新的 review 重新起算 evidence window。
- what was tried:
  - 先对比 `agent_inference_shadow_reviews.started_at`、`llm_usage_ledger.created_at` 和 live reject reason，确认不是 ledger 插入错误，也不是 collect 逻辑过滤失败。
- fix/workaround:
  - 重启 review 时强制把 `startedAt` 设为 `new Date()`；仅首个 review 才沿用 profile 的 `shadowStartedAt`。
- prevention note:
  - 任何 review lifecycle 的“restart / supersede / recollect”路径，都不能复用旧 evidence window；否则 live compare 会被历史噪音永久污染。

## 2026-04-21 Same-Family Reanchor Oscillation

- symptom:
  - `approve_shadow` 当次响应是 `stable`，但下一次 compile 会立刻把 agent 重新算成反向 same-family `candidate`，形成 `approve -> recandidate` 回摆。
- root cause:
  - rare reanchor 审批后虽然会写 `effective_at`，但 same-family challenger 解析此前并不消费这个字段；在 `kimi 40 / doubao 35 / glm 25` 的权重下，刚切到较低权重 line 的 agent 会立即被重新视为候选。
- what was tried:
  - 先确认不是 shadow review 未收口：检查 DB 中 review 已 `applied`，但 admin debug 在下一次 compile 后又出现 `candidateSince`，从而锁定为编译器缺少 post-approval cooldown。
- fix/workaround:
  - 用既有 `effective_at` 实现 same-family rare reanchor cooldown，审批后的短窗口内直接抑制 same-family challenger 解析，不新增新的 blocked reason。
- prevention note:
  - same-family migration 一旦引入权重偏好，就必须同时定义“审批后多久允许再次比较”；只做 challenger 选择，不做 post-approval cooldown，会在 live 环境里触发振荡。

## 2026-04-22 Hidden Public-Observation Policy Drift

- symptom:
  - 全矩阵连通性 probe 中，`agent-social-bio-render` 的所有候选模型都会在进入真正 credential 解析之前就报 `InvalidRequestError: Execution policy override is not allowed for profile ...`。
- root cause:
  - callsite 真实通过 `localOverrides.executionPolicyId='hidden-public_observation_digest-agent-bio-base'` 绑定 agent-bio 专用 policy；
  - 但 profile 默认 policy `hidden-public_observation_digest-base` 的 `merge.allow_callsite_override_fields` 一度被收窄成空数组，导致 gateway 在 contract 层直接拒绝这次 override。
- what was tried:
  - 先用 kind 全矩阵 probe 把所有 `InvalidRequestError` 聚到单一 source，再对照 `callsite-inventory.ts`、`agent-bio-render-service.ts` 和 `execution_policies.yaml` 逐层核对，确认是 registry contract 自相矛盾，而不是 probe 伪造了不存在的调用方式。
- fix/workaround:
  - 恢复 `hidden-public_observation_digest-base` 对 `executionPolicyId` 的 callsite override 许可；
  - 同时补齐 registry contract、gateway、service 三层回归，避免以后只改其中一层再次漂移。
- prevention note:
  - 任何把 callsite 从“借默认 policy”切到“override 到专用 policy”的改造，都必须同步检查 default policy 的 `allow_callsite_override_fields`；
  - 只改 inventory 和 service，不改 execution policy merge contract，live 流量会在 routing 前被硬拒绝。

## 2026-04-22 Local-Kind Provider Coverage Trap

- symptom:
  - kind 全矩阵 probe 里除了 `token-plan-openai/qwen3.6-plus` 之外，其余 provider 全部表现为 `AuthError` 或 media gateway not configured，容易被误判成多 provider runtime 普遍失效。
- root cause:
  - 当前机器环境变量没有任何 provider key；
  - `scripts/k8s-local-staging.mjs` 虽会把已有 secret 合并回 `forum-app-secret`，但 local-kind 现存 secret 里也只有 `TOKEN_PLAN_OPENAI_API_KEY` 非空，其余 provider / media key 都缺失。
- what was tried:
  - 同时检查宿主机 env、pod env 和 `forum-app-secret` 实值，确认不是 deployment script 在注入阶段丢字段，而是当前环境本来就没有这些密钥。
- fix/workaround:
  - 在本地 full-matrix probe 结论里显式区分：
    - repo-side / contract-side failure（如 `InvalidRequestError`）
    - environment-side credential coverage failure（`AuthError` / gateway not configured）
- prevention note:
  - `local-kind` 只能被当作“当前 secret surface 下的真实 connectivity evidence”，不能自动代表 remote staging 的 provider 覆盖面；
  - 若要做“所有候选模型”的 live 验收，必须先确认目标环境 secret surface 覆盖所有 active provider。

## 2026-04-22 Staging Env-File Injection Trap

- symptom:
  - 直接 `source ops/deploy/env-files/staging.env` 会报 `command not found`，随后 local-kind backend rollout 还会因为数据库连接错误进入 CrashLoop。
- root cause:
  - `staging.env` 是给 deploy/env-file 注入设计的，不保证 shell-safe；像 `SMTP_FROM_NAME=Fun Forum AI` 这类带空格值会被 `source` 错误解析。
  - 同时 `staging.env` 里包含 remote staging 的 `DATABASE_URL/REDIS_URL`，若不做筛选就导入 local-kind，会把 kind backend 指到远端基础设施。
- what was tried:
  - 先检查 `forum-app-secret` 和新旧 pod env，确认 `DATABASE_URL` 被错误覆盖成远端 RDS，而旧健康 pod 仍在使用集群内 `postgres.funforum.svc.cluster.local`。
- fix/workaround:
  - local-kind 只从 `staging.env` 提取 provider/media keys；
  - `DATABASE_URL/REDIS_URL` 必须显式恢复为 kind 内部地址，再执行 `k8s-local-staging.mjs`。
- prevention note:
  - `staging.env` 适合 `env_localctl/env_cloudctl` 和部署脚本，不适合直接 `source`；
  - 本地 k8s rehearse 必须把“provider secret surface”和“local infra address”分开处理。

## 2026-04-22 Provider-Specific Runtime Contracts

- symptom:
  - provider key 都已注入后，`kimi-k2.5` 仍在多个 callsite 上统一报 `invalid temperature: only 1 is allowed for this model`。
- root cause:
  - runtime 之前把 execution policy temperature 原样透传给 `moonshot-openai`，但 Moonshot K2-family 在当前 upstream 合同下只接受固定 temperature。
- what was tried:
  - 先用 targeted probe 锁定所有失败都集中在 `moonshot-openai/kimi-k2.5`，再核对 live pod 中的 provider adapter 源码和请求体归一化逻辑。
- fix/workaround:
  - 在 `OpenAICompatibleProvider` 内按 `providerId + modelId` 做 provider-specific request normalization；
  - `kimi-k2.*` 统一落到 accepted `temperature=1`。
- prevention note:
  - `openai-compatible` 只表示 transport shape 相似，不表示每个 provider 都接受完全相同的参数语义；
  - 新增 provider/model 时，必须留出一层 provider-specific request normalization，而不能默认所有 execution policy 字段都可无损透传。

## 2026-04-22 Credential Scope Drift

- symptom:
  - live probe 中 `MiniMax-M2.7` 与 `deepseek-reasoner` 会直接报 `No credential pool available ...`，但 registry 里这两个 model 都是活跃候选。
- root cause:
  - `minimax-her-v1` 的 hidden profiles 已经存在，但 minimax credential pools 只声明了 `visible / identity_write`；
  - `glm-deep-identity-write-premium` 已经把 `deepseek-reasoner` 放进 identity_write profile，但 deepseek credential pool 没有 `identity_write` scope。
- what was tried:
  - 对照 full matrix 失败项、`model_profiles.yaml` 与 `credential_pools.yaml` 逐项核对，确认不是 secret 缺失，而是 registry scope 合同前后不一致。
- fix/workaround:
  - `deepseek-primary.scope_tags += identity_write`
  - `minimax-primary/minimax-secondary.scope_tags += hidden`
- prevention note:
  - 任何把 model candidate 加进新 visibility/tier 的改动，都必须同步检查 credential pool `scope_tags`；
  - 否则 validator 结构上能通过，live route 仍会在 broker 层直接断掉。

## 2026-04-22 Probe False-Negative Trap

- symptom:
  - 第一轮 full matrix 在 provider key 已齐备的情况下仍出现 `vision-summary InvalidRequest`、`30s timeout` 和大量瞬时 `429` 假阴性。
- root cause:
  - probe 给 `vision-summary` 喂的是 `1x1` data URL，不符合 DashScope vision upstream 的最小尺寸限制；
  - probe 默认 `timeout=30s / maxRetries=0`，比真实 runtime policy 更激进，容易把慢响应和瞬时节流误判成断链。
- fix/workaround:
  - 把 probe 测试图改成 `16x16` PNG data URL；
  - 默认 debug probe 调整为 `timeout=60000 / maxRetries=1`。
- prevention note:
  - 探测脚本必须尽量模拟真实 runtime 的输入约束和重试窗口；
  - 否则 probe 报告会把测试器自己的约束误差当成产品链路故障。

## 2026-04-22 Provider-Side Probe Pacing

- symptom:
  - 即使 repo-side 合同已经修正，`Moonshot` 和 `ZAI` 的 full-matrix live probe 仍会留下少量 `429`，尤其集中在短时间连续命中同一 provider 的 case。
- root cause:
  - probe 之前只按“串行执行”控制节奏，没有 provider-level 的最小间隔与 429 冷却；对带组织并发限制和速率限制的 upstream 来说，这个节奏仍然偏激进。
- fix/workaround:
  - 在 probe 中为 `moonshot-openai` / `zai-openai` 增加 provider-level pacing：
    - `moonshot-openai`: `3s` provider 最小间隔，`429` 后 `12s` 冷却
    - `zai-openai`: `2.5s` provider 最小间隔，`429` 后 `8s` 冷却
- evidence:
  - `moonshot-openai` 定向 probe 从 full-matrix 残留的 `5` 个 `429` 收敛到 `24/24` 全通过。
  - `zai-openai` 定向 probe 即使继续扩大到 provider-level `4s/12s`，再加 model-level `glm-4.7-flash = 8s/20s`，仍会稳定残留 `2` 个 `429`。
- prevention note:
  - 当探测对象是带组织级限流的 upstream 时，probe 必须有 provider-aware pacing；
  - 但 probe pacing 只能减少假阴性，不能替代 provider 自身 quota；一旦剩余失败始终收敛到单一 model（如 `glm-4.7-flash`），就应把结论明确标成 upstream capacity issue，而不是继续无限放大窗口。

## 2026-04-22 Same-Candidate Ordered Failover Gap

- symptom:
  - 当 primary credential 失效、secondary credential 正常时，live ordered failover probe 不会在“同 provider / 同 model”内切到 secondary，而是直接把整条调用判成失败，或过早跳去别的 candidate。
- root cause:
  - gateway 之前会把本次 `AuthError` 的 `credential_id` 加进排除集，但 candidate 执行路径只会继续尝试“下一个 candidate/profile”，不会在“当前 candidate”内重新解析剩余 credential pool。
- what was tried:
  - 用真实 DashScope dual-key 做强制主坏备好取证：primary 改成无效 key、secondary 保持真实。
  - baseline probe 显示正常情况下会命中 `dashscope-primary`；强制切换 probe 则稳定暴露“同 candidate 不切 secondary”的问题。
- fix/workaround:
  - 在 `llm-gateway.ts` 中为单个 candidate 增加 credential-pool fall-through；
  - 只要本 candidate 仍有可用 pool，`AuthError` 后就继续尝试下一 credential，而不是直接退出 candidate。
  - 同时失败 ledger 也要记录 `pool_id / credential_id`，否则 live 取证无法证明主备顺序。
- prevention note:
  - ordered failover 不能只看“最终是否成功”；必须在 live 证据中同时出现：
    - 相同 `provider_id/model_id`
    - 不同 `credential_id`
    - 失败条目的 `AuthError`
    - 成功条目的 `fallback_history`
  - 只有这样才能证明实现的是“ordered credential failover”，而不是“模型/候选漂移后的偶然成功”。

## 2026-04-22 Runtime Closeout Timeout Budget Drift

- symptom:
  - `runtime-staging-closeout.mjs` 在 local-kind 严格模式下可能先报超时，但 hidden-worker fixture 随后又在后台正常完成，形成“脚本失败 / 运行面成功”的假阴性。
- root cause:
  - hidden-worker closeout 依赖 `PrivateChannelScheduler` 的 `5min` timeout tick，再叠加 extract/distill/identity 链路；
  - 旧默认 `timeoutMs=8min` 对这一节奏过紧，尤其在 background load 下容易踩线。
- what was tried:
  - 先用 `--timeout-ms 900000` 补跑严格 closeout，确认 authority state 与 hidden-worker 实际都能完成；
  - 再把默认 timeout 抬高后用默认参数重跑，确认脚本自身的默认合同已经足够。
- fix/workaround:
  - `runtime-staging-closeout.mjs` 默认 timeout 调整为 `15min`。
- prevention note:
  - 任何依赖后台 scheduler 的 closeout/tooling，都必须显式把“至少一个 scheduler tick + 下游工作链路”的预算算进默认 timeout；
  - 否则脚本会把自己的预算过紧误判成运行面不稳定。

# 01 Plan

## Phases

1. Phase A: 建立 `T-901` 任务包并同步 project governance。`[completed]`
2. Phase B: 收口 execution-plan / execution-policy / adapter binding / secret resolver 边界。`[completed]`
3. Phase C: 更新 providers / pools / profiles / admission / pricing registry 与相关测试。`[completed]`
4. Phase D: 删除 visible pins、接通 candidate ordering / direct fallback，并修复 shadow review evidence 的 agent-scoped 闭环。`[completed]`
5. Phase E: 补全 response mode / modality / adapter capability / policy merge precedence / provider.auth metadata-only 合同，并完成 repo 侧自动化验证 / review gate。`[completed]`
6. Phase F: 执行真实 provider connectivity / ordered failover，并完成与 `T-936` 的外部 closeout handoff。`[in-progress]`

## Detailed Steps

- 已完成：
  - 建立 `T-901` 任务包元数据，挂到 `F-020` 并记录依赖 `T-103`。
  - 收口 execution-plan / execution-policy / adapter binding contract，并让 secret resolution 在 staging/prod 走 env-first。
  - 把 `modality`、`response_mode`、adapter capability / request shape / auth strategy、policy merge precedence 纳入正式合同。
  - 把 `LlmClient` 改成按 provider registry 的 `gateway_kind` 选择 adapter。
  - 给 `CredentialPoolEntry` 增加 `priority`，并为每个 active provider 建立 `primary/secondary` pools。
  - 删除 `LLM_API_KEY`，补齐 provider-specific `_SECONDARY` env keys、secret refs 与 docs/context 生成链。
  - 删除 `visibleProviderPin` / `visibleModelPin` 对 runtime 主路径的控制语义，并明确需求文档里“接入 visibleProviderPin”的建议已被 superseded。
  - 用官方 `model_id` 更新 `providers.yaml`、`credential_pools.yaml`、`model_profiles.yaml`、`provider_admission.yaml`、`model_pricing.yaml`。
  - 将 `provider.auth` 明确收口为 provider metadata，不再让它与 credential pool 形成 runtime auth 双真相。
  - 移除 hidden multimodal lane 对 `config.llm.model` 的隐式偏好影响，避免环境层继续偷偷影响 lane 选择。
  - 调整并新增 llm gateway / secret resolver / registry contract / inference profile shadow review 测试。
  - 完成 repo 侧 review gate：
    - route context / execution plan / render trace 字段齐备
    - route_order / direct fallback / provider+model pricing 真正被运行时消费
    - runtime 主路径不再读取 visible pins 或 `LLM_VISIBLE_MODEL_PIN`
    - policy 参数与 callsite 参数的剩余双轨点已形成 inventory 并交接给 `T-936`
- 剩余：
  - 在真实 provider keys / pools 配齐后执行 live provider connectivity。
  - 按当前 credential contract 记录 ordered primary/secondary failover evidence。
  - 将 staging live closeout 与 forum visible lane 命中证据继续交由 `T-936`，并在本包仅保留 provider runtime 层的外部验收结论。

## Exit Criteria

- repo 侧 acceptance criteria 持续满足。
- 相关测试与静态检查通过。
- 包级 review gate 结论已记录，并明确移交给 `T-936` 的剩余 staging closeout 项。
- 真实 provider connectivity / ordered failover evidence 已写入 `04-verification.md`。

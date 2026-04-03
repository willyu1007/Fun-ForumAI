# 01 Plan

## Phases

1. Phase A: 建立 `T-901` 任务包并同步 project governance。`[completed]`
2. Phase B: 收口 execution-plan / execution-policy / adapter binding / secret resolver 边界。`[completed]`
3. Phase C: 更新 providers / pools / profiles / admission / pricing registry 与相关测试。`[completed]`
4. Phase D: 删除 visible pins、接通 candidate ordering / direct fallback，并修复 shadow review evidence 的 agent-scoped 闭环。`[completed]`
5. Phase E: 补全 response mode / modality / adapter capability / policy merge precedence / provider.auth metadata-only 合同。`[completed]`
6. Phase F: 跑自动化验证，执行包级 review gate，并把 cutover 依赖交接给 `T-936`。`[in-progress]`

## Detailed Steps

- 新增 `T-901` 任务包元数据，挂到 `F-020` 并记录依赖 `T-103`。
- 新增 execution-plan / execution-policy / adapter binding contract，并让 secret resolution 在 staging/prod 走 env-first。
- 把 `modality`、`response_mode`、adapter capability / request shape / auth strategy、policy merge precedence 纳入正式合同，而不是只保留最小可编译骨架。
- 把 `LlmClient` 改成按 provider registry 的 `gateway_kind` 选择 adapter。
- 给 `CredentialPoolEntry` 增加 `priority`，并为每个 active provider 建立 `primary/secondary` pools。
- 删除 `LLM_API_KEY`，补齐 provider-specific `_SECONDARY` env keys、secret refs 与 docs/context 生成链。
- 删除 `visibleProviderPin` / `visibleModelPin` 对 runtime 主路径的控制语义，并明确需求文档里“接入 visibleProviderPin”的建议已被 superseded。
- 用官方 `model_id` 更新 `providers.yaml`、`credential_pools.yaml`、`model_profiles.yaml`、`provider_admission.yaml`、`model_pricing.yaml`。
- 将 `provider.auth` 明确收口为 provider metadata，不再让它与 credential pool 形成 runtime auth 双真相。
- 移除 hidden multimodal lane 对 `config.llm.model` 的隐式偏好影响，避免环境层继续偷偷影响 lane 选择。
- 调整和新增 llm gateway / secret resolver / registry contract / inference profile shadow review 测试。
- 在进入 `T-936` 前执行 review gate：
  - route context / execution plan / render trace 字段齐备
  - route_order / direct fallback / provider+model pricing 真正被运行时消费
  - runtime 主路径不再读取 visible pins 或 `LLM_VISIBLE_MODEL_PIN`
  - policy 参数与 callsite 参数的剩余双轨点形成 inventory
- 记录自动化结果，并保留 live provider connectivity checklist 给后续真实 key 验证。
- 清理本轮遗留的坏示例、无引用 artifact、以及会让后续双轨推进误判的过时任务状态。

## Exit Criteria

- 目标 acceptance criteria 全部满足。
- 相关测试与静态检查通过。
- 包级 review gate 结论已记录，并明确移交给 `T-936` 的剩余 cutover 项。
- `04-verification.md` 记录完整。

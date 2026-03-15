# 01 Plan

## Phases

1. Phase A: 建立 `T-901` 任务包并同步 project governance。`[in-progress]`
2. Phase B: 收口 runtime/provider dispatch、secret resolver、env contract、credential broker。`[pending]`
3. Phase C: 更新 providers / pools / profiles / admission / pricing registry 与相关测试。`[pending]`
4. Phase D: 修复 shadow review evidence 的 agent-scoped 闭环。`[pending]`
5. Phase E: 跑自动化验证，记录 live verification 待办。`[pending]`

## Detailed Steps

- 新增 `T-901` 任务包元数据，挂到 `F-020` 并记录依赖 `T-103`。
- 把 `LlmClient` 改成按 provider registry 的 `gateway_kind` 选择 adapter。
- 给 `CredentialPoolEntry` 增加 `priority`，并为每个 active provider 建立 `primary/secondary` pools。
- 删除 `LLM_API_KEY`，补齐 provider-specific `_SECONDARY` env keys、secret refs 与 docs/context 生成链。
- 用官方 `model_id` 更新 `providers.yaml`、`credential_pools.yaml`、`model_profiles.yaml`、`provider_admission.yaml`、`model_pricing.yaml`。
- 调整和新增 llm gateway / secret resolver / registry contract / inference profile shadow review 测试。
- 记录自动化结果，并保留 live provider connectivity checklist 给后续真实 key 验证。

## Exit Criteria

- 目标 acceptance criteria 全部满足。
- 相关测试与静态检查通过。
- `04-verification.md` 记录完整。


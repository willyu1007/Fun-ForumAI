# Roadmap — provider-runtime-alignment-and-model-activation-v1 (T-901)

## Summary

在 `T-103` 已完成的“人格管理 -> 模型选择”主线上，`T-901` 已把 provider runtime wiring、registry 官方 model_id、secret/env contract、多 key 固定主备，以及 agent-scoped shadow evidence 的 repo 侧闭环收口完成；kind-staging 也已补上 DashScope live evidence，当前只剩多 provider connectivity / ordered failover 的外部验收。

## Milestones

1. 任务与治理建包：`[completed]`
2. runtime/provider/credential contract 对齐：`[completed]`
3. model/admission/pricing registry 统一：`[completed]`
4. shadow evidence agent-scoped 修复与 runtime hardening：`[completed]`
5. 真实 provider connectivity / ordered failover evidence：`[in-progress: dashscope proven / other providers pending]`

## Risks

- 官方模型 `model_id` / 定价是时效信息，必须以实施日官方文档为准。
- `LLM_API_KEY` 完全移除后，本地和 CI 若未补 provider key 会直接失败。
- visible profile 一旦把更多 admitted challenger 放进池子，候选顺序和回退语义必须保持稳定，不能冲掉现有 voice line 主语义。

## Rollback

- 所有变更先通过 registry contract / unit test / targeted e2e 收口。
- 若新 admitted 候选导致 visible 路由异常，可仅回滚 registry/admission 层，不回滚 runtime adapter 和 secret contract。

# Roadmap — provider-runtime-alignment-and-model-activation-v1 (T-901)

## Summary

在 `T-103` 已完成的“人格管理 -> 模型选择”主线上，补齐 provider runtime wiring、registry 官方 model_id、secret/env contract、多 key 固定主备，以及 agent-scoped shadow evidence，形成可继续做真实 API 验证的稳定底座。

## Milestones

1. 任务与治理建包：`[in-progress]`
2. runtime/provider/credential contract 对齐：`[pending]`
3. model/admission/pricing registry 统一：`[pending]`
4. shadow evidence agent-scoped 修复：`[pending]`
5. 自动化验证与 live test 预埋：`[pending]`

## Risks

- 官方模型 `model_id` / 定价是时效信息，必须以实施日官方文档为准。
- `LLM_API_KEY` 完全移除后，本地和 CI 若未补 provider key 会直接失败。
- visible profile 一旦把更多 admitted challenger 放进池子，候选顺序和回退语义必须保持稳定，不能冲掉现有 voice line 主语义。

## Rollback

- 所有变更先通过 registry contract / unit test / targeted e2e 收口。
- 若新 admitted 候选导致 visible 路由异常，可仅回滚 registry/admission 层，不回滚 runtime adapter 和 secret contract。


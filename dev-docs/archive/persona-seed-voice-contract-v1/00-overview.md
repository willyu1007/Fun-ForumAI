# 00 Overview — persona-seed-voice-contract-v1 (T-063)

## Status
- State: done
- Next step: 将 `homeVoiceLineId -> provider/profile/router` 的执行链路交给 `T-064`，并在 `T-065/T-066` 上继续扩展 overlay/runtime/eval。

## Goal
定义 authoritative persona / voice 契约，替代当前 `agent.model + persona/style` 的混合身份语义。

## Non-goals
- 不实现 provider/profile/router 选择逻辑。
- 不定义 overlay runtime state、prompt versioning 或评测执行器细节。

## Context
当前 repo 中：
- `agent.model` 在部分场景直接参与 LLM 调用；
- `config_json.persona` 与 `style` 共同承担“角色是谁”的语义；
- `PromptLayerService` 已有 persona/style 投影位，但缺少中层人格状态与稳定 voice anchor。

## Acceptance criteria (high level)
- [x] 冻结 `AgentPersonaConfig` 首版接口，并以 `config_json.personaSeed/voice/ownerStylePins/legacyIdentityMigration` 落地。
- [x] 明确 config state 与 runtime state 的权威边界；T-063 只负责 config authority，不引入 runtime state 表结构。
- [x] 完成 `agent.model / persona / style` 到新契约的创建、读取、legacy fallback 与展示映射。
- [x] 固定首批 line catalog，显式限制 hidden-only line (`deepseek-director-v1`) 不能进入 `homeVoiceLineId`。

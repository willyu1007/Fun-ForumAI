# 00 Overview — personality-compiler-inference-profile-v1 (T-103)

## Status

- State: done
- Next step: 若继续推进 provider 级 compare automation、agent-scoped shadow evidence 或 rollout playbook，应新开 `T-9xx` 承接；T-103 本体已可在获得确认后归档。

## Goal

把 A+B 统一方案真正嵌入现有 Fun-ForumAI runtime：

- 保持 `persona_seed -> home_voice_line -> PersonaState -> overlay -> prompt projection` 的权威主轴；
- 新增 `Inference Compiler + AgentInferenceProfile`，只服务于治理、路由、迁移、观测和 admin 诊断；
- 将 visible routing 从“只看 home voice line + 硬编码 tier”升级为“身份链约束下的编译治理输出”；
- 对 owner 暴露叙事化人格变化，对 admin 暴露完整 compile snapshot；
- 为 visible voice line 增加 admitted/shadow/blocked provider admission guardrail，禁止未准入候选直接进入可见池。

## Non-goals

- 不在本包内放开跨 family visible fallback。
- 不让 compile 结果进入 prompt 主文本。
- 不把 provider/model slot 准入做成开放式无门槛扩张。

## Acceptance criteria (high level)

- 新增 `AgentInferenceProfile` 持久化并完成 in-memory/pg 双实现。
- 存在可复用的 `InferenceCompiler` / migration state machine，且 family 只来自 derived compile view。
- visible forum/chat/private/proactive/scheduled 路径统一消费治理输出，不再硬编码 `requestedTier`。
- owner 侧无 raw family/temperament 标签泄露；admin/runtime features 可查看 compile snapshot 与迁移状态。
- visible provider/model 候选必须经过 admission pool 过滤；shadow/blocked 候选不得进入 visible actor。
- shadow compare 支持 `start -> collect -> approve/block` 控制面闭环，并以 `AgentInferenceShadowReview` 保留 evidence window / compare 结果 / rare reanchor 审批状态。
- `/Users/yurui/Downloads/agent-personality-model-strategy.md` 改写为统一语义。

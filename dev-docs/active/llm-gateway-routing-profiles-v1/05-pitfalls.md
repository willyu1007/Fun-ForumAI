# 05 Pitfalls — T-064

## Do-not-repeat summary
- 不要继续允许 feature code 直接传 raw model 作为长期调用方式。
- 不要把 `.ai/llm-config` 继续当成“仅文档模板”，而不作为 runtime authority。

## 2026-03-08 - 当前可见生成链路存在多重调用面
- Symptom: forum/chat/scheduler 常走全局默认模型，private/proactive 又显式传 `agent.model`。
- Root cause: runtime 从未形成 single calling surface，prompt registry 也未在运行时强制 version contract。
- What was tried: 对比 `llm-client`, `prompt-engine`, runtime executor 与私聊/聊天服务的现有调用路径。
- Fix/workaround: 单独建立 `T-064`，先冻结 gateway/routing/prompt version 合同。
- Prevention note: 后续任何新增 LLM 调用路径，必须先声明其 gateway surface 与 profile/ref 来源，不能直接拼接 provider/model 调用。

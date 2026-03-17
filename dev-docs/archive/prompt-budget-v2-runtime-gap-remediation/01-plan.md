# 01 Plan

## Phases
1. [x] 复核外部报告与实际代码链路。
2. [x] 实现真实缺口修复。
3. [x] 补充回归测试并记录结论。

## Detailed steps
- [x] 沿 `PromptOrchestrator -> PromptEngine -> LLMGateway` 校验 compiled blocks 是否是可见 scene 的最终输入主语义。
- [x] 为 memory retrieval 增加基于 request/local envelope 的 coarse budget hint，并在 audit provenance 中记录 retrieval/compile 两阶段信息。
- [x] 为 prompt audit 增加 legacy/block 分离字段，保留兼容字段但降低歧义。
- [x] 运行针对性测试，确认没有破坏现有 V2 scene 行为。

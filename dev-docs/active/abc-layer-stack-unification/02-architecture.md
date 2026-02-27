# 02 Architecture — abc-layer-stack-unification (T-034)

## Module boundaries
- `PromptLayerService`: layer 组装单一入口。
- `ContextBuilder`: 提供论坛/评论上下文 + 调用 layer service。
- `ConversationClock`: 生成聊天室 prompt 时复用同一 layer service。
- `PromptEngine`: 保持现有模板渲染机制，不改 loader 架构。

## Interfaces
- Input: agentId + scene context + event context。
- Output: `PromptLayers`（layer1~layer6 string fields）。

## Failure modes
- Layer service 抛错时回退为空层，不阻断主流程。
- Flag 关闭时绕过新服务，使用旧路径。

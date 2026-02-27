# 01 Plan — abc-layer-stack-unification (T-034)

## Phases
1. A1 flags + PromptLayerService
2. A2 runtime migration
3. A3 chatroom migration
4. A4 prompt template injection + debug endpoint
5. A5 tests and smoke

## Detailed steps
- 新增 `FF_LAYER_STACK_V2` 配置和 env contract。
- 抽离 `PromptLayerService`，封装 layer1~layer6 组装。
- `ContextBuilder` 改为调用服务；`ConversationClock` 同步调用服务。
- 更新 prompt templates 注入缺失 layer 变量。
- 新增 `POST /v1/dev/prompts/render`（dev-only, no persistence）。

## Risks & mitigations
- Risk: Prompt 内容膨胀导致 token 上升。
- Mitigation: 增加 layer 拼接裁剪和 debug 可视化。

- Risk: Chatroom 回归。
- Mitigation: Flag + regression tests + smoke。

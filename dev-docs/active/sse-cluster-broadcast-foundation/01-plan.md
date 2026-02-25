# 01 Plan

## Phases
1. 广播协议与抽象设计
2. 后端 cluster 广播实现
3. 前端容错与可观测增强
4. 发布演练与 WS 评估门槛输出

## Detailed steps
- 定义广播消息 envelope 与 channel 命名。
- 为 `SseHub` 增加 adapter 层（local / cluster）。
- 在 `EventBridge` 与聊天广播路径验证跨实例 fanout。
- 增强前端断连重连诊断与上报。
- 形成 go/no-go 文档，决定是否进入 WebSocket 迁移任务。

## Risks & mitigations
- Risk: 广播链路抖动导致消息遗漏。
  - Mitigation: 至少一次广播 + 客户端补偿拉取策略。
- Risk: cluster adapter 引入复杂度过高。
  - Mitigation: 保留 local adapter 与 feature flag 快速回退。

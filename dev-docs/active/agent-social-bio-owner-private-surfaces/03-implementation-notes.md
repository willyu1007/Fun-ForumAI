# 03 Implementation Notes — agent-social-bio-owner-private-surfaces (T-926)

## 2026-03-27

- 任务创建，待 profile/api/ui 实现。
- 对照需求文档后，补充本任务要负责 owner/private 的“主简介 + 状态附注”呈现节奏，以及 `personality_narrative` 的明确边界。
- 创建阶段 chooser / phrase pin 没有并入本任务，按 program 决策保持 defer。
- 审计中发现 `TabIntro` 只展示了 `owner_bio`，漏掉了 `presence_note`；已在 owner summary block 中补回“最近状态附注”，避免 owner surface 与 task pack 的“主简介 + 状态附注”定义漂移。

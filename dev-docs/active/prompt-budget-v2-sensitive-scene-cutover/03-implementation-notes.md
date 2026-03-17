# 03 Implementation Notes

## Current status
- 状态：planned
- 说明：任务包已冻结 sensitive-scene raw-source taxonomy、scene-specific authority defaults、scene-by-scene review gate 和最终 program closure contract，等待 Package 1 / 2 review 关闭后进入实现。

## Ready checklist
- [x] `private_chat -> chat_room -> proactive_dm` rollout 顺序已锁定
- [x] route 提供 raw evidence、orchestrator 决定最终 block 长度的分工已锁定
- [x] `private_chat` owner-current-first、`chat_room` context-first、`proactive_dm` hard-control-first 的默认策略已锁定
- [x] Package 3 依赖 Package 1 / 2 的关系已显式记录
- [x] 每个 scene 迁移后的 review gate 已锁定
- [x] 最终整体 program review 的覆盖范围与指标已锁定

## 2026-03-17 planning log
- 新建 `T-116` task bundle，承接 Token Budget V2 在 sensitive scenes 的最终 cutover。
- 记录各 scene 的 raw-source taxonomy、authority defaults 和 rollout order。
- 将本包映射到 `R-021`，并明确不回写为 `T-046` 的追加阶段。

## Handoff notes
- 先迁 `private_chat`，因为它最容易验证“owner 当前输入优先于历史”的核心目标。
- `chat_room` 不要把 room recent turns 继续留在 template 侧隐式拼装；必须提升为 raw-source contract。
- `proactive_dm` 不要为了追求风格保留更厚 `soft_expression`；边界控制优先级必须稳定高于 flavor。
- 不要在任一 scene 里新增 route-side final trimming 或 scene-specific compiler fork；如果某场景需要特殊行为，只能先回到 package review 里升级合同。
- `proactive_dm` 收尾后不要直接宣布完成，必须先做 public + sensitive 六场景整体验收。

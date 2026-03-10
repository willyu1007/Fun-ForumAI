# 03 Implementation Notes

## Current status
- 状态：not-started
- 说明：本子包尚未开始产品代码实现；当前仅冻结范围、验收和依赖。

## Ready checklist
- [ ] 母包 `T-077` 治理与依赖规则已冻结
- [ ] `summary.modules[]` 契约在 architecture 中锁定
- [ ] 完整事件接入矩阵与 event naming 已冻结
- [ ] `guidance-copy-service` 的 reason -> copy contract 已冻结
- [ ] feature flags 命名与默认值写入实现清单
- [ ] `source_session_id` 增补点已记录到 API 范围

## Handoff notes
- 启动实现时，先补 schema / repo skeleton，再补 API / hook wiring，避免先写 Web 反向定义后端契约。
- 事件接入必须优先补 read/control/private-channel/client-event 的成功分支，再接 forum fan-out 与 digest hook，避免 checklist 无法推进。
- `guidance-copy-service` 必须和 canonical guidance item 同时设计，不能等 bell / proactive 再补。

# 00 Overview — control-plane-config-governance (T-054)

## Status
- State: done
- Next step: 等待归档确认（已完成 T-054 全量对齐，并补齐 2026-03-06 的 StageSpec 规范化 / 高风险门禁 P1 修复，以及同日的 allocator 约束与 aftershow 烟测收口验证）。

## Goal
将社区配置管理从直接 patch rules_json 升级为 proposal/validate/approve/reject/apply/rollback 的版本化治理流程，并支持 `SCHEDULED` 自动生效与组件激活审计事件。

## Non-goals
- 不实现前端控制台界面（本包仅后端控制面能力）。

## Acceptance criteria (high level)
- [x] 存在配置版本快照与变更提案记录。
- [x] 高风险变更必须审批后 apply。
- [x] 可回滚到任意已应用版本并保留审计事件。

# 00 Overview — event-contract-routing-baseline (T-053)

## Status
- State: done
- Next step: 等待归档确认。

## Goal
落地三层事件契约（DATA/CONTROL/RUNTIME）与统一路由策略，建立可审计、可关联、可控触发边界。

## Non-goals
- 不在本包完成配置审批流程与 aftershow 发布逻辑（分别在 T-054/T-055）。

## Acceptance criteria (high level)
- [x] Event 表支持 plane/schema_version/correlation 等关键字段。
- [x] EventBridge/Admission/Runtime 读取统一契约字段。
- [x] 路由矩阵可阻止非白名单事件进入 allocator。

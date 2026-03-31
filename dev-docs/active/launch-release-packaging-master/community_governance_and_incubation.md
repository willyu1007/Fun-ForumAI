# Community Governance And Incubation

## Summary

社区新增治理在首发期属于 `P0` 基础能力，不应继续留在 `T-139` 的 post-launch 优化里。平台默认采用“用户提案 -> 系统归并建议 -> 管理员审核 -> GRAY 孵化 -> 转正/合并/归档”的托管式治理链。

## Required Contracts

- `community_proposal`
- `system_merge_recommendation`
- `community_lifecycle_state`
- `incubation_profile`
- `admin_decision_action`

## Lifecycle States

- `launch_core`
- `launch_support`
- `seasonal_active`
- `incubating_gray`
- `dormant`
- `merged`
- `archived`

## Minimal Control-Plane Surfaces

- proposal queue
- merge recommendation panel
- incubation panel
- lifecycle panel

## Ownership Split

- `T-134` 负责单社区 `rules_json` 合同
- `T-141` 负责跨社区治理、孵化与生命周期
- `T-137` 只消费 lifecycle / incubation 状态做运营观察，不定义治理状态机
- `T-139` 只做 post-launch tuning，不再定义基础治理机制

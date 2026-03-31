# 02 Architecture — launch-community-governance-and-incubation (T-141)

## Boundaries

- `T-141` 负责跨社区治理、孵化与生命周期 contract。
- `T-134` 负责单社区 `rules_json` contract。
- `T-137` 只消费治理结果做运营观察，不定义治理状态机。
- `T-139` 只做 post-launch tuning，不承担首发基础治理定义。

## Required Contracts

- `community_proposal`
- `system_merge_recommendation`
- `admin_decision_action`
- `community_lifecycle_state`
- `incubation_profile`

## Lifecycle States

- `launch_core`
- `launch_support`
- `seasonal_active`
- `incubating_gray`
- `dormant`
- `merged`
- `archived`

## Minimal Incubation Rules

- 孵化期 visibility 默认 `GRAY`
- 配置 2–3 个 resident 与 1 个轮值 host / MC
- 有固定场景与固定排班
- 7–14 天观察后进入：
  - activate
  - merge
  - archive

## Control-Plane Surfaces

- proposal queue
- merge recommendation
- incubation panel
- lifecycle panel

## Fallback

- 未通过审核的提案不得直接 public 上架。
- 与现有社区高度重叠的提案默认优先 merge/lane，而不是直接新建。

# 02 Architecture — T-124

## Metrics Layers
- 业务指标
  - root post 带图率（7 天滚动）
  - source A/B/C 占比
  - runtime 用图率 vs display 挂图率
  - 图文帖互动表现
- 系统指标
  - semantic snapshot success / reuse rate
  - generation success / timeout / failure rate
  - average generation cost
  - projection compile success rate
- 治理指标
  - private leak event count
  - public-safe validation failure rate
  - blocked display plan count
  - runtime-only downgrade ratio

## Lifecycle Controls
- 孤儿资产清理
- 无绑定图归档
- 过期 projection 清理
- `is_current` / `model_version` 管理
- snapshot backfill / recompile strategy

## Rollout Control
- 目标控制器负责将 7 天滚动带图率维持在目标区间，而不是简单固定概率。
- 当带图率过低时，可放宽高质量阈值或增加 generation budget。
- 当质量、互动或成本恶化时，可提升阈值、降低低质量 generation 或回退到 `text_only` / `runtime_only_no_display`。

## Metrics Ownership
- `T-119`
  - root post 带图率、public prompt audit、display attach success
- `T-120`
  - private attachment success、private-origin projection usage、private leak risk
- `T-121`
  - policy block、revoke hit、origin disclosure violations
- `T-122`
  - generation cost、success rate、timeout/degrade rate
- `T-123`
  - multi-surface attach success、surface-specific runtime/display ratios

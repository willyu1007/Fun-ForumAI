# 01 Plan — launch-programming-ops-and-rollout (T-137)

## Phase 1. Freeze Launch Cadence

1. 冻结首发日内时段：
   - 上午预热
   - 下午串线
   - 晚高峰主冲突
   - 夜间陪伴与回收
2. 明确每个时段的目标社区、最低供给和优先角色。

## Phase 2. Freeze Ops Surfaces

1. 定义 roster 分配面板。
2. 定义 resident / guest / runtime role assignment 面板。
3. 定义 visual ratio、highlight candidate、aftershow trigger 和健康度面板。

## Phase 3. Freeze Slot Contract

1. 明确每类节目 slot 的：
   - daypart
   - community
   - scene types
   - required roles
   - expected outputs
2. 明确 slot 与 `T-133` roster、`T-134` community rules、`T-136` T4 供给之间的依赖关系。

## Phase 4. Freeze Rollout And Rollback

1. 明确 feature flag 和灰度顺序。
2. 明确 visual / T4 / aftershow 出现异常时的回退顺序。
3. 明确发布前演练清单。

## Phase 5. Produce Launch Draft

1. 输出 `launch_programming_schedule.v1.yaml` 作为 launch working draft。
2. 补齐 requirement / architecture / verification / implementation notes。

## Acceptance Scenarios

- 运营必须能在一天开始前回答：
  - 每个时段准备推什么。
  - 由谁主导。
  - 需要观察什么指标。
- 发生异常时，必须能按顺序降级，而不是现场拍脑袋删配置。

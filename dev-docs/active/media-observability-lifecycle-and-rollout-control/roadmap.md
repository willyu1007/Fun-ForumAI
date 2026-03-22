# Roadmap — media-observability-lifecycle-and-rollout-control (T-124)

## Summary

把图像框架从“能跑主链路”推进到“可持续运营”：有带图率控制、有 generation 成本监控、有私域泄露告警、有资产回收和 snapshot 升级策略。

## Milestones

1. metrics contract 冻结。`[pending]`
2. alerting / governance gates 冻结。`[pending]`
3. lifecycle cleanup strategy 冻结。`[pending]`
4. snapshot upgrade / backfill strategy 冻结。`[pending]`
5. rollout controller 冻结。`[pending]`

## Risks

- 没有指标与控制器，35% 带图率目标会退化为拍脑袋概率开关。
- 没有生命周期治理，资产、projection 和旧 snapshot 会快速膨胀失控。

## Rollback

- 若第一版控制器过于激进，可退回更保守阈值，但不回滚指标、告警和生命周期治理基础。

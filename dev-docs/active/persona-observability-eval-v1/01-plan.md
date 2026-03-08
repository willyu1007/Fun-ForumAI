# 01 Plan — T-066

## Phase 0 Logging Contract
1. 定义 render log schema 与 required attribution fields。
2. 定义 prompt ref、fallback reason、cost/latency 的落日志要求。
3. 定义 parse success、identity write success、rare reanchor 的日志字段和统计口径。

## Phase 1 Evaluation Spec
1. 定义 replay corpus 与抽样规则。
2. 定义 blind review rubric 与评分维度。
3. 设计 nurture perceptibility 的评测切片，包含私聊前后公共行为对比样本。

## Phase 2 Rollout Gates
1. 定义 quality/cost/latency/fallback 的阈值。
2. 定义 rollback trigger、诊断顺序与验收顺序。
3. 定义 line-seed fit、nurture perceptibility 与 rare reanchor 的 gate。

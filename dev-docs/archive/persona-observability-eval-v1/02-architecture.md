# 02 Architecture — T-066

## Boundaries
- 本包只定义观测与评测 contract，不定义运行时业务逻辑。
- 本包依赖 `T-064` 的 gateway/routing contract 和 `T-065` 的 runtime contract。
- 本包输出的 gate 将约束后续所有 persona/provider 实现与灰度。

## Observation surfaces to define
- Request-level:
  - render decision
  - prompt ref
  - fallback reason
  - cost / latency
  - parse success
  - identity write success
- Agent-level:
  - persona drift indicators
  - overlay activation indicators
  - line stability indicators
  - nurture perceptibility indicators
- Rollout-level:
  - gate metrics
  - rollback conditions

## Key principles
- 没有 `reasons[]` 的 model/tier/provider 日志，不算合格 render log。
- replay/eval 规范必须可复现，不能依赖临场“看看感觉”。
- rollout gate 必须在实现前冻结，不能等系统上线后再补阈值。
- 评测不能只证明“像同一个人”，还必须证明“用户影响进入了公共行为”。

## Risks
- 若 gate 设计晚于实现，团队会先做功能再补评测，导致归因口径漂移。
- 若日志字段不统一，后续无从判断问题来自 line、tier、provider 还是 prompt/runtime。

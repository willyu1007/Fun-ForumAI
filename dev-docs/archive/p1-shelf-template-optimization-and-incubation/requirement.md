# Requirement — p1-shelf-template-optimization-and-incubation (T-139)

## 1. Goal

为首发后 1–2 周提供一条稳定的优化线，用于基于灰测数据调整 shelf、模板、visual 与 incubation heuristics，而不引发大范围重构。

## 2. Product Boundaries (MUST)

- 不重写首发基础治理状态机。
- 不做完整增长或长期内容运营系统。
- 不升级为完整 replay / leaderboard 项目。

## 3. Required Outcomes

- 明确 shelf AB 和默认视图优化策略。
- 明确 T4 模板与 visual tuning 机制。
- 明确 incubation heuristics、policy optimization 与 config writeback。

## 4. Non-goals

- 不建设新的底层系统。
- 不替代 `T-141` 的治理 contract。

## 5. Success Criteria

- post-launch 反馈能被快速回写到 shelf / template / visual / roster 配置。
- 调优工作不再通过 ad-hoc 文档口头传达。

## 6. Constraints

- 必须基于 `T-135/T-136/T-137/T-138/T-140/T-141` 的既有 contract 做微调。
- 优先用 config/meta/read-model 层完成 post-launch 优化。

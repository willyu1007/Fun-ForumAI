# Roadmap — forum-semantic-lifecycle-projection-foundation-v1 (T-941)

## Summary

先补齐 forum orchestration 的共享中间层，让后续森林视图、viewer write plane、attention/perception cutover 都消费同一套 contract，而不是分别临时派生；同时明确“养成结果如何以公开安全的 cue 进入 capsule”。

## Milestones

1. 任务建包与 governance 注册：`[in-progress]`
2. shared contract 冻结（含 public-safe growth/persona cue 边界）：`[in-progress]`
3. projection services 落地：`[in-progress]`
4. read/runtime/docs-context 接线与 regression：`[pending]`

## Rollback

- 若新 projection service 出现问题，现有 thread read DTO 与前端页面保持兼容可回退。
- 首版不引入持久化投影表，避免 DB migration 成为强耦合回滚点。

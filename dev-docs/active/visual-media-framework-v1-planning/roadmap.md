# Roadmap — visual-media-framework-v1-planning (T-117)

## Summary

建立图像处理框架 V1 的项目治理骨架，把旧的 one-shot inclination 语义纠偏为长期可扩展的媒体主域，并把 public post、private chat、reuse/revoke、generation、multi-surface 扩展、lifecycle/observability 拆成 7 个独立执行包。

## Milestones

1. 治理落项与任务建包。`[in-progress]`
2. `T-118` 媒体主域与语义纠偏。`[pending]`
3. `T-119` public root post 双路径补图。`[pending]`
4. `T-120` private chat 图片认知链路。`[pending]`
5. `T-121` / `T-122` 公共复用治理与 generation broker。`[pending]`
6. `T-123` 多 surface 适配与扩展。`[pending]`
7. `T-124` 观测、生命周期与带图率控制。`[pending]`

## Risks

- 如果继续保留 “next scheduled post slot” 作为真实语义，会持续污染 public planner 和 private cognition 的设计。
- 如果 prompt 直接注入 URL 或 raw private input，会破坏 public/private 边界和后续审计。
- 如果 generation 复用 `LLMGateway` 文本 artifact contract，会在 job state、binary asset、并发治理上失真。

## Rollback

- 本包只涉及治理与文档，不涉及产品代码。
- 若后续需要调整执行顺序或 requirement 命名，只修改 project hub 和 task docs，不需要回滚业务实现。

# 02 Architecture

## Context & current state
- 子任务：Cluster 01 Core Scaffold
- 来源：父任务拆分（归档路径：dev-docs/archive/post-init-roadmap-clustering）

## Proposed design

### Components / modules
- 以 dev-docs/active/runnable-core-baseline/roadmap.md 中定义的模块边界为准。

### Interfaces & contracts
- API endpoints:
  - 参照 dev-docs/active/runnable-core-baseline/roadmap.md，实现前先确认契约。
- Data models / schemas:
  - 仅在本子任务范围内修改。
- Events / jobs (if any):
  - 仅处理本 cluster 涉及的事件流。

### Boundaries & dependency rules
- Allowed dependencies:
  - 可读取其他子任务产物作为输入约束。
- Forbidden dependencies:
  - 不直接实现非本 cluster 的核心功能。

## Data migration (if applicable)
- Migration steps:
  - 按 dev-docs/active/runnable-core-baseline/roadmap.md 执行。
- Backward compatibility strategy:
  - 采用阶段化发布与回滚策略。
- Rollout plan:
  - 先验证再扩展，避免跨 cluster 同步耦合。

## Non-functional considerations
- Security/auth/permissions:
  - 必须满足父需求文档的 MUST 约束。
- Performance:
  - 在本 cluster 验收中记录关键指标。
- Observability (logs/metrics/traces):
  - 保持可追溯日志与验证证据。

## Open questions
- 暂无（执行中新增则补充）。

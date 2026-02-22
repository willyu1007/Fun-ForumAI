# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不跨 cluster 接管需求，避免把子任务重新做成大任务。
- 每次变更必须写入验证记录，避免完成但不可复核。

## Pitfall log (append-only)

### 2026-02-20 - 子任务初始化
- Symptom:
  - 父任务过大导致执行边界不清。
- Context:
  - 用户要求先归档父任务，再拆分子任务。
- What we tried:
  - 采用 1 父归档 + 4 子任务并行模板。
- Why it failed (or current hypothesis):
  - N/A（当前为预防性拆分）。
- Fix / workaround (if any):
  - 每个子任务独立 roadmap 与 00-05 文档。
- Prevention (how to avoid repeating it):
  - 新增工作项优先归属到现有子任务，不回流为单一大任务。
- References (paths/commands/log keywords):
  - dev-docs/active/runnable-core-baseline/roadmap.md

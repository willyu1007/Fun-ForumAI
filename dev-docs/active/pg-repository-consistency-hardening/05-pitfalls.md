# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要在无回归测试的情况下直接移除仓储缓存路径（keywords: db-first, cursor-regression, read-drift）。

## Pitfall log (append-only)

### 2026-02-25 - Initialization
- Symptom:
  - N/A（任务初始化）
- Context:
  - 新建一致性改造任务包。
- What we tried:
  - N/A
- Why it failed (or current hypothesis):
  - N/A
- Fix / workaround (if any):
  - N/A
- Prevention (how to avoid repeating it):
  - 在每个仓储改造前先补齐契约测试。
- References (paths/commands/log keywords):
  - `dev-docs/active/pg-repository-consistency-hardening/roadmap.md`

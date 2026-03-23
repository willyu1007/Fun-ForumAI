# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)

- 搜索修复不能只改返回层；必须同时检查 projection build、searchable_text、guard、count 和 UI 渲染。
- `/v1/search` 只能 additive upgrade，不能删除旧字段或改现有字段语义。
- `/v1/agents` 兼容层不得重新实现第二套 agent 搜索语义。

## Pitfall log (append-only)

### 2026-03-23 - Task bundle bootstrap
- Symptom:
  - 搜索修复任务跨 backend/frontend/dev-docs/admin runtime，多条实现线并行，容易在没有持续上下文的情况下漂移。
- Context:
  - 该任务明确满足 `dev-docs` complex-task gate。
- What we tried:
  - 在编码前先建立完整 bundle，并把产品口径固化到 decisions / architecture / verification。
- Why it failed (or current hypothesis):
  - N/A
- Fix / workaround (if any):
  - 保留 repo 标准 bundle，同时补搜索专项文档，避免后续上下文丢失。
- Prevention (how to avoid repeating it):
  - 后续每阶段完成后更新 `03-implementation-notes.md` 与 `04-verification.md`。
- References (paths/commands/log keywords):
  - `dev-docs/AGENTS.md`
  - `dev-docs/active/search-correctness-convergence-and-discovery-hardening-v1/*`

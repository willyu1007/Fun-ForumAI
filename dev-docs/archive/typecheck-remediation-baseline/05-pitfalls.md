# 05 Pitfalls (do not repeat) — typecheck-remediation-baseline (T-027)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- Prisma schema 变更后必须先 `pnpm db:generate` 再判断 TS 报错归因。
- 严禁为“消除报错”而放松 TS 严格配置。

## Pitfall log (append-only)

### 2026-02-26 - task-initialized
- Symptom: N/A
- Context: 任务包初始化。
- What we tried: N/A
- Why it failed (or current hypothesis): N/A
- Fix / workaround (if any): N/A
- Prevention (how to avoid repeating it): 所有实际排障在本文件追加记录。
- References (paths/commands/log keywords): `pnpm -s typecheck`

# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要在没有可见性审计的情况下把 signal 默认设为 `PUBLIC`。
- 不要在 request-time 做无界全量扫描（尤其是 chronicle metrics 汇总）。
- 不要只修“主路径帖子场景”，必须同步覆盖 COMMENT 等并行入口。

## Pitfall log (append-only)

### 2026-03-02 - 规划阶段初始化
- Symptom:
  - 审查报告问题分散在多个子系统，容易被拆散后遗漏验收。
- Context:
  - T-045~T-047 分别有独立目标，但报告问题跨任务边界。
- What we tried:
  - 评估继续沿用原任务增量补丁。
- Why it failed (or current hypothesis):
  - 缺少统一验收出口，风险项（flag/proactive/perf）容易无人兜底。
- Fix / workaround (if any):
  - 新建 T-048 作为总修复任务，统一 phase 与验收。
- Prevention (how to avoid repeating it):
  - 遇到跨任务高耦合整改，优先建立 umbrella task，再按 phase 落子任务。
- References (paths/commands/log keywords):
  - `dev-docs/active/personality-alignment-gap-remediation/*`
  - `node .ai/scripts/ctl-project-governance.mjs query --status in-progress`

### 2026-03-02 - Signal 隔离口径误伤 batch 成就
- Symptom:
  - `achievements-orchestrator` 用例失败：`chronicle_spotlight` 未授予。
- Context:
  - 在做 signal 去污染时，把 `public_entries/activity_days/chronicle_entries` 全部切成 narrative-only。
- What we tried:
  - 直接复用 narrative 计量覆盖所有字段。
- Why it failed (or current hypothesis):
  - 需求仅要求去除 `chronicle_entries` 的 signal 污染；`public_entries/activity_days` 全改会改变既有批处理成就语义。
- Fix / workaround (if any):
  - 保持 `public_entries/activity_days` 为全量口径；仅 `chronicle_entries` 使用 narrative-only。
  - 在 `ChronicleSignalMetrics` 中保留 narrative 扩展字段，避免再次混淆。
- Prevention (how to avoid repeating it):
  - 做计量口径改造时，先逐字段映射到业务定义，不要一次性“全字段同口径替换”。
- References (paths/commands/log keywords):
  - `src/backend/repos/{chronicle-repository.ts,pg/pg-chronicle-repository.ts}`
  - `src/backend/services/achievements-orchestrator.ts`
  - `pnpm -s vitest run src/backend/services/__tests__/achievements-orchestrator.test.ts`

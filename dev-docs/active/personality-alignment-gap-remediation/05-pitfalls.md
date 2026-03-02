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

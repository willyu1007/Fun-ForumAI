# 04 Verification

## Automated checks
- `rg -n "cross-platform-execution-model" dev-docs/active/*/00-overview.md`（应命中 4 个 active 任务）。
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`（通过；仅保留历史 archive 缺失告警）。
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`（通过）。

## Manual smoke checks
- 检查本子任务实现范围与 dev-docs/active/safe-agent-write-path/roadmap.md 一致。
- 检查是否误改其他 cluster 的核心实现。

## Rollout / Backout (if applicable)
- Rollout:
  - 按 dev-docs/active/safe-agent-write-path/roadmap.md 阶段推进。
- Backout:
  - 以阶段提交为回滚单元。

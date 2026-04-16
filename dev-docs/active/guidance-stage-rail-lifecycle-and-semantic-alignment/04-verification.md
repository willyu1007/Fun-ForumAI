# 04 Verification

## Automated checks

- 2026-04-16 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass
- 2026-04-16 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass
- 2026-04-16 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass
- 2026-04-16 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass
- 2026-04-16 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass
- 2026-04-16 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass

## Documentation / governance checks

- 新任务包已注册进 `.ai/project/main/registry.yaml`
- 派生视图已更新：
  - `.ai/project/main/dashboard.md`
  - `.ai/project/main/feature-map.md`
  - `.ai/project/main/task-index.md`
- Governance note:
  - 本轮 lint 首次运行曾报出一次瞬时 registry mismatch；在 sync 后复跑 lint 已恢复通过，当前 project-hub 状态一致。

## Manual alignment checks

- 2026-04-16 | roadmap coverage audit completed | pass
  - 任务包已覆盖：UI/UX、全生命周期流程、项目级语义退场、rail takeover、`稍后再看` 本地 authoritative、`track` 三阶段退场、治理闭环
- 2026-04-16 | implementation slices added and dependency-ordered | pass
  - `01-plan.md` 现已给出 S1-S6、文件范围、DoD 与验证要求
- 2026-04-16 | contract bridge refined | pass
  - `02-architecture.md` 已明确 canonical API contract、frontend internal selector contract、end-to-end execution flow
- 2026-04-16 | retained-stage blocker review | pass
  - `RETAINED` rail takeover 已冻结为 whitelist-only，不再阻塞实施

## Rollout / Backout (if applicable)

- Rollout:
  - 先完成 roadmap 对齐，再按 phase 推进实现。
- Backout:
  - 若任务方向失配，可保留 bundle 并将状态改为 `blocked` 或归档，不触发现有 product code 回滚。

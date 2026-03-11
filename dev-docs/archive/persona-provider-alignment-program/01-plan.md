# 01 Plan — T-062

## Phase 0 Governance Bootstrap
1. 建立 `T-062~T-066` 任务包与 `.ai-task.yaml`。
2. 将新任务映射到 `F-020`，并新增 `R-026~R-029`。
3. 运行 project governance `sync/lint` 固化 registry 与 derived views。

## Phase 1 Contract Sequencing
1. 固定 `T-063` 作为 authority contract 先行包。
2. 固定 `T-064` 与 `T-065` 为并行中层包。
3. 固定 `T-066` 为依赖前两包的观测/评测收口包。

## Phase 2 Program Controls
1. 统一子包 DoD、风险模板、回滚说明格式。
2. 统一“清理优先但保留迁移输入”的表达口径。

## Phase 3 Acceptance Closeout
1. 以“方案级闭环”而非“生产 rollout 完成”作为 `T-062` 的完成定义。
2. 固定 `T-063/T-064` 为已完成 contract 基线，`T-065/T-066` 为已完成 closeout 包，不再把判断留给后续实现者。
3. 将 `migrated_visible` 真实样本、blind review、staging shadow logging 与 gate verdict 拆分到 `T-070 persona-rollout-shadow-review`。
4. 修复 project hub 治理漂移，要求 `sync/lint` 恢复绿色后才宣告总包验收通过。

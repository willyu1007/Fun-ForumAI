# 01 Plan — launch-release-packaging-master (T-132)

## Phases

1. 扩展治理映射到 `T-140/T-141` 与 `R-098/R-099`。`[in-progress]`
2. 补齐 `T-138/T-139` 的 requirement/spec/artifact，使其达到可 review 水位。`[pending]`
3. 固定 `T-132~T-141` 的单包 review 顺序、收口门槛和输出格式。`[pending]`
4. 冻结 8 份主实施物与 10 份 bundle review 结论。`[pending]`
5. 跑治理 sync / lint，整理最终 handoff。`[pending]`

## Detailed Steps

- 以 `T-132` 为总控包，更新总依赖图、review 顺序图与总验收矩阵。
- 在 `.ai/project/main/registry.yaml` 新增 `R-098`、`R-099`、`T-140`、`T-141`。
- 在主包内补 `visual_surface_rollout.md` 与 `community_governance_and_incubation.md` 两份实施物。
- 补齐 `T-138/T-139` 的 `requirement.md`、`03-implementation-notes.md` 与 working draft artifact。
- 为 `T-132~T-141` 每个 bundle 新增统一 `06-review.md`，包含：
  - `review_decisions`
  - `contract_delta`
  - `dependency_lock`
  - `open_questions`
  - `handoff_note`

## Acceptance Scenarios

- 新同事只读 `T-132` 与 8 份实施物，就能知道首发的世界结构、治理结构、包装结构与 review 顺序。
- `T-133~T-141` 能分别被不同实现阶段接手，而不再需要重新对齐方向。
- project hub 能正确显示新 requirement/task，不再遗漏视觉 rollout 与社区治理两条 P0 线。

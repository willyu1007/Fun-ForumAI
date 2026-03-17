# 00 Overview — prompt-budget-v2-memory-tiering-authority (T-115)

## Status

- State: planned
- Next step: 在 Package 1 review gate 关闭后，补齐结构化 memory pack/render 合同、runtime authority、overflow 诊断与 Package 2 review gate，再进入 sensitive-scene cutover。

## Goal

修正 Token Budget V2 中 memory 的 authority 分配：

- `PromptLayerService` 停止直接输出最终 memory string；
- memory renderer 改为显式 tier 与固定降级序列；
- runtime 按 `scene budget + memory ability` 决定 memory ceiling；
- 将 `public_memory_budget` 从 runtime allocation 主路径移除，只保留兼容与可解释性。

## Non-goals

- 不在本包内迁移所有 sensitive-scene route/template。
- 不删除 `public_memory_budget` 字段或 DB 结构。
- 不把 owner 偏好完全从产品表面移除；只调整它在 runtime 中的 authority。

## Acceptance criteria (high level)

- [ ] `PromptLayerService` 改为返回结构化 memory pack 与 disclosure metadata，不再输出最终 memory string。
- [ ] memory renderer 支持 `full / compact / sparse / minimal / drop_low_value` 五档。
- [ ] memory 降级顺序固定为：缩短文案 -> 减少 slot -> 减少 item -> summary 化 -> 删除低价值 section。
- [ ] `MemoryContextRequest` 携带 `bucketTarget`，由 orchestrator 指示 memory renderer 的本轮目标空间。
- [ ] `public_memory_budget` 不再参与 runtime allocation；audit/observability 能解释 owner 偏好与实际分配差异及原因码。
- [ ] overflow reason 完整覆盖 `memory`、`current_context`、`control floor`、`privacy floor` 与 `hard ceiling` 压缩场景。
- [ ] 进入 Package 3 前，low / medium / high-memory cohort 的 review 已完成，memory saturation 结论已收口。

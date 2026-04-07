# 01 Plan

## Phases

1. Phase A: 建立任务包并注册 governance。`[in-progress]`
2. Phase B: 冻结 shared contract 与 DTO，包括 public-safe growth/persona cue 边界。`[in-progress]`
3. Phase C: 实现 lifecycle / semantic / display projection 服务。`[in-progress]`
4. Phase D: 将 projection 接到现有 read/runtime/debug 消费点，并同步 docs/context vocabulary。`[pending]`
5. Phase E: 补齐 targeted tests、typecheck、governance sync。`[pending]`

## Detailed Steps

- 建立 `forum-orchestration` 共享类型，统一 lifecycle / capsule / display vocabulary。
- 明确 `public_world_memory` / `owner_relation_memory` / `self_growth_memory` 的投影边界，禁止 owner 私聊原文直接进入 forum capsule。
- 在 backend service 层新增 runtime-safe projection 服务，优先使用现有 repo 数据实时计算。
- 为 capsule 定义可追溯的 evidence refs 与 public growth/persona cue 入口，承接关系、成就、阶段变化等“公开有意义”的信号。
- 将 thread read path 扩展为可附带 display projection 和 reading guide 所需字段。
- 为后续 forest/detail 包提供可复用 service，而不是把 UI 规则散落到页面组件中。
- 补齐 display clamp、late-entry、route handoff、anchor preview 的 regression tests。

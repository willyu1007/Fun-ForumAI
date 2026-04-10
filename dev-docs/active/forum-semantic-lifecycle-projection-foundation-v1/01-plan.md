# 01 Plan

## Phases

1. Phase A: 建立任务包并注册 governance。`[completed]`
2. Phase B: 冻结 shared contract 与 DTO，包括 public-safe growth/persona cue 边界。`[completed]`
3. Phase C: 实现 lifecycle / semantic / display projection 服务。`[completed]`
4. Phase D: 将 projection 与 lifecycle snapshot 接到现有 read/runtime/debug/search/forest 消费点，并同步 docs/context vocabulary。`[completed]`
5. Phase E: 收口 lifecycle-driven writeability / route handoff / revive 解释链。`[completed]`
6. Phase F: 补齐 targeted tests、typecheck、governance sync。`[completed]`

## Entry Contract

- 本包开工前，不要求下游包完成实现，但要求 `T-946` 已把 owner boundary 固定到：
  - `T-941` 拥有 lifecycle/projection truth
  - `T-943` / `T-945` / `T-942` 仅消费该 truth
- 若现有字段不足以表达 lifecycle/writeability/route handoff，必须先在本包内冻结 vocabulary，再允许下游消费。

## Detailed Steps

- 建立 `forum-orchestration` 共享类型，统一 lifecycle / capsule / display vocabulary。
- 明确 `public_world_memory` / `owner_relation_memory` / `self_growth_memory` 的投影边界，禁止 owner 私聊原文直接进入 forum capsule。
- 在 backend service 层新增 runtime-safe projection 服务，优先使用现有 repo 数据实时计算。
- 为 capsule 定义可追溯的 evidence refs 与 public growth/persona cue 入口，承接关系、成就、阶段变化等“公开有意义”的信号。
- 将 thread read path 扩展为可附带 display projection 和 reading guide 所需字段。
- 为后续 forest/detail 包提供可复用 service，而不是把 UI 规则散落到页面组件中。
- 补齐 display clamp、late-entry、route handoff、anchor preview 的 regression tests。
- 明确 lifecycle snapshot 的标准输出位，并要求 summary/search/runtime/forest 共用这套解释。
- 明确 lifecycle 与 allowed actions、route handoff、revive、reply budget 的关系表，供 `T-943` / `T-945` / `T-942` 消费。
- 为 `THREAD_ROUTE_UPDATED` 等 lifecycle 变化定义下游消费清单和责任归属。

## Handoff Review Before Next Pack

- 进入 `T-945` / `T-943` / `T-942` 前，必须 review 并收口：
  - lifecycle snapshot 字段与含义是否冻结
  - writeability / route handoff / revive explanation 是否能被共享消费
  - projection version/fallback 是否足以支撑下游不再自造临时 DTO
- review 输出必须落到：
  - `03-implementation-notes.md`：contract note
  - `04-verification.md`：消费侧验证或 targeted regression 证据

## Stop / Escalation Conditions

- 若本包只能在 route 层或 UI 层解释 lifecycle，而不能形成共享 contract，则必须停止下游包推进并回到本包收口。
- 若 public-safe cue 需要读取 owner-private 原文才能成立，则视为 contract 设计失败，不得交给下游“先实现再说”。

# 00 Overview — public-director-boundary-and-scene-contract (T-094)

## Status
- State: done
- Next step: 将已落地的 contract/flag/boundary handoff 给 `T-095` / `T-096`，并在获批后归档本 task bundle。

## Goal
冻结公域导演层的边界与统一协议，明确：
- 导演层只服务公域 surface，不进入私聊；
- `StageSpec` 继续承担硬治理，导演字段只承担节目编排；
- 角色只拿局部行动语境，不拿完整 scene brief；
- 热点/活动/关系推进进入 overlay，不污染长期 persona。
- 场景池资产层、轮换发布层和私域收口层都在整体规划中有明确 owner，不留执行空洞。

## Non-goals
- 不实现 `SceneSelector`、`scene_metadata` 持久化或 `runtime_scene_state_v1` 落库。
- 不在本包内落库 schema migration、selector scoring 或 chatroom adaptor。
- 不重开 `T-046`、`T-073`、`T-074`、`T-075`、`T-016`。
- 不讨论运营后台、成就系统或 richer scene library。

## Context
- `T-046` 已统一 prompt 编排，但没有定义“导演层 vs 角色层 vs 私域链路”的硬边界。
- `T-073 ~ T-075` 已让聊天室具备节目原语，但仍是 chatroom-local 语义，不是统一公域导演协议。
- `/Users/yurui/Downloads/scene_pool_design.md` 是本轮权威需求来源；旧的 `/Users/phoenix/.../scene_pool_director_scene_aware_design.md` 仅作为历史草案引用。
- 本包同时承担 `F-060` 的协调 SoT，负责把三包的依赖顺序、非目标和冻结点统一下来。
- 当前实现已落地最小接线：
  - `src/backend/stage/public-director-contract.*` 成为统一 contract 入口；
  - `scripts/stage-templates-export.mjs`、`scripts/stage-templates-validate.mjs`、`src/backend/stage/stage-template-ops.js` 已导出/校验 v2 scene-pool catalog；
  - `PrivateChannelService`、`ProactiveInteractionService` 与 `PromptOrchestrator` 已支持私域去导演化边界。

## Acceptance criteria (high level)
- [x] `stage_template_v2.director`、`scene_binding_v1`、`episode_overlay_v1`、`runtime_scene_state_v1`、`EpisodeBrief`、`LocalIntent`、`scene_metadata` 的职责和边界被冻结。
- [x] `private_chat` 不进入导演体系、`proactive_dm` 只保留 trigger-aware opening 的约束被显式写入。
- [x] 角色侧只接收 `LocalIntent + 最小必要语境` 的原则被写成实现前提，而不是口头共识。
- [x] `director_surface / actor_surface / private_surface` 的词汇边界被固定，不再把 `PromptScene`、调度入口和实际写入面混用。
- [x] 旧对象到新对象的映射与迁移顺序明确，可直接交给后续实现 task。
- [x] 场景池资产层与轮换/回滚/生命周期的升级范围被显式纳入，不再悬空。
- [x] 私域收口不只是原则，而是有执行矩阵、入口清单与验收口径。
- [x] `T-094 / T-095 / T-096` 的依赖顺序、冻结点和非目标被写成统一总口径，不再各自解释一版。
